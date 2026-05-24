import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { pilots, searchPilots } from "../../../packages/domain/src";
import { json } from "../_shared/response";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const qs = event.queryStringParameters ?? {};
  const filtered = searchPilots(pilots, {
    aircraftType: qs.aircraftType || undefined,
    rating: qs.rating || undefined,
    certificate: qs.certificate || undefined,
    availableStart: qs.availableStart || undefined,
    availableEnd: qs.availableEnd || undefined,
    contractPreference: (qs.contractPreference as any) || undefined,
  });

  return json(200, { pilots: filtered });
};
