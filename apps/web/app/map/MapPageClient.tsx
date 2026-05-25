"use client";

import { useEffect, useMemo, useState } from "react";
import type { PilotProfile, StaffingRequest } from "@crewlink/domain";
import AppNav from "../components/AppNav";
import NetworkGlobeMap from "../components/NetworkGlobeMap";
import { useAirportCoords } from "../hooks/useAirportCoords";
import { getMapData } from "../utils/api-client";
import {
  airportToLocationSnapshot,
  hasValidCoordinates,
} from "../utils/airport-coords";

function enrichRequest(
  request: StaffingRequest,
  resolveAirport: (code: string) => ReturnType<
    ReturnType<typeof useAirportCoords>["resolveAirport"]
  >,
): StaffingRequest | null {
  const airport = resolveAirport(request.departureAirport);
  if (airport) {
    return {
      ...request,
      location: airportToLocationSnapshot(airport, request.location?.id),
    };
  }
  return hasValidCoordinates(request.location) ? request : null;
}

function enrichPilot(
  pilot: PilotProfile,
  resolveAirport: (code: string) => ReturnType<
    ReturnType<typeof useAirportCoords>["resolveAirport"]
  >,
): PilotProfile | null {
  const airport = resolveAirport(pilot.homeBase);
  if (airport) {
    return {
      ...pilot,
      currentLocation: airportToLocationSnapshot(airport, pilot.currentLocation?.id),
    };
  }
  return hasValidCoordinates(pilot.currentLocation) ? pilot : null;
}

export default function MapPageClient() {
  const { ready: airportsReady, resolveAirport } = useAirportCoords();
  const [pilots, setPilots] = useState<PilotProfile[]>([]);
  const [requests, setRequests] = useState<StaffingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getMapData();
        if (!active) return;
        setPilots(data.pilots);
        setRequests(data.requests);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load map data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const plottedPilots = useMemo(() => {
    if (!airportsReady) return [];
    return pilots
      .map((pilot) => enrichPilot(pilot, resolveAirport))
      .filter((pilot): pilot is PilotProfile => pilot != null);
  }, [airportsReady, pilots, resolveAirport]);

  const plottedRequests = useMemo(() => {
    if (!airportsReady) return [];
    return requests
      .map((request) => enrichRequest(request, resolveAirport))
      .filter((request): request is StaffingRequest => request != null);
  }, [airportsReady, requests, resolveAirport]);

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Live network map</span>
              <h1>Map</h1>
            </div>
          </div>

          {loading ? (
            <section className="card panel">
              <p className="muted">Loading map data...</p>
            </section>
          ) : error ? (
            <section className="card panel">
              <p className="fineprint">{error}</p>
            </section>
          ) : (
            <NetworkGlobeMap pilots={plottedPilots} requests={plottedRequests} />
          )}
        </div>
      </main>
    </div>
  );
}
