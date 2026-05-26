import {
  getCognitoEmailFromEvent,
  getCognitoSubFromEvent,
} from "../shared/get-cognito-sub";
import { httpMethod, json, safeParseBody } from "../shared/http";
import {
  createConversation,
  inboxUnreadCount,
  listConversationsForUser,
  parseCreateConversationInput,
  resolveUserProfile,
} from "../shared/messaging";

const LOG_PREFIX = "[CONVERSATIONS]";

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
    try {
      const conversations = await listConversationsForUser(currentUser.id);
      const unreadCount = inboxUnreadCount(conversations);
      return json(200, { conversations, currentUser, unreadCount });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} GET failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  if (method === "POST") {
    const input = parseCreateConversationInput(safeParseBody(event.body));
    if (!input) {
      return json(400, { message: "recipientId and recipientName are required." });
    }

    try {
      const result = await createConversation(currentUser, input);
      return json(result.created ? 201 : 200, {
        conversation: result.conversation,
        messages: result.messages,
        created: result.created,
      });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} POST failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  return json(405, { message: "Method Not Allowed" });
};
