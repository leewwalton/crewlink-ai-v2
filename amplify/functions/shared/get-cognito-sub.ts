/**
 * Cognito identity from API Gateway HTTP API JWT authorizer context.
 */
export function getCognitoSubFromEvent(event: {
  requestContext?: {
    authorizer?: {
      jwt?: { claims?: Record<string, string | undefined> };
      claims?: Record<string, string | undefined>;
      sub?: string;
      "cognito:username"?: string;
    };
  };
}): string | undefined {
  const authorizer = event?.requestContext?.authorizer;
  const jwtClaims = authorizer?.jwt?.claims;
  const claims = authorizer?.claims;

  const sub =
    jwtClaims?.sub ||
    jwtClaims?.["cognito:username"] ||
    claims?.sub ||
    claims?.["cognito:username"] ||
    authorizer?.sub ||
    authorizer?.["cognito:username"];

  return typeof sub === "string" && sub.length > 0 ? sub : undefined;
}

export function getCognitoEmailFromEvent(event: {
  requestContext?: {
    authorizer?: {
      jwt?: { claims?: Record<string, string | undefined> };
      claims?: Record<string, string | undefined>;
    };
  };
}): string | undefined {
  const authorizer = event?.requestContext?.authorizer;
  const email =
    authorizer?.jwt?.claims?.email ||
    authorizer?.claims?.email ||
    authorizer?.jwt?.claims?.["cognito:email"];
  return typeof email === "string" && email.length > 0 ? email : undefined;
}
