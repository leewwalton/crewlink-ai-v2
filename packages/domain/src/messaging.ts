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
  createdAt: string;
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
