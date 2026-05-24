import {
  buildConversationId,
  operators,
  pilots,
  type Conversation,
  type CreateConversationInput,
  type Message,
  type SendMessageInput,
} from "../../../packages/domain/src";
import {
  conversationGet,
  conversationPut,
  messagePut,
  messagesQuery,
  userConversationPut,
  userConversationsQuery,
} from "./dynamodb-client";

export type UserProfile = {
  id: string;
  name: string;
  role: "operator" | "pilot";
};

export function resolveUserProfile(userId: string, email?: string | null): UserProfile {
  const operator = operators.find((entry) => entry.id === userId);
  if (operator) {
    return { id: operator.id, name: operator.organization, role: "operator" };
  }

  const pilot = pilots.find((entry) => entry.id === userId);
  if (pilot) {
    return { id: pilot.id, name: pilot.name, role: "pilot" };
  }

  return {
    id: userId,
    name: email?.split("@")[0] || "CrewLinkAI user",
    role: "operator",
  };
}

export async function listConversationsForUser(userId: string): Promise<Conversation[]> {
  const indexItems = await userConversationsQuery(userId);
  const conversations: Conversation[] = [];

  for (const item of indexItems) {
    const row = await conversationGet(String(item.conversationId));
    if (row) conversations.push(row as Conversation);
  }

  return conversations.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
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
) {
  await userConversationPut({
    userId,
    sk: conversation.id,
    conversationId: conversation.id,
    title: conversation.title,
    preview: conversation.lastMessagePreview,
    otherParticipantId,
    otherParticipantName,
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
  };

  await conversationPut(updatedConversation);

  for (const participant of conversation.participants) {
    const other = conversation.participants.find((entry) => entry.id !== participant.id);
    await upsertUserConversation(
      participant.id,
      updatedConversation,
      other?.id ?? senderId,
      other?.name ?? "Participant",
    );
  }
}

export async function createConversation(
  currentUser: UserProfile,
  input: CreateConversationInput,
): Promise<{ conversation: Conversation; messages: Message[]; created: boolean }> {
  const conversationId = buildConversationId(
    currentUser.id,
    input.recipientId,
    input.contextId,
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
    return {
      conversation,
      messages: await listMessages(conversationId),
      created: false,
    };
  }

  const now = new Date().toISOString();
  const recipient = {
    id: input.recipientId,
    name: input.recipientName,
    role: input.recipientRole || "pilot",
  };
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

  await conversationPut(conversation);
  await upsertUserConversation(currentUser.id, conversation, recipient.id, recipient.name);
  await upsertUserConversation(recipient.id, conversation, currentUser.id, currentUser.name);

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

  return {
    conversation,
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
