import { pilots, type PilotProfile } from "../../../packages/domain/src";
import { pilotProfilesScan } from "./dynamodb-client";

function toPilotProfile(item: Record<string, unknown>): PilotProfile {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...profile } = item;
  return profile as PilotProfile;
}

export async function loadMarketplacePilots(): Promise<PilotProfile[]> {
  try {
    const stored = await pilotProfilesScan();
    const storedProfiles = stored.map(toPilotProfile);
    const storedIds = new Set(storedProfiles.map((profile) => profile.id));
    const seedProfiles = pilots.filter((profile) => !storedIds.has(profile.id));
    return [...storedProfiles, ...seedProfiles];
  } catch {
    return pilots;
  }
}
