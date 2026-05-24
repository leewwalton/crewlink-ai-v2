import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export function json(
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization,Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export function parseBody<T>(body: string | undefined | null): T {
  if (!body) return {} as T;
  return JSON.parse(body) as T;
}
