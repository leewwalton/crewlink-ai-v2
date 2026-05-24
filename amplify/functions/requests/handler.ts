import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { requests, type StaffingRequest } from "../../../packages/domain/src";
import { json, parseBody } from "../_shared/response";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "GET") {
    return json(200, { requests });
  }

  const input = parseBody<Partial<StaffingRequest>>(event.body);
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

  await ddb.send(
    new PutCommand({
      TableName: process.env.STAFFING_REQUESTS_TABLE,
      Item: request,
    }),
  );

  return json(200, { request });
};
