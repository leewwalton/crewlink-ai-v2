import type {
  AvailabilityWindow,
  LocationSnapshot,
  PilotProfile,
  PilotRole,
} from "../../../packages/domain/src";
import { pilotProfileGet, pilotProfilePut } from "../shared/dynamodb-client";
import { getCognitoSubFromEvent } from "../shared/get-cognito-sub";
import { httpMethod, json, safeParseBody } from "../shared/http";

const LOG_PREFIX = "[PILOT-PROFILE]";

const PILOT_ROLES: PilotRole[] = ["PIC", "SIC", "Relief Pilot"];
const MEDICAL_CLASSES: PilotProfile["medicalClass"][] = ["First", "Second", "Third"];
const CONTRACT_PREFERENCES: PilotProfile["contractPreference"][] = [
  "contract",
  "full-time",
  "either",
];
const AVAILABILITY_STATUSES: AvailabilityWindow["status"][] = [
  "available",
  "standby",
  "limited",
];

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

function parseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAvailability(value: unknown): AvailabilityWindow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const startDate = String(record.startDate ?? "").trim();
      const endDate = String(record.endDate ?? "").trim();
      const status = String(record.status ?? "available");
      if (!startDate || !endDate) return null;
      return {
        startDate,
        endDate,
        status: AVAILABILITY_STATUSES.includes(status as AvailabilityWindow["status"])
          ? (status as AvailabilityWindow["status"])
          : "available",
      };
    })
    .filter(Boolean) as AvailabilityWindow[];
}

function parseLocation(
  body: Record<string, unknown>,
  userId: string,
  homeBase: string,
  now: string,
): LocationSnapshot {
  const currentLocation =
    body.currentLocation && typeof body.currentLocation === "object"
      ? (body.currentLocation as Record<string, unknown>)
      : null;

  const latitude = parseNumber(currentLocation?.latitude, 0);
  const longitude = parseNumber(currentLocation?.longitude, 0);
  const label = String(currentLocation?.label ?? homeBase).trim() || homeBase;

  return {
    id: String(currentLocation?.id ?? `loc-${userId}`),
    label,
    latitude,
    longitude,
    sourceTimestamp: String(currentLocation?.sourceTimestamp ?? now),
    precision:
      currentLocation?.precision === "exact" ||
      currentLocation?.precision === "metro"
        ? currentLocation.precision
        : "airport",
  };
}

function toPilotProfile(item: Record<string, unknown>): PilotProfile {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...profile } = item;
  return profile as PilotProfile;
}

function parseProfileInput(
  body: Record<string, unknown> | null,
  userId: string,
): PilotProfile | null {
  if (!body) return null;

  const name = body.name != null ? String(body.name).trim() : "";
  const homeBase = body.homeBase != null ? String(body.homeBase).trim() : "";
  const role = body.role != null ? String(body.role) : "PIC";

  if (!name || !homeBase) {
    return null;
  }

  const now = new Date().toISOString();
  const normalizedRole = PILOT_ROLES.includes(role as PilotRole)
    ? (role as PilotRole)
    : "PIC";
  const medicalClass = body.medicalClass != null ? String(body.medicalClass) : "First";
  const contractPreference =
    body.contractPreference != null ? String(body.contractPreference) : "either";
  const documentsStatus =
    body.documentsStatus != null ? String(body.documentsStatus) : "review";

  return {
    id: userId,
    name,
    role: normalizedRole,
    homeBase,
    currentLocation: parseLocation(body, userId, homeBase, now),
    aircraftTypes: parseStringList(body.aircraftTypes),
    typeRatings: parseStringList(body.typeRatings),
    certificates: parseStringList(body.certificates),
    medicalClass: MEDICAL_CLASSES.includes(medicalClass as PilotProfile["medicalClass"])
      ? (medicalClass as PilotProfile["medicalClass"])
      : "First",
    totalTime: parseNumber(body.totalTime),
    picTime: parseNumber(body.picTime),
    sicTime: parseNumber(body.sicTime),
    documentsStatus:
      documentsStatus === "verified" || documentsStatus === "expired"
        ? documentsStatus
        : "review",
    availability: parseAvailability(body.availability),
    contractPreference: CONTRACT_PREFERENCES.includes(
      contractPreference as PilotProfile["contractPreference"],
    )
      ? (contractPreference as PilotProfile["contractPreference"])
      : "either",
    travelRegions: parseStringList(body.travelRegions),
    hourlyRate:
      body.hourlyRate == null || body.hourlyRate === ""
        ? undefined
        : parseNumber(body.hourlyRate),
    lastActive: now,
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

  if (method === "GET") {
    try {
      const profile = await pilotProfileGet(userId);
      if (!profile) {
        return json(404, { message: "Pilot profile not found." });
      }
      return json(200, { profile: toPilotProfile(profile) });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} GET failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  if (method === "PUT") {
    const input = parseProfileInput(safeParseBody(event.body), userId);
    if (!input) {
      return json(400, { message: "name and homeBase are required." });
    }

    try {
      const now = new Date().toISOString();
      const existing = await pilotProfileGet(userId);
      await pilotProfilePut({
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
