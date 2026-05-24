"use client";

import Link from "next/link";
import { pilots, rankPilotsForRequest, requests } from "@crewlink/domain";
import AppNav from "../components/AppNav";

export default function MatchesPage() {
  const request = requests[0];
  const matches = rankPilotsForRequest(request, pilots);

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Explainable matches</span>
              <h1>Rank candidates by operational fit.</h1>
              <p className="muted">
                Match score stays deterministic for auditability. AI can be
                layered on for natural-language summaries without owning the score.
              </p>
            </div>
          </div>

          <section className="card panel">
            <div className="panel-title">
              <div>
                <h2>{request.title}</h2>
                <p className="meta">
                  {request.aircraftType} · {request.departureAirport} ·{" "}
                  {request.startDate} to {request.endDate}
                </p>
              </div>
            </div>
            <div className="list">
              {matches.map((match) => {
                const pilot = pilots.find((candidate) => candidate.id === match.pilotId)!;
                const messageHref = `/messages?recipientId=${encodeURIComponent(pilot.id)}&recipientName=${encodeURIComponent(pilot.name)}&title=${encodeURIComponent(`${request.title} · ${pilot.name}`)}&contextId=${encodeURIComponent(match.id)}`;
                return (
                  <article className="match-card" key={match.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
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
          </section>
        </div>
      </main>
    </div>
  );
}
