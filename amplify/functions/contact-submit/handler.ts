import { randomUUID } from "crypto";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { contactLeadPut } from "../shared/dynamodb-client";
import { httpMethod, json, safeParseBody } from "../shared/http";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "us-west-2" });

const CONTACT_NOTIFY_EMAIL = process.env.CONTACT_NOTIFY_EMAIL || "";
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || process.env.CONTACT_NOTIFY_EMAIL || "";
const CONTACT_SES_SOURCE_ARN = process.env.CONTACT_SES_SOURCE_ARN || "";

const LOG_PREFIX = "[CONTACT-SUBMIT]";

/**
 * HTTP Lambda: POST body { name, email, organization?, message?, source? }
 * Creates a contact lead in DynamoDB and sends a notification email via SES.
 */
export const handler = async (event: any) => {
  const requestId = event.requestContext?.requestId ?? "unknown";
  const method = httpMethod(event);

  console.log(`${LOG_PREFIX} Invoked requestId=${requestId} method=${method}`);

  if (method === "OPTIONS") {
    return json(200, { message: "OK" });
  }

  if (method !== "POST") {
    console.warn(`${LOG_PREFIX} Rejected method=${method}`);
    return json(405, { message: "Method Not Allowed" });
  }

  const body = safeParseBody(event.body);
  const source = body?.source != null ? String(body.source).trim().toLowerCase() : "contact";
  const isNewsletter = source === "newsletter";

  let name = body?.name != null ? String(body.name).trim() : "";
  const email = body?.email != null ? String(body.email).trim() : "";
  const organization = body?.organization != null ? String(body.organization).trim() : null;
  let message = body?.message != null ? String(body.message).trim() : null;

  if (!email) {
    console.warn(`${LOG_PREFIX} Validation failed: missing email`);
    return json(400, { message: "email is required" });
  }

  if (isNewsletter) {
    if (!name) name = "Newsletter subscriber";
    if (!message) message = "Newsletter signup from flycrewlink.com";
  } else if (!name) {
    console.warn(`${LOG_PREFIX} Validation failed: missing name`);
    return json(400, { message: "name and email are required" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const item = {
    id,
    name,
    email,
    organization: organization ?? null,
    message: message ?? null,
    status: isNewsletter ? "newsletter" : "new",
    source,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await contactLeadPut(item);
    console.log(`${LOG_PREFIX} DynamoDB put succeeded id=${id}`);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} DynamoDB put failed`, { id, error: err?.message });
    return json(500, { message: "Failed to save contact" });
  }

  if (CONTACT_NOTIFY_EMAIL && CONTACT_FROM_EMAIL) {
    try {
      await ses.send(
        new SendEmailCommand({
          Source: CONTACT_FROM_EMAIL,
          ...(CONTACT_SES_SOURCE_ARN ? { SourceArn: CONTACT_SES_SOURCE_ARN } : {}),
          Destination: { ToAddresses: [CONTACT_NOTIFY_EMAIL] },
          ReplyToAddresses: [email],
          Message: {
            Subject: {
              Data: isNewsletter
                ? `CrewLinkAI newsletter signup: ${email}`
                : `CrewLinkAI contact: ${name}`,
            },
            Body: {
              Text: {
                Data: [
                  isNewsletter ? "New newsletter signup" : "New contact form submission",
                  "",
                  `Name: ${name}`,
                  `Email: ${email}`,
                  `Source: ${source}`,
                  organization ? `Organization: ${organization}` : null,
                  message ? `Message: ${message}` : null,
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            },
          },
        }),
      );
      console.log(`${LOG_PREFIX} SES send succeeded id=${id}`);
    } catch (err: any) {
      console.error(`${LOG_PREFIX} SES send failed (contact saved)`, { id, error: err?.message });
    }
  }

  return json(200, { ok: true, id: item.id });
};
