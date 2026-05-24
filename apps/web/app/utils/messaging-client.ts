import { fetchAuthSession } from "aws-amplify/auth";
import {
  buildConversationId,
  operators,
  pilots,
  type Conversation,
  type ConversationParticipant,
  type CreateConversationInput,
  type Message,
} from "@crewlink/domain";
import { getApiBaseUrl } from "./api-client";

const STORAGE_KEY = "crewlinkai-messaging-v1";
const CURRENT_USER_KEY = "crewlinkai-current-user";

type MessagingStore = {
  conversations: Conversation[];
  messages: Message[];
};

export type MessagingUser = ConversationParticipant;

export const demoUsers: MessagingUser[] = [
  {
    id: operators[0].id,
    name: operators[0].organization,
    role: "operator",
  },
  ...pilots.map((pilot) => ({
    id: pilot.id,
    name: pilot.name,
    role: "pilot" as const,
  })),
];

function readStore(): MessagingStore {
  if (typeof window === "undefined") {
    return { conversations: [], messages: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversations: [], messages: [] };
    return JSON.parse(raw) as MessagingStore;
  } catch {
    return { conversations: [], messages: [] };
  }
}

function writeStore(store: MessagingStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getStoredCurrentUser(): MessagingUser {
  if (typeof window === "undefined") {
    return demoUsers[0];
  }
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) return demoUsers[0];
  return demoUsers.find((user) => user.id === raw) ?? demoUsers[0];
}

export function setStoredCurrentUser(userId: string) {
  localStorage.setItem(CURRENT_USER_KEY, userId);
}

async function authHeaders(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token =
    session.tokens?.idToken?.toString() ||
    session.tokens?.accessToken?.toString();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("API unavailable");
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

function listLocalConversations(userId: string): Conversation[] {
  const store = readStore();
  return store.conversations
    .filter((conversation) => conversation.participantIds.includes(userId))
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
}

function listLocalMessages(conversationId: string): Message[] {
  const store = readStore();
  return store.messages
    .filter((message) => message.conversationId === conversationId)
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

function createLocalConversation(
  currentUser: MessagingUser,
  input: CreateConversationInput,
): { conversation: Conversation; messages: Message[]; created: boolean } {
  const store = readStore();
  const conversationId = buildConversationId(
    currentUser.id,
    input.recipientId,
    input.contextId,
  );
  const existing = store.conversations.find((entry) => entry.id === conversationId);
  const recipient: MessagingUser = {
    id: input.recipientId,
    name: input.recipientName,
    role: input.recipientRole,
  };

  if (existing) {
    const messages = listLocalMessages(conversationId);
    if (input.initialMessage?.trim()) {
      const message = sendLocalMessage(currentUser, {
        conversationId,
        body: input.initialMessage.trim(),
      });
      return { conversation: message.conversation, messages: message.messages, created: false };
    }
    return { conversation: existing, messages, created: false };
  }

  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: conversationId,
    participantIds: [currentUser.id, recipient.id].sort(),
    participants: [currentUser, recipient],
    title: input.title || `${currentUser.name} ↔ ${recipient.name}`,
    contextType: input.contextType,
    contextId: input.contextId,
    lastMessageAt: now,
    lastMessagePreview: input.initialMessage?.trim() || "Conversation started.",
    createdAt: now,
  };

  store.conversations.push(conversation);
  writeStore(store);

  if (input.initialMessage?.trim()) {
    const message = sendLocalMessage(currentUser, {
      conversationId,
      body: input.initialMessage.trim(),
    });
    return { conversation: message.conversation, messages: message.messages, created: true };
  }

  return { conversation, messages: [], created: true };
}

function sendLocalMessage(
  currentUser: MessagingUser,
  input: { conversationId: string; body: string },
): { conversation: Conversation; messages: Message[]; message: Message } {
  const store = readStore();
  const conversation = store.conversations.find((entry) => entry.id === input.conversationId);
  if (!conversation || !conversation.participantIds.includes(currentUser.id)) {
    throw new Error("Conversation not found.");
  }

  const message: Message = {
    id: `msg-${Date.now()}`,
    conversationId: input.conversationId,
    senderId: currentUser.id,
    senderName: currentUser.name,
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  };

  store.messages.push(message);
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessagePreview = message.body.slice(0, 160);
  writeStore(store);

  return {
    conversation,
    messages: listLocalMessages(input.conversationId),
    message,
  };
}

export async function listConversations(currentUser: MessagingUser) {
  if (getApiBaseUrl()) {
    try {
      return await apiRequest<{ conversations: Conversation[]; currentUser: MessagingUser }>(
        "conversations",
      );
    } catch {
      // Fall back to local demo store when API is unavailable.
    }
  }
  return { conversations: listLocalConversations(currentUser.id), currentUser };
}

export async function getConversationThread(
  currentUser: MessagingUser,
  conversationId: string,
) {
  if (getApiBaseUrl()) {
    try {
      return await apiRequest<{
        conversation: Conversation;
        messages: Message[];
        currentUser: MessagingUser;
      }>(`messages?conversationId=${encodeURIComponent(conversationId)}`);
    } catch {
      // Fall back to local demo store when API is unavailable.
    }
  }

  const store = readStore();
  const conversation = store.conversations.find((entry) => entry.id === conversationId);
  if (!conversation || !conversation.participantIds.includes(currentUser.id)) {
    throw new Error("Conversation not found.");
  }
  return {
    conversation,
    messages: listLocalMessages(conversationId),
    currentUser,
  };
}

export async function createConversation(
  currentUser: MessagingUser,
  input: CreateConversationInput,
) {
  if (getApiBaseUrl()) {
    try {
      return await apiRequest<{
        conversation: Conversation;
        messages: Message[];
        created: boolean;
      }>("conversations", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch {
      // Fall back to local demo store when API is unavailable.
    }
  }

  return createLocalConversation(currentUser, input);
}

export async function sendMessage(
  currentUser: MessagingUser,
  input: { conversationId: string; body: string },
) {
  if (getApiBaseUrl()) {
    try {
      const result = await apiRequest<{ message: Message }>("messages", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const thread = await getConversationThread(currentUser, input.conversationId);
      return { ...result, ...thread };
    } catch {
      // Fall back to local demo store when API is unavailable.
    }
  }

  return sendLocalMessage(currentUser, input);
}

export function startConversationWithPilot(
  currentUser: MessagingUser,
  pilot: { id: string; name: string },
  context: { requestTitle: string; matchId: string },
) {
  return createConversation(currentUser, {
    recipientId: pilot.id,
    recipientName: pilot.name,
    recipientRole: "pilot",
    contextType: "match",
    contextId: context.matchId,
    title: `${context.requestTitle} · ${pilot.name}`,
    initialMessage: `Hi ${pilot.name}, we'd like to discuss crew coverage for ${context.requestTitle}.`,
  });
}
