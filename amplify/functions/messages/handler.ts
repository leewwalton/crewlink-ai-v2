import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  buildConversationId,
  operators,
  pilots,
  type Conversation,
  type CreateConversationInput,
  type Message,
  type SendMessageInput,
} from "@crewlink/domain";
import { getAuthEmail, getAuthUserId } from "../_shared/auth";
import { json, parseBody } from "../_shared/response";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function resolveUserProfile(userId: string, email?: string | null) {
  const operator = operators.find((entry) => entry.id === userId);
  if (operator) {
    return { id: operator.id, name: operator.organization, role: "operator" as const };
  }

  const pilot = pilots.find((entry) => entry.id === userId);
  if (pilot) {
    return { id: pilot.id, name: pilot.name, role: "pilot" as const };
  }

  return {
    id: userId,
    name: email?.split("@")[0] || "CrewLinkAI user",
    role: "operator" as const,
  };
}

async function listConversationsForUser(userId: string): Promise<Conversation[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: process.env.USER_CONVERSATIONS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
      ScanIndexForward: false,
    }),
  );

  const conversations: Conversation[] = [];
  for (const item of result.Items ?? []) {
    const conversation = await ddb.send(
      new GetCommand({
        TableName: process.env.CONVERSATIONS_TABLE,
        Key: { id: item.conversationId as string },
      }),
    );
    if (conversation.Item) {
      conversations.push(conversation.Item as Conversation);
    }
  }

  return conversations.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

async function listMessages(conversationId: string): Promise<Message[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: process.env.MESSAGES_TABLE,
      KeyConditionExpression: "conversationId = :conversationId",
      ExpressionAttributeValues: { ":conversationId": conversationId },
      ScanIndexForward: true,
    }),
  );

  return (result.Items ?? []) as Message[];
}

async function upsertUserConversation(
  userId: string,
  conversation: Conversation,
  otherParticipantId: string,
  otherParticipantName: string,
) {
  await ddb.send(
    new PutCommand({
      TableName: process.env.USER_CONVERSATIONS_TABLE,
      Item: {
        userId,
        sk: conversation.id,
        conversationId: conversation.id,
        title: conversation.title,
        preview: conversation.lastMessagePreview,
        otherParticipantId,
        otherParticipantName,
      },
    }),
  );
}

async function saveMessage(
  conversation: Conversation,
  message: Message,
  senderId: string,
) {
  await ddb.send(
    new PutCommand({
      TableName: process.env.MESSAGES_TABLE,
      Item: message,
    }),
  );

  const updatedConversation: Conversation = {
    ...conversation,
    lastMessageAt: message.createdAt,
    lastMessagePreview: message.body.slice(0, 160),
  };

  await ddb.send(
    new PutCommand({
      TableName: process.env.CONVERSATIONS_TABLE,
      Item: updatedConversation,
    }),
  );

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

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const userId = getAuthUserId(event);
  if (!userId) {
    return json(401, { message: "Authentication required." });
  }

  const email = getAuthEmail(event);
  const currentUser = resolveUserProfile(userId, email);
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  if (method === "GET" && path === "/conversations") {
    const conversations = await listConversationsForUser(currentUser.id);
    return json(200, { conversations, currentUser });
  }

  if (method === "GET" && path === "/messages") {
    const conversationId = event.queryStringParameters?.conversationId;
    if (!conversationId) {
      return json(400, { message: "conversationId is required." });
    }

    const conversationResult = await ddb.send(
      new GetCommand({
        TableName: process.env.CONVERSATIONS_TABLE,
        Key: { id: conversationId },
      }),
    );
    const conversation = conversationResult.Item as Conversation | undefined;
    if (!conversation || !conversation.participantIds.includes(currentUser.id)) {
      return json(403, { message: "You are not a participant in this conversation." });
    }

    const messages = await listMessages(conversationId);
    return json(200, { conversation, messages, currentUser });
  }

  if (method === "POST" && path === "/conversations") {
    const input = parseBody<CreateConversationInput>(event.body);
    if (!input.recipientId || !input.recipientName) {
      return json(400, { message: "recipientId and recipientName are required." });
    }

    const conversationId = buildConversationId(
      currentUser.id,
      input.recipientId,
      input.contextId,
    );

    const existing = await ddb.send(
      new GetCommand({
        TableName: process.env.CONVERSATIONS_TABLE,
        Key: { id: conversationId },
      }),
    );

    if (existing.Item) {
      const conversation = existing.Item as Conversation;
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
      const messages = await listMessages(conversationId);
      return json(200, { conversation: existing.Item, messages, created: false });
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
      title:
        input.title ||
        `${currentUser.name} ↔ ${recipient.name}`,
      contextType: input.contextType,
      contextId: input.contextId,
      lastMessageAt: now,
      lastMessagePreview: input.initialMessage?.trim() || "Conversation started.",
      createdAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: process.env.CONVERSATIONS_TABLE,
        Item: conversation,
      }),
    );

    await upsertUserConversation(
      currentUser.id,
      conversation,
      recipient.id,
      recipient.name,
    );
    await upsertUserConversation(
      recipient.id,
      conversation,
      currentUser.id,
      currentUser.name,
    );

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

    const messages = await listMessages(conversationId);
    return json(201, { conversation, messages, created: true });
  }

  if (method === "POST" && path === "/messages") {
    const input = parseBody<SendMessageInput>(event.body);
    if (!input.conversationId || !input.body?.trim()) {
      return json(400, { message: "conversationId and body are required." });
    }

    const conversationResult = await ddb.send(
      new GetCommand({
        TableName: process.env.CONVERSATIONS_TABLE,
        Key: { id: input.conversationId },
      }),
    );
    const conversation = conversationResult.Item as Conversation | undefined;
    if (!conversation || !conversation.participantIds.includes(currentUser.id)) {
      return json(403, { message: "You are not a participant in this conversation." });
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
    return json(201, { message });
  }

  return json(404, { message: "Not found." });
};
