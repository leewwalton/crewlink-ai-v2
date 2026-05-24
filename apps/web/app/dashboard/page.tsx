import { pilots, rankPilotsForRequest, requests } from "@crewlink/domain";
import AppNav from "../components/AppNav";

export default function DashboardPage() {
  const activeRequest = requests[0];
  const topMatches = rankPilotsForRequest(activeRequest, pilots).slice(0, 3);
  const verifiedPilots = pilots.filter((pilot) => pilot.documentsStatus === "verified").length;

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Operator cockpit</span>
              <h1>Staffing demand, live readiness, and candidate fit.</h1>
              <p className="muted">
                Monitor urgent requests and identify qualified pilots before
                dispatch pressure turns into a scramble.
              </p>
            </div>
            <a className="btn primary page-header-action" href="/requests">
              Create request
            </a>
          </div>

          <section className="grid" style={{ marginBottom: 18 }}>
            <div className="card stat-card" style={{ gridColumn: "span 3" }}>
              <b>{requests.filter((request) => request.status === "open").length}</b>
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
              <b>{topMatches[0].score}%</b>
              <span>best current fit score</span>
            </div>
          </section>

          <section className="grid">
            <div className="card panel" style={{ gridColumn: "span 7" }}>
              <div className="panel-title">
                <h2>Recommended for {activeRequest.title}</h2>
                <a className="btn small" href="/matches">
                  View all
                </a>
              </div>
              <div className="list">
                {topMatches.map((match) => {
                  const pilot = pilots.find((candidate) => candidate.id === match.pilotId)!;
                  return (
                    <article className="match-card" key={match.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <h3>{pilot.name}</h3>
                          <p className="meta">
                            {pilot.role} · {pilot.homeBase} · {match.distanceNm} NM from departure
                          </p>
                        </div>
                        <span className="score">{match.score}%</span>
                      </div>
                      <p className="muted">{match.explanation}</p>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="card panel" style={{ gridColumn: "span 5" }}>
              <div className="panel-title">
                <h2>Urgent queue</h2>
                <a className="btn small" href="/requests">
                  Manage
                </a>
              </div>
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
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
