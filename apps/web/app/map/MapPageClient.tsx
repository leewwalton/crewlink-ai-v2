"use client";

import { useEffect, useMemo, useState } from "react";
import type { PilotProfile, StaffingRequest } from "@crewlink/domain";
import AppNav from "../components/AppNav";
import NetworkGlobeMap, { type MapRequestRoute } from "../components/NetworkGlobeMap";
import { useAirportCoords } from "../hooks/useAirportCoords";
import { getMapData } from "../utils/api-client";
import { airportToLocationSnapshot, hasValidCoordinates } from "../utils/airport-coords";

function enrichPilot(
  pilot: PilotProfile,
  resolveAirport: ReturnType<typeof useAirportCoords>["resolveAirport"],
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

function buildRequestRoute(
  request: StaffingRequest,
  resolveAirport: ReturnType<typeof useAirportCoords>["resolveAirport"],
): MapRequestRoute | null {
  const departureAirport = resolveAirport(request.departureAirport);
  if (!departureAirport) {
    return hasValidCoordinates(request.location)
      ? {
          request,
          departure: {
            lat: request.location.latitude,
            long: request.location.longitude,
          },
        }
      : null;
  }

  const departure = {
    lat: departureAirport.latitude,
    long: departureAirport.longitude,
  };

  const arrivalAirport = request.arrivalAirport
    ? resolveAirport(request.arrivalAirport)
    : null;

  if (!arrivalAirport) {
    return { request, departure };
  }

  return {
    request,
    departure,
    arrival: {
      lat: arrivalAirport.latitude,
      long: arrivalAirport.longitude,
    },
  };
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

  const requestRoutes = useMemo(() => {
    if (!airportsReady) return [];
    return requests
      .map((request) => buildRequestRoute(request, resolveAirport))
      .filter((route): route is MapRequestRoute => route != null);
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
            <NetworkGlobeMap pilots={plottedPilots} requestRoutes={requestRoutes} />
          )}
        </div>
      </main>
    </div>
  );
}
