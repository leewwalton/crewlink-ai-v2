import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { json, parseBody } from "../_shared/response";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESClient({});

type ContactInput = {
  name?: string;
  email?: string;
  organization?: string;
  message?: string;
  source?: string;
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const input = parseBody<ContactInput>(event.body);
  const source = input.source?.trim().toLowerCase() || "contact";
  const isNewsletter = source === "newsletter";

  if (!input.email?.trim()) {
    return json(400, { message: "Email is required." });
  }

  let name = input.name?.trim() || "";
  const email = input.email.trim();
  let message = input.message?.trim() || "";

  if (isNewsletter) {
    if (!name) name = "Newsletter subscriber";
    if (!message) message = "Newsletter signup from CrewLinkAI";
  } else if (!name) {
    return json(400, { message: "Name and email are required." });
  }

  const id = `lead-${Date.now()}`;
  const item = {
    id,
    name,
    email,
    organization: input.organization?.trim() || null,
    message: message || null,
    source,
    status: isNewsletter ? "newsletter" : "new",
    createdAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: process.env.CONTACT_LEADS_TABLE,
      Item: item,
    }),
  );

  if (process.env.CONTACT_TO_EMAIL && process.env.CONTACT_FROM_EMAIL) {
    await ses.send(
      new SendEmailCommand({
        Source: process.env.CONTACT_FROM_EMAIL,
        Destination: { ToAddresses: [process.env.CONTACT_TO_EMAIL] },
        ReplyToAddresses: [email],
        Message: {
          Subject: {
            Data: isNewsletter
              ? `CrewLinkAI newsletter signup: ${email}`
              : `CrewLinkAI demo request from ${input.organization || name}`,
          },
          Body: {
            Text: {
              Data: [
                isNewsletter ? "New newsletter signup" : "New contact form submission",
                "",
                `Name: ${name}`,
                `Email: ${email}`,
                `Source: ${source}`,
                input.organization ? `Organization: ${input.organization}` : null,
                message ? `Message: ${message}` : null,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          },
        },
      }),
    );
  }

  return json(200, { ok: true, id });
};
