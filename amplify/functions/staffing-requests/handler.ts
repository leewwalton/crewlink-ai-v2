import type { StaffingRequest } from "../../../packages/domain/src";
import {
  staffingRequestGet,
  staffingRequestPut,
  staffingRequestsByOperator,
} from "../shared/dynamodb-client";
import { requireOperatorAccess } from "../shared/account-access";
import { getCognitoSubFromEvent } from "../shared/get-cognito-sub";
import { httpMethod, json, safeParseBody } from "../shared/http";

const LOG_PREFIX = "[STAFFING-REQUESTS]";

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

function buildRequest(
  input: Partial<StaffingRequest>,
  operatorId: string,
): StaffingRequest {
  const departureAirport =
    input.departureAirport != null ? String(input.departureAirport).trim() : "KTEB";
  const arrivalAirport =
    input.arrivalAirport != null ? String(input.arrivalAirport).trim() : undefined;

  return {
    id: input.id || `req-${Date.now()}`,
    operatorId,
    title: input.title?.trim() || "Untitled staffing request",
    aircraftType: input.aircraftType?.trim() || "G650",
    requiredTypeRatings: parseStringList(input.requiredTypeRatings),
    requiredCertificates: parseStringList(input.requiredCertificates).length
      ? parseStringList(input.requiredCertificates)
      : ["ATP"],
    requiredRole: input.requiredRole || "PIC",
    departureAirport,
    arrivalAirport: arrivalAirport || undefined,
    location: input.location || {
      id: `loc-${Date.now()}`,
      label: departureAirport,
      latitude: 0,
      longitude: 0,
      sourceTimestamp: new Date().toISOString(),
      precision: "airport",
    },
    startDate: input.startDate || new Date().toISOString().slice(0, 10),
    endDate: input.endDate || new Date().toISOString().slice(0, 10),
    minimumTotalTime: Number(input.minimumTotalTime) || 2500,
    minimumPicTime:
      input.minimumPicTime != null ? Number(input.minimumPicTime) : undefined,
    tripNotes: input.tripNotes?.trim() || "",
    urgency: input.urgency || "standard",
    compensationVisibility: input.compensationVisibility || "hidden",
    status: input.status || "open",
  };
}

export const handler = async (event: any) => {
  const method = httpMethod(event);
  console.log(`${LOG_PREFIX} Invoked method=${method}`);

  if (method === "OPTIONS") {
    return json(200, { message: "OK" });
  }

  const operatorId = getCognitoSubFromEvent(event);
  if (!operatorId) {
    return json(401, { message: "Authentication required." });
  }

  const access = await requireOperatorAccess(operatorId);
  if (!access.ok) {
    return json(403, { message: access.message });
  }

  if (method === "GET") {
    try {
      const items = await staffingRequestsByOperator(operatorId);
      const requests = items as StaffingRequest[];
      requests.sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );
      return json(200, { requests });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} GET failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  if (method === "POST") {
    try {
      const body = safeParseBody(event.body) ?? {};
      const request = buildRequest(body as Partial<StaffingRequest>, operatorId);
      const now = new Date().toISOString();
      await staffingRequestPut({
        ...(request as unknown as Record<string, unknown>),
        createdAt: now,
        updatedAt: now,
      });
      return json(201, { request });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} POST failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  if (method === "PUT") {
    try {
      const body = safeParseBody(event.body) ?? {};
      const requestId = body.id != null ? String(body.id).trim() : "";
      if (!requestId) {
        return json(400, { message: "id is required." });
      }

      const existingRow = await staffingRequestGet(requestId);
      const existing = existingRow as StaffingRequest | null;
      if (!existing || existing.operatorId !== operatorId) {
        return json(404, { message: "Staffing request not found." });
      }

      const request = buildRequest(
        {
          ...existing,
          ...(body as Partial<StaffingRequest>),
          id: requestId,
          operatorId,
        },
        operatorId,
      );
      const now = new Date().toISOString();
      await staffingRequestPut({
        ...(request as unknown as Record<string, unknown>),
        createdAt: (existingRow?.createdAt as string | undefined) ?? now,
        updatedAt: now,
      });
      return json(200, { request });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} PUT failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  return json(405, { message: "Method Not Allowed" });
};
