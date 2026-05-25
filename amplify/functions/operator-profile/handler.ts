import type { OperatorProfile } from "../../../packages/domain/src";
import { operatorProfileGet, operatorProfilePut } from "../shared/dynamodb-client";
import {
  getCognitoEmailFromEvent,
  getCognitoSubFromEvent,
} from "../shared/get-cognito-sub";
import { httpMethod, json, safeParseBody } from "../shared/http";

const LOG_PREFIX = "[OPERATOR-PROFILE]";

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function parseProfileInput(
  body: Record<string, unknown> | null,
  userId: string,
  fallbackEmail?: string,
): OperatorProfile | null {
  if (!body) return null;

  const organization =
    body.organization != null ? String(body.organization).trim() : "";
  const contactName = body.contactName != null ? String(body.contactName).trim() : "";
  const email =
    (body.email != null ? String(body.email).trim() : "") || fallbackEmail || "";

  if (!organization || !contactName || !email) {
    return null;
  }

  const status = body.status != null ? String(body.status) : "trial";
  const allowedStatus = ["active", "trial", "inactive"];
  const normalizedStatus = allowedStatus.includes(status)
    ? (status as OperatorProfile["status"])
    : "trial";

  return {
    id: userId,
    organization,
    contactName,
    email,
    fleetTypes: parseStringList(body.fleetTypes),
    operatingRegions: parseStringList(body.operatingRegions),
    status: normalizedStatus,
  };
}

export const handler = async (event: any) => {
  const method = httpMethod(event);
  console.log(`${LOG_PREFIX} Invoked method=${method}`);

  if (method === "OPTIONS") {
    return json(200, { message: "OK" });
  }

  const userId = getCognitoSubFromEvent(event);
  if (!userId) {
    return json(401, { message: "Authentication required." });
  }

  const email = getCognitoEmailFromEvent(event);

  if (method === "GET") {
    try {
      const profile = await operatorProfileGet(userId);
      if (!profile) {
        return json(404, { message: "Operator profile not found." });
      }
      return json(200, { profile: profile as OperatorProfile });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} GET failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  if (method === "PUT") {
    const input = parseProfileInput(safeParseBody(event.body), userId, email);
    if (!input) {
      return json(400, {
        message: "organization, contactName, and email are required.",
      });
    }

    try {
      const now = new Date().toISOString();
      const existing = await operatorProfileGet(userId);
      await operatorProfilePut({
        ...input,
        createdAt: (existing?.createdAt as string | undefined) ?? now,
        updatedAt: now,
      });
      return json(200, { profile: input });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} PUT failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  return json(405, { message: "Method Not Allowed" });
};
