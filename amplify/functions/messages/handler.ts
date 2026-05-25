import {
  getCognitoEmailFromEvent,
  getCognitoSubFromEvent,
} from "../shared/get-cognito-sub";
import { conversationGet } from "../shared/dynamodb-client";
import { httpMethod, json, safeParseBody } from "../shared/http";
import {
  listMessages,
  parseSendMessageInput,
  resolveUserProfile,
  sendMessage,
} from "../shared/messaging";
import type { Conversation } from "../../../packages/domain/src";

const LOG_PREFIX = "[MESSAGES]";

export const handler = async (event: any) => {
  const method = httpMethod(event);
  console.log(`${LOG_PREFIX} Invoked method=${method}`);

  if (method === "OPTIONS") {
    return json(200, { message: "OK" });
  }

  const userId = getCognitoSubFromEvent(event);
  if (!userId) {
    console.warn(`${LOG_PREFIX} Unauthorized`);
    return json(401, { message: "Authentication required." });
  }

  const email = getCognitoEmailFromEvent(event);
  const currentUser = await resolveUserProfile(userId, email);

  if (method === "GET") {
    const conversationId = event.queryStringParameters?.conversationId;
    if (!conversationId) {
      return json(400, { message: "conversationId is required." });
    }

    try {
      const conversationRow = await conversationGet(conversationId);
      const conversation = conversationRow as Conversation | null;
      if (!conversation || !conversation.participantIds.includes(currentUser.id)) {
        return json(403, { message: "You are not a participant in this conversation." });
      }

      const messages = await listMessages(conversationId);
      return json(200, { conversation, messages, currentUser });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} GET failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  if (method === "POST") {
    const input = parseSendMessageInput(safeParseBody(event.body));
    if (!input) {
      return json(400, { message: "conversationId and body are required." });
    }

    try {
      const message = await sendMessage(currentUser, input);
      return json(201, { message });
    } catch (err: any) {
      if (err?.message === "FORBIDDEN") {
        return json(403, { message: "You are not a participant in this conversation." });
      }
      console.error(`${LOG_PREFIX} POST failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  return json(405, { message: "Method Not Allowed" });
};
