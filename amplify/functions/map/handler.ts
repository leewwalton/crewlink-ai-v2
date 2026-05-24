import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { pilots, requests } from "@crewlink/domain";
import { json } from "../_shared/response";

export const handler: APIGatewayProxyHandlerV2 = async () => {
  return json(200, { pilots, requests });
};
