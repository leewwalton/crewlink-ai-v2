"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PilotMatch, PilotProfile, StaffingRequest } from "@crewlink/domain";
import AppNav from "../components/AppNav";
import { getMatches, listPilots, listRequests } from "../utils/api-client";
import { buildMessagePilotHref } from "../utils/messaging-client";

export default function MatchesPageClient() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("requestId");

  const [requests, setRequests] = useState<StaffingRequest[]>([]);
  const [pilots, setPilots] = useState<PilotProfile[]>([]);
  const [matches, setMatches] = useState<PilotMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeRequest = useMemo(() => {
    if (requests.length === 0) return null;
    if (requestedId) {
      return requests.find((request) => request.id === requestedId) || requests[0];
    }
    return requests[0];
  }, [requests, requestedId]);

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

        const focusRequest = requestedId
          ? requestResult.requests.find((request) => request.id === requestedId) ||
            requestResult.requests[0]
          : requestResult.requests[0];

        if (!focusRequest) {
          setMatches([]);
          return;
        }

        const matchResult = await getMatches(focusRequest.id);
        if (active) {
          setMatches(matchResult.matches);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load matches.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [requestedId]);

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Explainable matches</span>
              <h1>Matches</h1>
            </div>
          </div>

          {requests.length > 1 && activeRequest && (
            <section className="card panel" style={{ marginBottom: 18 }}>
              <label className="muted" htmlFor="request-select">
                Staffing request
              </label>
              <select
                id="request-select"
                className="wide"
                value={activeRequest.id}
                onChange={(event) => {
                  window.location.href = `/matches?requestId=${encodeURIComponent(event.target.value)}`;
                }}
              >
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.title}
                  </option>
                ))}
              </select>
            </section>
          )}

          {loading ? (
            <section className="card panel">
              <p className="muted">Loading matches...</p>
            </section>
          ) : !activeRequest ? (
            <section className="card panel">
              <h2>No staffing requests yet</h2>
              <p className="muted">
                Create a request first, then return here to review ranked pilot matches.
              </p>
              <a className="btn primary" href="/requests">
                Create request
              </a>
            </section>
          ) : (
            <section className="card panel">
              <div className="panel-title">
                <div>
                  <h2>{activeRequest.title}</h2>
                  <p className="meta">
                    {activeRequest.aircraftType} · {activeRequest.departureAirport} ·{" "}
                    {activeRequest.startDate} to {activeRequest.endDate}
                  </p>
                </div>
              </div>
              {error && <p className="fineprint">{error}</p>}
              {matches.length === 0 ? (
                <p className="muted">No matches available for this request.</p>
              ) : (
                <div className="list">
                  {matches.map((match) => {
                    const pilot = pilots.find((candidate) => candidate.id === match.pilotId);
                    if (!pilot) return null;
                    const messageHref = buildMessagePilotHref({
                      pilotId: pilot.id,
                      pilotName: pilot.name,
                      requestTitle: activeRequest.title,
                      matchId: match.id,
                    });
                    return (
                      <article className="match-card" key={match.id}>
                        <div
                          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                        >
                          <div>
                            <h3>{pilot.name}</h3>
                            <p className="meta">
                              {pilot.role} · {pilot.homeBase} · {match.distanceNm} NM ·{" "}
                              {pilot.documentsStatus}
                            </p>
                          </div>
                          <span className="score">{match.score}%</span>
                        </div>
                        <p className="muted">{match.explanation}</p>
                        <div className="chips">
                          {match.factors.map((factor) => (
                            <span className="pill" key={factor.label}>
                              {factor.label}: {factor.score}/{factor.maxScore}
                            </span>
                          ))}
                        </div>
                        {match.missingRequirements.length > 0 && (
                          <p className="fineprint">
                            Review: {match.missingRequirements.join(", ")}
                          </p>
                        )}
                        <div className="hero-actions" style={{ marginTop: 14 }}>
                          <Link className="btn primary" href={messageHref}>
                            Message pilot
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
