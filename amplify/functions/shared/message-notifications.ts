import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { Conversation, Message } from "../../../packages/domain/src";
import { operatorProfileGet, pilotProfileGet } from "./dynamodb-client";

const LOG_PREFIX = "[MESSAGE-NOTIFY]";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "us-west-2" });
const sns = new SNSClient({ region: process.env.AWS_REGION ?? "us-west-2" });

const MESSAGE_FROM_EMAIL =
  process.env.MESSAGE_FROM_EMAIL ||
  process.env.CONTACT_FROM_EMAIL ||
  process.env.CONTACT_NOTIFY_EMAIL ||
  "";
const MESSAGE_SES_SOURCE_ARN =
  process.env.MESSAGE_SES_SOURCE_ARN || process.env.CONTACT_SES_SOURCE_ARN || "";
const MESSAGE_WEB_BASE_URL =
  process.env.MESSAGE_WEB_BASE_URL || "https://crewlink-ai.com";

export type ParticipantContact = {
  email?: string;
  phones: string[];
};

function trim(value: unknown): string {
  return value != null ? String(value).trim() : "";
}

export function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const normalized = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return normalized.length >= 11 ? normalized : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return null;
}

export async function resolveParticipantContact(userId: string): Promise<ParticipantContact> {
  const [operatorRow, pilotRow] = await Promise.all([
    operatorProfileGet(userId),
    pilotProfileGet(userId),
  ]);

  const phones: string[] = [];
  const email = trim(operatorRow?.email) || trim(pilotRow?.email) || undefined;

  for (const rawPhone of [trim(pilotRow?.phone), trim(pilotRow?.alternatePhone)]) {
    if (!rawPhone) continue;
    const normalized = normalizePhoneNumber(rawPhone);
    if (normalized && !phones.includes(normalized)) {
      phones.push(normalized);
    }
  }

  return { email, phones };
}

function messagesUrl(conversationId: string): string {
  const base = MESSAGE_WEB_BASE_URL.replace(/\/$/, "");
  return `${base}/messages?conversationId=${encodeURIComponent(conversationId)}`;
}

function truncatePreview(body: string, maxLength: number): string {
  const trimmed = body.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

async function sendMessageEmail(input: {
  to: string;
  senderName: string;
  conversationTitle: string;
  preview: string;
  conversationId: string;
}) {
  if (!MESSAGE_FROM_EMAIL) {
    console.warn(`${LOG_PREFIX} Email skipped: MESSAGE_FROM_EMAIL not configured`);
    return;
  }

  await ses.send(
    new SendEmailCommand({
      Source: MESSAGE_FROM_EMAIL,
      ...(MESSAGE_SES_SOURCE_ARN ? { SourceArn: MESSAGE_SES_SOURCE_ARN } : {}),
      Destination: { ToAddresses: [input.to] },
      Message: {
        Subject: {
          Data: `New CrewLinkAI message from ${input.senderName}`,
        },
        Body: {
          Text: {
            Data: [
              "You have a new message in CrewLinkAI.",
              "",
              `From: ${input.senderName}`,
              `Conversation: ${input.conversationTitle}`,
              "",
              truncatePreview(input.preview, 500),
              "",
              `Open messages: ${messagesUrl(input.conversationId)}`,
            ].join("\n"),
          },
        },
      },
    }),
  );
}

async function sendMessageSms(input: {
  phone: string;
  senderName: string;
  preview: string;
  conversationId: string;
}) {
  const text = truncatePreview(
    `CrewLinkAI: New message from ${input.senderName}: ${input.preview} ${messagesUrl(input.conversationId)}`,
    300,
  );

  await sns.send(
    new PublishCommand({
      PhoneNumber: input.phone,
      Message: text,
    }),
  );
}

export async function notifyMessageRecipients(
  conversation: Conversation,
  message: Message,
): Promise<void> {
  const recipients = conversation.participants.filter(
    (participant) => participant.id !== message.senderId,
  );

  if (recipients.length === 0) return;

  const preview = truncatePreview(message.body, 160);

  for (const recipient of recipients) {
    const contact = await resolveParticipantContact(recipient.id);

    if (contact.email) {
      try {
        await sendMessageEmail({
          to: contact.email,
          senderName: message.senderName,
          conversationTitle: conversation.title,
          preview: message.body,
          conversationId: conversation.id,
        });
        console.log(`${LOG_PREFIX} Email sent`, {
          recipientId: recipient.id,
          email: contact.email,
          conversationId: conversation.id,
        });
      } catch (err: unknown) {
        console.error(`${LOG_PREFIX} Email failed`, {
          recipientId: recipient.id,
          email: contact.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    for (const phone of contact.phones) {
      try {
        await sendMessageSms({
          phone,
          senderName: message.senderName,
          preview,
          conversationId: conversation.id,
        });
        console.log(`${LOG_PREFIX} SMS sent`, {
          recipientId: recipient.id,
          phone,
          conversationId: conversation.id,
        });
      } catch (err: unknown) {
        console.error(`${LOG_PREFIX} SMS failed`, {
          recipientId: recipient.id,
          phone,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
