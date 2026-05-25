import { fetchAuthSession } from "aws-amplify/auth";
import type {
  Conversation,
  ConversationParticipant,
  CreateConversationInput,
  Message,
} from "@crewlink/domain";
import { getApiBaseUrl } from "./api-client";

export type MessagingUser = ConversationParticipant;

async function authHeaders(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token =
    session.tokens?.idToken?.toString() ||
    session.tokens?.accessToken?.toString();
  if (!token) {
    throw new Error("Sign in to use messaging.");
  }
  return { Authorization: `Bearer ${token}` };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("CrewLinkAI API URL is not configured.");
  }
  const headers = await authHeaders();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || response.statusText);
  }
  return data as T;
}

export async function listConversations() {
  return apiRequest<{ conversations: Conversation[]; currentUser: MessagingUser }>(
    "conversations",
  );
}

export async function getConversationThread(conversationId: string) {
  return apiRequest<{
    conversation: Conversation;
    messages: Message[];
    currentUser: MessagingUser;
  }>(`messages?conversationId=${encodeURIComponent(conversationId)}`);
}

export async function createConversation(input: CreateConversationInput) {
  return apiRequest<{
    conversation: Conversation;
    messages: Message[];
    created: boolean;
    currentUser?: MessagingUser;
  }>("conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendMessage(input: { conversationId: string; body: string }) {
  await apiRequest<{ message: Message }>("messages", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return getConversationThread(input.conversationId);
}

export function buildMessagePilotHref(input: {
  pilotId: string;
  pilotName: string;
  requestTitle: string;
  matchId: string;
}) {
  const params = new URLSearchParams({
    recipientId: input.pilotId,
    recipientName: input.pilotName,
    title: `${input.requestTitle} · ${input.pilotName}`,
    contextId: input.matchId,
  });
  return `/messages?${params.toString()}`;
}

export function startConversationWithPilot(
  pilot: { id: string; name: string },
  context: { requestTitle: string; matchId: string },
) {
  return createConversation({
    recipientId: pilot.id,
    recipientName: pilot.name,
    recipientRole: "pilot",
    contextType: "match",
    contextId: context.matchId,
    title: `${context.requestTitle} · ${pilot.name}`,
    initialMessage: `Hi ${pilot.name}, we'd like to discuss crew coverage for ${context.requestTitle}.`,
  });
}
