import type { PilotProfile } from "../../../packages/domain/src";
import { pilotProfilesScan } from "./dynamodb-client";

function toPilotProfile(item: Record<string, unknown>): PilotProfile {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...profile } = item;
  return profile as PilotProfile;
}

export async function loadMarketplacePilots(): Promise<PilotProfile[]> {
  try {
    const stored = await pilotProfilesScan();
    return stored.map(toPilotProfile);
  } catch {
    return [];
  }
}
