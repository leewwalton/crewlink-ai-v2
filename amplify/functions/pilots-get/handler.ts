import { searchPilots } from "../../../packages/domain/src";
import { loadMarketplacePilots } from "../shared/marketplace-pilots";
import { httpMethod, json } from "../shared/http";

const LOG_PREFIX = "[PILOTS-GET]";

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
    const qs = event.queryStringParameters ?? {};
    const allPilots = await loadMarketplacePilots();
    const filtered = searchPilots(allPilots, {
      aircraftType: qs.aircraftType || undefined,
      rating: qs.rating || undefined,
      certificate: qs.certificate || undefined,
      availableStart: qs.availableStart || undefined,
      availableEnd: qs.availableEnd || undefined,
      contractPreference: (qs.contractPreference as any) || undefined,
    });

    return json(200, { pilots: filtered });
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed`, { error: err?.message });
    return json(500, { message: "Internal server error" });
  }
};
