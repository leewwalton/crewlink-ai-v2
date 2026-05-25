import type { LocationSnapshot } from "@crewlink/domain";
import { ICAO_AIRPORTS_PATH } from "./icao-lookup";

export type AirportAssetRecord = {
  id?: string;
  metadata?: {
    code?: string;
    faaId?: string;
    name?: string;
    city?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    coordinates?: {
      lat?: number;
      lon?: number;
      long?: number;
    };
  };
};

export type AirportCoord = {
  code: string;
  label: string;
  latitude: number;
  longitude: number;
};

export function normalizeAirportCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function addAirportAlias(
  index: Map<string, AirportCoord>,
  key: string | undefined,
  airport: AirportCoord,
) {
  const normalized = key ? normalizeAirportCode(key) : "";
  if (!normalized || index.has(normalized)) return;
  index.set(normalized, airport);
}

export function buildAirportCoordIndex(
  records: AirportAssetRecord[],
): Map<string, AirportCoord> {
  const index = new Map<string, AirportCoord>();

  for (const record of records) {
    const metadata = record.metadata ?? {};
    const latitude = Number(metadata.latitude ?? metadata.coordinates?.lat);
    const longitude = Number(
      metadata.longitude ?? metadata.coordinates?.lon ?? metadata.coordinates?.long,
    );
    const code = normalizeAirportCode(metadata.code || record.id || metadata.faaId || "");
    if (!code || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const label = [metadata.name, metadata.city, metadata.state]
      .filter(Boolean)
      .join(", ");
    const airport: AirportCoord = {
      code,
      label: label || code,
      latitude,
      longitude,
    };

    addAirportAlias(index, record.id, airport);
    addAirportAlias(index, metadata.code, airport);
    addAirportAlias(index, metadata.faaId, airport);
    if (code.length === 4 && code.startsWith("K")) {
      addAirportAlias(index, code.slice(1), airport);
    }
    if (code.length === 3) {
      addAirportAlias(index, `K${code}`, airport);
    }
  }

  return index;
}

export function lookupAirportCoord(
  index: Map<string, AirportCoord>,
  code: string,
): AirportCoord | null {
  const normalized = normalizeAirportCode(code);
  if (!normalized) return null;
  return (
    index.get(normalized) ||
    (normalized.length === 3 ? index.get(`K${normalized}`) : null) ||
    (normalized.length === 4 && normalized.startsWith("K")
      ? index.get(normalized.slice(1))
      : null) ||
    null
  );
}

export function airportToLocationSnapshot(
  airport: AirportCoord,
  id?: string,
): LocationSnapshot {
  return {
    id: id ?? `loc-${airport.code}`,
    label: airport.label,
    latitude: airport.latitude,
    longitude: airport.longitude,
    sourceTimestamp: new Date().toISOString(),
    precision: "airport",
  };
}

export function hasValidCoordinates(location?: LocationSnapshot | null): boolean {
  if (!location) return false;
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    !(location.latitude === 0 && location.longitude === 0)
  );
}

export { ICAO_AIRPORTS_PATH };
