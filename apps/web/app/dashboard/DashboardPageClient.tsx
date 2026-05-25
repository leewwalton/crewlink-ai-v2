"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PilotMatch, PilotProfile, StaffingRequest } from "@crewlink/domain";
import AppNav from "../components/AppNav";
import { getMatches, listPilots, listRequests } from "../utils/api-client";

function pickActiveRequest(requests: StaffingRequest[]): StaffingRequest | null {
  if (requests.length === 0) return null;
  return (
    requests.find((request) => request.status === "open") ||
    requests.find((request) => request.urgency !== "standard") ||
    requests[0]
  );
}

export default function DashboardPageClient() {
  const [requests, setRequests] = useState<StaffingRequest[]>([]);
  const [pilots, setPilots] = useState<PilotProfile[]>([]);
  const [matches, setMatches] = useState<PilotMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeRequest = useMemo(() => pickActiveRequest(requests), [requests]);
  const topMatches = matches.slice(0, 3);
  const verifiedPilots = pilots.filter((pilot) => pilot.documentsStatus === "verified").length;
  const openRequests = requests.filter((request) => request.status === "open").length;
  const bestScore = topMatches[0]?.score ?? 0;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [requestResult, pilotResult] = await Promise.all([listRequests(), listPilots("")]);
        if (!active) return;

        setRequests(requestResult.requests);
        setPilots(pilotResult.pilots);

        const focusRequest = pickActiveRequest(requestResult.requests);
        if (focusRequest) {
          const matchResult = await getMatches(focusRequest.id);
          if (active) setMatches(matchResult.matches);
        } else if (active) {
          setMatches([]);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard.");
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

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Operator cockpit</span>
              <h1>Dashboard</h1>
            </div>
            <a className="btn primary page-header-action" href="/requests">
              Create request
            </a>
          </div>

          {error && (
            <section className="card panel" style={{ marginBottom: 18 }}>
              <p className="fineprint">{error}</p>
            </section>
          )}

          {loading ? (
            <section className="card panel">
              <p className="muted">Loading dashboard...</p>
            </section>
          ) : (
            <>
              <section className="grid" style={{ marginBottom: 18 }}>
                <div className="card stat-card" style={{ gridColumn: "span 3" }}>
                  <b>{openRequests}</b>
                  <span>open staffing requests</span>
                </div>
                <div className="card stat-card" style={{ gridColumn: "span 3" }}>
                  <b>{pilots.length}</b>
                  <span>pilots in the active network</span>
                </div>
                <div className="card stat-card" style={{ gridColumn: "span 3" }}>
                  <b>{verifiedPilots}</b>
                  <span>credential-verified pilots</span>
                </div>
                <div className="card stat-card" style={{ gridColumn: "span 3" }}>
                  <b>{bestScore ? `${bestScore}%` : "—"}</b>
                  <span>best current fit score</span>
                </div>
              </section>

              <section className="grid">
                <div className="card panel" style={{ gridColumn: "span 7" }}>
                  <div className="panel-title">
                    <h2>
                      {activeRequest
                        ? `Recommended for ${activeRequest.title}`
                        : "Recommended matches"}
                    </h2>
                    {activeRequest && (
                      <Link
                        className="btn small"
                        href={`/matches?requestId=${encodeURIComponent(activeRequest.id)}`}
                      >
                        View all
                      </Link>
                    )}
                  </div>
                  {!activeRequest ? (
                    <p className="muted">
                      Create a staffing request to start seeing ranked pilot matches.
                    </p>
                  ) : topMatches.length === 0 ? (
                    <p className="muted">No matches available for this request yet.</p>
                  ) : (
                    <div className="list">
                      {topMatches.map((match) => {
                        const pilot = pilots.find((candidate) => candidate.id === match.pilotId);
                        if (!pilot) return null;
                        return (
                          <article className="match-card" key={match.id}>
                            <div
                              style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                            >
                              <div>
                                <h3>{pilot.name}</h3>
                                <p className="meta">
                                  {pilot.role} · {pilot.homeBase} · {match.distanceNm} NM from
                                  departure
                                </p>
                              </div>
                              <span className="score">{match.score}%</span>
                            </div>
                            <p className="muted">{match.explanation}</p>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="card panel" style={{ gridColumn: "span 5" }}>
                  <div className="panel-title">
                    <h2>Urgent queue</h2>
                    <a className="btn small" href="/requests">
                      Manage
                    </a>
                  </div>
                  {requests.length === 0 ? (
                    <p className="muted">No requests yet.</p>
                  ) : (
                    <div className="list">
                      {requests.map((request) => (
                        <article className="request-card" key={request.id}>
                          <span className="tag">{request.urgency}</span>
                          <h3>{request.title}</h3>
                          <p className="meta">
                            {request.aircraftType} · {request.departureAirport}
                            {request.arrivalAirport ? ` to ${request.arrivalAirport}` : ""} ·{" "}
                            {request.startDate} to {request.endDate}
                          </p>
                          <Link
                            className="btn small"
                            href={`/matches?requestId=${encodeURIComponent(request.id)}`}
                          >
                            View matches
                          </Link>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
