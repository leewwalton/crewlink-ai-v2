import { pilots, requests } from "../../../packages/domain/src";
import { httpMethod, json } from "../shared/http";

const LOG_PREFIX = "[MAP-GET]";

export const handler = async (event: any) => {
  const method = httpMethod(event);
  console.log(`${LOG_PREFIX} Invoked method=${method}`);

  if (method === "OPTIONS") {
    return json(200, { message: "OK" });
  }

  if (method !== "GET") {
    return json(405, { message: "Method Not Allowed" });
  }

  return json(200, { pilots, requests });
};
