export interface ConversationParticipant {
  id: string;
  name: string;
  role: "operator" | "pilot" | "admin";
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participants: ConversationParticipant[];
  title: string;
  contextType?: string;
  contextId?: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageSenderId?: string;
  createdAt: string;
}

/** Viewer-specific conversation row returned by the inbox API. */
export interface ConversationInboxItem extends Conversation {
  lastReadAt?: string;
  unreadCount: number;
  isUnread: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface CreateConversationInput {
  recipientId: string;
  recipientName: string;
  recipientRole: ConversationParticipant["role"];
  title?: string;
  contextType?: string;
  contextId?: string;
  initialMessage?: string;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
}

export function buildConversationId(
  userId: string,
  recipientId: string,
  contextId?: string,
): string {
  const pair = [userId, recipientId].sort().join("--");
  return contextId ? `conv-${pair}-${contextId}` : `conv-${pair}`;
}

export function participantLabel(participants: ConversationParticipant[], viewerId: string): string {
  const other = participants.find((participant) => participant.id !== viewerId);
  return other?.name ?? participants[0]?.name ?? "Conversation";
}

/** Conversations where the other party sent the last message and a reply is pending. */
export function countUnansweredConversations(
  conversations: Conversation[],
  userId: string,
): number {
  return conversations.filter(
    (conversation) =>
      conversation.lastMessageSenderId != null &&
      conversation.lastMessageSenderId !== userId,
  ).length;
}

export function isConversationUnread(
  conversation: Conversation,
  userId: string,
  lastReadAt?: string,
): boolean {
  if (
    !conversation.lastMessageSenderId ||
    conversation.lastMessageSenderId === userId
  ) {
    return false;
  }
  if (!lastReadAt) return true;
  return new Date(conversation.lastMessageAt).getTime() > new Date(lastReadAt).getTime();
}

export function isMessageUnread(
  message: Message,
  userId: string,
  lastReadAt?: string,
): boolean {
  if (message.senderId === userId) return false;
  if (!lastReadAt) return true;
  return new Date(message.createdAt).getTime() > new Date(lastReadAt).getTime();
}

export function countUnreadMessages(
  messages: Message[],
  userId: string,
  lastReadAt?: string,
): number {
  return messages.filter((message) => isMessageUnread(message, userId, lastReadAt)).length;
}

export function totalUnreadCount(items: ConversationInboxItem[]): number {
  return items.reduce((sum, item) => sum + item.unreadCount, 0);
}
