import type { APIGatewayProxyEventV2 } from "aws-lambda";

export function getAuthUserId(event: APIGatewayProxyEventV2): string | null {
  const claims = event.requestContext.authorizer?.jwt?.claims as
    | Record<string, string>
    | undefined;
  return claims?.sub ?? null;
}

export function getAuthEmail(event: APIGatewayProxyEventV2): string | null {
  const claims = event.requestContext.authorizer?.jwt?.claims as
    | Record<string, string>
    | undefined;
  return claims?.email ?? null;
}
