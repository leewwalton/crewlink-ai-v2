import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { pilots, requests } from "../../../packages/domain/src";
import { json } from "../_shared/response";

export const handler: APIGatewayProxyHandlerV2 = async () => {
  return json(200, { pilots, requests });
};
