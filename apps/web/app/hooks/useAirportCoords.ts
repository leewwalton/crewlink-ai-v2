"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildAirportCoordIndex,
  ICAO_AIRPORTS_PATH,
  lookupAirportCoord,
  type AirportCoord,
  type AirportAssetRecord,
} from "../utils/airport-coords";

let indexCache: Map<string, AirportCoord> | null = null;
let loadPromise: Promise<Map<string, AirportCoord>> | null = null;

function loadAirportIndex(): Promise<Map<string, AirportCoord>> {
  if (indexCache) return Promise.resolve(indexCache);
  if (!loadPromise) {
    loadPromise = fetch(ICAO_AIRPORTS_PATH)
      .then((response) => response.json())
      .then((data: AirportAssetRecord[]) => {
        indexCache = buildAirportCoordIndex(Array.isArray(data) ? data : []);
        return indexCache;
      })
      .catch(() => {
        loadPromise = null;
        indexCache = new Map();
        return indexCache;
      });
  }
  return loadPromise;
}

export function useAirportCoords() {
  const [ready, setReady] = useState(Boolean(indexCache));

  useEffect(() => {
    let cancelled = false;
    loadAirportIndex().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveAirport = useCallback(
    (code: string) => {
      if (!indexCache) return null;
      return lookupAirportCoord(indexCache, code);
    },
    [ready],
  );

  return { ready, resolveAirport };
}

export async function resolveAirportCoords(code: string): Promise<AirportCoord | null> {
  const index = await loadAirportIndex();
  return lookupAirportCoord(index, code);
}
