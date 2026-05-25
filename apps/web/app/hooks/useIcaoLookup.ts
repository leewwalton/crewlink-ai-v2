"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAircraftSuggestions,
  getAirportSuggestions,
  ICAO_AIRCRAFT_PATH,
  ICAO_AIRPORTS_PATH,
  type IcaoAircraftItem,
  type IcaoAirportItem,
} from "../utils/icao-lookup";

let airportsCache: IcaoAirportItem[] | null = null;
let aircraftCache: IcaoAircraftItem[] | null = null;
let loadPromise: Promise<void> | null = null;

function loadIcaoData(): Promise<void> {
  if (airportsCache && aircraftCache) {
    return Promise.resolve();
  }

  if (!loadPromise) {
    loadPromise = Promise.all([
      fetch(ICAO_AIRPORTS_PATH).then((response) => response.json()),
      fetch(ICAO_AIRCRAFT_PATH).then((response) => response.json()),
    ])
      .then(([airports, aircraft]) => {
        if (Array.isArray(airports)) airportsCache = airports;
        if (Array.isArray(aircraft)) aircraftCache = aircraft;
      })
      .catch(() => {
        loadPromise = null;
      });
  }

  return loadPromise;
}

export function useIcaoLookup() {
  const [ready, setReady] = useState(Boolean(airportsCache && aircraftCache));

  useEffect(() => {
    let cancelled = false;
    loadIcaoData().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchAirports = useCallback(
    (query: string) => getAirportSuggestions(airportsCache ?? [], query),
    [ready],
  );

  const searchAircraft = useCallback(
    (query: string) => getAircraftSuggestions(aircraftCache ?? [], query),
    [ready],
  );

  return {
    ready,
    searchAirports,
    searchAircraft,
  };
}
