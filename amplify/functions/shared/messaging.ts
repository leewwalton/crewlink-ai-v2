import {
  buildConversationId,
  isConversationUnread,
  totalUnreadCount,
  type Conversation,
  type ConversationInboxItem,
  type CreateConversationInput,
  type Message,
  type SendMessageInput,
} from "../../../packages/domain/src";
import {
  conversationGet,
  conversationPut,
  messagePut,
  messagesQuery,
  operatorProfileGet,
  pilotProfileGet,
  userConversationGet,
  userConversationPut,
  userConversationsQuery,
} from "./dynamodb-client";
import { notifyMessageRecipients } from "./message-notifications";

export type UserProfile = {
  id: string;
  name: string;
  role: "operator" | "pilot";
};

export async function resolveUserProfile(
  userId: string,
  email?: string | null,
): Promise<UserProfile> {
  const [operatorRow, pilotRow] = await Promise.all([
    operatorProfileGet(userId),
    pilotProfileGet(userId),
  ]);

  if (operatorRow) {
    return {
      id: userId,
      name: String(
        operatorRow.organization || operatorRow.contactName || email?.split("@")[0] || "Operator",
      ),
      role: "operator",
    };
  }

  if (pilotRow) {
    return {
      id: userId,
      name: String(pilotRow.name || email?.split("@")[0] || "Pilot"),
      role: "pilot",
    };
  }

  return {
    id: userId,
    name: email?.split("@")[0] || "CrewLinkAI user",
    role: "operator",
  };
}

export async function resolveParticipantProfile(
  userId: string,
  fallbackName: string,
  fallbackRole: UserProfile["role"] = "pilot",
): Promise<UserProfile> {
  const profile = await resolveUserProfile(userId);
  if (profile.name !== "CrewLinkAI user") {
    return profile;
  }
  return {
    id: userId,
    name: fallbackName,
    role: fallbackRole,
  };
}

export async function listConversationsForUser(userId: string): Promise<ConversationInboxItem[]> {
  const indexItems = await userConversationsQuery(userId);
  const conversations: ConversationInboxItem[] = [];

  for (const item of indexItems) {
    const row = await conversationGet(String(item.conversationId));
    if (!row) continue;

    const conversation = row as Conversation;
    if (!conversation.lastMessageSenderId && item.lastMessageSenderId) {
      conversation.lastMessageSenderId = String(item.lastMessageSenderId);
    }

    const enriched = await enrichConversationSender(conversation);
    conversations.push(buildInboxItem(enriched, item, userId));
  }

  return conversations.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

async function enrichConversationSender(conversation: Conversation): Promise<Conversation> {
  if (conversation.lastMessageSenderId) return conversation;
  const messages = await listMessages(conversation.id);
  const lastMessage = messages.at(-1);
  if (!lastMessage) return conversation;
  return { ...conversation, lastMessageSenderId: lastMessage.senderId };
}

export async function markConversationRead(
  userId: string,
  conversationId: string,
  readAt?: string,
): Promise<ConversationInboxItem | null> {
  const conversationRow = await conversationGet(conversationId);
  if (!conversationRow) return null;

  const conversation = conversationRow as Conversation;
  if (!conversation.participantIds.includes(userId)) return null;

  const indexItem = await userConversationGet(userId, conversationId);
  if (!indexItem) return null;

  const readTimestamp = readAt ?? new Date().toISOString();
  const other = conversation.participants.find((participant) => participant.id !== userId);

  await userConversationPut({
    ...indexItem,
    userId,
    sk: conversationId,
    conversationId,
    title: conversation.title,
    preview: conversation.lastMessagePreview,
    otherParticipantId: other?.id ?? "",
    otherParticipantName: other?.name ?? "Participant",
    lastMessageSenderId: conversation.lastMessageSenderId,
    lastReadAt: readTimestamp,
    unreadCount: 0,
  });

  return buildInboxItem(conversation, {
    ...indexItem,
    lastReadAt: readTimestamp,
    unreadCount: 0,
  }, userId);
}

function buildInboxItem(
  conversation: Conversation,
  indexItem: Record<string, unknown>,
  userId: string,
): ConversationInboxItem {
  const lastReadAt =
    indexItem.lastReadAt != null ? String(indexItem.lastReadAt) : undefined;
  let unreadCount = Number(indexItem.unreadCount ?? 0);

  if (
    unreadCount === 0 &&
    isConversationUnread(conversation, userId, lastReadAt)
  ) {
    unreadCount = 1;
  }

  return {
    ...conversation,
    lastReadAt,
    unreadCount,
    isUnread: unreadCount > 0,
  };
}

async function inboxItemForUser(
  userId: string,
  conversation: Conversation,
): Promise<ConversationInboxItem> {
  const indexItem = await userConversationGet(userId, conversation.id);
  const enriched = await enrichConversationSender(conversation);
  return buildInboxItem(enriched, indexItem ?? {}, userId);
}

export function inboxUnreadCount(conversations: ConversationInboxItem[]): number {
  return totalUnreadCount(conversations);
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const items = await messagesQuery(conversationId);
  return items as Message[];
}

async function upsertUserConversation(
  userId: string,
  conversation: Conversation,
  otherParticipantId: string,
  otherParticipantName: string,
  readState?: { lastReadAt?: string; unreadCount?: number },
) {
  const existing = await userConversationGet(userId, conversation.id);
  await userConversationPut({
    userId,
    sk: conversation.id,
    conversationId: conversation.id,
    title: conversation.title,
    preview: conversation.lastMessagePreview,
    otherParticipantId,
    otherParticipantName,
    lastMessageSenderId: conversation.lastMessageSenderId,
    lastReadAt: readState?.lastReadAt ?? existing?.lastReadAt,
    unreadCount:
      readState?.unreadCount ??
      (existing?.unreadCount != null ? Number(existing.unreadCount) : 0),
  });
}

export async function saveMessage(
  conversation: Conversation,
  message: Message,
  senderId: string,
) {
  await messagePut(message);

  const updatedConversation: Conversation = {
    ...conversation,
    lastMessageAt: message.createdAt,
    lastMessagePreview: message.body.slice(0, 160),
    lastMessageSenderId: message.senderId,
  };

  await conversationPut(updatedConversation);

  for (const participant of conversation.participants) {
    const other = conversation.participants.find((entry) => entry.id !== participant.id);
    const existing = await userConversationGet(participant.id, conversation.id);
    const isSender = participant.id === senderId;
    const unreadCount = isSender
      ? 0
      : Number(existing?.unreadCount ?? 0) + 1;

    await upsertUserConversation(
      participant.id,
      updatedConversation,
      other?.id ?? senderId,
      other?.name ?? "Participant",
      isSender
        ? { lastReadAt: message.createdAt, unreadCount: 0 }
        : { unreadCount },
    );
  }

  try {
    await notifyMessageRecipients(updatedConversation, message);
  } catch (err: unknown) {
    console.error("[MESSAGING] Message notification failed", {
      conversationId: conversation.id,
      messageId: message.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function createConversation(
  currentUser: UserProfile,
  input: CreateConversationInput,
): Promise<{ conversation: ConversationInboxItem; messages: Message[]; created: boolean }> {
  const conversationId = buildConversationId(
    currentUser.id,
    input.recipientId,
    input.contextId,
  );

  const recipient = await resolveParticipantProfile(
    input.recipientId,
    input.recipientName,
    (input.recipientRole as UserProfile["role"]) || "pilot",
  );

  const existing = await conversationGet(conversationId);
  if (existing) {
    const conversation = existing as Conversation;
    if (input.initialMessage?.trim()) {
      const message: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        body: input.initialMessage.trim(),
        createdAt: new Date().toISOString(),
      };
      await saveMessage(conversation, message, currentUser.id);
    }
    const refreshed = (await conversationGet(conversationId)) as Conversation;
    return {
      conversation: await inboxItemForUser(currentUser.id, refreshed ?? conversation),
      messages: await listMessages(conversationId),
      created: false,
    };
  }

  const now = new Date().toISOString();
  const initialMessage = input.initialMessage?.trim();
  const conversation: Conversation = {
    id: conversationId,
    participantIds: [currentUser.id, recipient.id].sort(),
    participants: [currentUser, recipient],
    title: input.title || `${currentUser.name} ↔ ${recipient.name}`,
    contextType: input.contextType,
    contextId: input.contextId,
    lastMessageAt: now,
    lastMessagePreview: initialMessage || "Conversation started.",
    lastMessageSenderId: initialMessage ? currentUser.id : undefined,
    createdAt: now,
  };

  await conversationPut(conversation);
  await upsertUserConversation(currentUser.id, conversation, recipient.id, recipient.name, {
    lastReadAt: initialMessage ? now : undefined,
    unreadCount: 0,
  });
  await upsertUserConversation(recipient.id, conversation, currentUser.id, currentUser.name, {
    unreadCount: initialMessage ? 1 : 0,
  });

  if (input.initialMessage?.trim()) {
    const message: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      body: input.initialMessage.trim(),
      createdAt: now,
    };
    await saveMessage(conversation, message, currentUser.id);
  }

  const refreshed = (await conversationGet(conversationId)) as Conversation;
  return {
    conversation: await inboxItemForUser(currentUser.id, refreshed ?? conversation),
    messages: await listMessages(conversationId),
    created: true,
  };
}

export async function sendMessage(
  currentUser: UserProfile,
  input: SendMessageInput,
): Promise<Message> {
  const conversationRow = await conversationGet(input.conversationId);
  const conversation = conversationRow as Conversation | null;
  if (!conversation || !conversation.participantIds.includes(currentUser.id)) {
    throw new Error("FORBIDDEN");
  }

  const message: Message = {
    id: `msg-${Date.now()}`,
    conversationId: input.conversationId,
    senderId: currentUser.id,
    senderName: currentUser.name,
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  };

  await saveMessage(conversation, message, currentUser.id);
  return message;
}

export function parseCreateConversationInput(
  body: Record<string, unknown> | null,
): CreateConversationInput | null {
  if (!body) return null;
  const recipientId = body.recipientId != null ? String(body.recipientId).trim() : "";
  const recipientName = body.recipientName != null ? String(body.recipientName).trim() : "";
  if (!recipientId || !recipientName) return null;
  return {
    recipientId,
    recipientName,
    recipientRole: body.recipientRole as CreateConversationInput["recipientRole"],
    title: body.title != null ? String(body.title) : undefined,
    contextType: body.contextType as CreateConversationInput["contextType"],
    contextId: body.contextId != null ? String(body.contextId) : undefined,
    initialMessage: body.initialMessage != null ? String(body.initialMessage) : undefined,
  };
}

export function parseSendMessageInput(body: Record<string, unknown> | null): SendMessageInput | null {
  if (!body) return null;
  const conversationId =
    body.conversationId != null ? String(body.conversationId).trim() : "";
  const text = body.body != null ? String(body.body).trim() : "";
  if (!conversationId || !text) return null;
  return { conversationId, body: text };
}
