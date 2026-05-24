import { requests, type StaffingRequest } from "../../../packages/domain/src";
import { staffingRequestPut } from "../shared/dynamodb-client";
import { httpMethod, json, safeParseBody } from "../shared/http";

const LOG_PREFIX = "[STAFFING-REQUESTS]";

export const handler = async (event: any) => {
  const method = httpMethod(event);
  console.log(`${LOG_PREFIX} Invoked method=${method}`);

  if (method === "OPTIONS") {
    return json(200, { message: "OK" });
  }

  if (method === "GET") {
    return json(200, { requests });
  }

  if (method !== "POST") {
    return json(405, { message: "Method Not Allowed" });
  }

  try {
    const body = safeParseBody(event.body) ?? {};
    const input = body as Partial<StaffingRequest>;
    const request: StaffingRequest = {
      id: input.id || `req-${Date.now()}`,
      operatorId: input.operatorId || "op-001",
      title: input.title || "Untitled staffing request",
      aircraftType: input.aircraftType || "G650",
      requiredTypeRatings: input.requiredTypeRatings || [],
      requiredCertificates: input.requiredCertificates || ["ATP"],
      requiredRole: input.requiredRole || "PIC",
      departureAirport: input.departureAirport || "KTEB",
      arrivalAirport: input.arrivalAirport,
      location:
        input.location || {
          id: `loc-${Date.now()}`,
          label: input.departureAirport || "KTEB",
          latitude: 40.8501,
          longitude: -74.0608,
          sourceTimestamp: new Date().toISOString(),
          precision: "airport",
        },
      startDate: input.startDate || new Date().toISOString().slice(0, 10),
      endDate: input.endDate || new Date().toISOString().slice(0, 10),
      minimumTotalTime: input.minimumTotalTime || 2500,
      minimumPicTime: input.minimumPicTime,
      tripNotes: input.tripNotes || "",
      urgency: input.urgency || "standard",
      compensationVisibility: input.compensationVisibility || "hidden",
      status: input.status || "open",
    };

    await staffingRequestPut(request as unknown as Record<string, unknown>);
    return json(200, { request });
  } catch (err: any) {
    console.error(`${LOG_PREFIX} POST failed`, { error: err?.message });
    return json(500, { message: "Internal server error" });
  }
};
