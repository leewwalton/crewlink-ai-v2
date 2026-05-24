export function json(statusCode: number, body: unknown, cors = true) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      ...(cors
        ? {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          }
        : {}),
    },
    body: JSON.stringify(body),
  };
}

export function safeParseBody(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function httpMethod(event: {
  requestContext?: { http?: { method?: string } };
  httpMethod?: string;
}): string {
  return event.requestContext?.http?.method ?? event.httpMethod ?? "UNKNOWN";
}
