import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function table(envKey: string): string {
  const name = process.env[envKey];
  if (!name) throw new Error(`${envKey} is not set`);
  return name;
}

export async function contactLeadPut(item: Record<string, unknown>): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: table("CONTACT_LEADS_TABLE_NAME"),
      Item: item,
    }),
  );
}

export async function userGet(id: string): Promise<Record<string, unknown> | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: table("USERS_TABLE_NAME"),
      Key: { id },
    }),
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export async function userPut(item: Record<string, unknown>): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: table("USERS_TABLE_NAME"),
      Item: item,
    }),
  );
}

export async function operatorProfileGet(
  id: string,
): Promise<Record<string, unknown> | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: table("OPERATOR_PROFILES_TABLE_NAME"),
      Key: { id },
    }),
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export async function operatorProfilePut(item: Record<string, unknown>): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: table("OPERATOR_PROFILES_TABLE_NAME"),
      Item: item,
    }),
  );
}

export async function pilotProfileGet(
  id: string,
): Promise<Record<string, unknown> | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: table("PILOT_PROFILES_TABLE_NAME"),
      Key: { id },
    }),
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export async function pilotProfilePut(item: Record<string, unknown>): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: table("PILOT_PROFILES_TABLE_NAME"),
      Item: item,
    }),
  );
}

export async function pilotProfilesScan(): Promise<Record<string, unknown>[]> {
  const res = await doc.send(
    new ScanCommand({
      TableName: table("PILOT_PROFILES_TABLE_NAME"),
    }),
  );
  return (res.Items as Record<string, unknown>[] | undefined) ?? [];
}

export async function staffingRequestPut(item: Record<string, unknown>): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: table("STAFFING_REQUESTS_TABLE_NAME"),
      Item: item,
    }),
  );
}

export async function staffingRequestGet(
  id: string,
): Promise<Record<string, unknown> | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: table("STAFFING_REQUESTS_TABLE_NAME"),
      Key: { id },
    }),
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export async function staffingRequestsByOperator(
  operatorId: string,
): Promise<Record<string, unknown>[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: table("STAFFING_REQUESTS_TABLE_NAME"),
      IndexName: "byOperator",
      KeyConditionExpression: "operatorId = :operatorId",
      ExpressionAttributeValues: { ":operatorId": operatorId },
      ScanIndexForward: false,
    }),
  );
  return (res.Items as Record<string, unknown>[] | undefined) ?? [];
}

export async function staffingRequestsScanOpen(): Promise<Record<string, unknown>[]> {
  const res = await doc.send(
    new ScanCommand({
      TableName: table("STAFFING_REQUESTS_TABLE_NAME"),
      FilterExpression: "#status IN (:open, :reviewing)",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":open": "open",
        ":reviewing": "reviewing",
      },
    }),
  );
  return (res.Items as Record<string, unknown>[] | undefined) ?? [];
}

export async function conversationGet(id: string): Promise<Record<string, unknown> | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: table("CONVERSATIONS_TABLE_NAME"),
      Key: { id },
    }),
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export async function conversationPut(item: Record<string, unknown>): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: table("CONVERSATIONS_TABLE_NAME"),
      Item: item,
    }),
  );
}

export async function conversationPutIfNotExists(
  item: Record<string, unknown>,
): Promise<boolean> {
  try {
    await doc.send(
      new PutCommand({
        TableName: table("CONVERSATIONS_TABLE_NAME"),
        Item: item,
        ConditionExpression: "attribute_not_exists(#id)",
        ExpressionAttributeNames: { "#id": "id" },
      }),
    );
    return true;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      err.name === "ConditionalCheckFailedException"
    ) {
      return false;
    }
    throw err;
  }
}

export async function userConversationPut(item: Record<string, unknown>): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: table("USER_CONVERSATIONS_TABLE_NAME"),
      Item: item,
    }),
  );
}

export async function userConversationGet(
  userId: string,
  conversationId: string,
): Promise<Record<string, unknown> | null> {
  const res = await doc.send(
    new GetCommand({
      TableName: table("USER_CONVERSATIONS_TABLE_NAME"),
      Key: { userId, sk: conversationId },
    }),
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export async function userConversationsQuery(userId: string): Promise<Record<string, unknown>[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: table("USER_CONVERSATIONS_TABLE_NAME"),
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
      ScanIndexForward: false,
    }),
  );
  return (res.Items as Record<string, unknown>[] | undefined) ?? [];
}

export async function messagePut(item: Record<string, unknown>): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: table("MESSAGES_TABLE_NAME"),
      Item: item,
    }),
  );
}

export async function messagesQuery(conversationId: string): Promise<Record<string, unknown>[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: table("MESSAGES_TABLE_NAME"),
      KeyConditionExpression: "conversationId = :conversationId",
      ExpressionAttributeValues: { ":conversationId": conversationId },
      ScanIndexForward: true,
    }),
  );
  return (res.Items as Record<string, unknown>[] | undefined) ?? [];
}
