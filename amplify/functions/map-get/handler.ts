import type { StaffingRequest } from "../../../packages/domain/src";
import { staffingRequestsScanOpen } from "../shared/dynamodb-client";
import { loadMarketplacePilots } from "../shared/marketplace-pilots";
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

  try {
    const [pilots, requestRows] = await Promise.all([
      loadMarketplacePilots(),
      staffingRequestsScanOpen(),
    ]);
    const requests = requestRows as StaffingRequest[];
    requests.sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );
    return json(200, { pilots, requests });
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed`, { error: err?.message });
    return json(500, { message: "Internal server error" });
  }
};
