"use client";

import { useState } from "react";
import { requests } from "@crewlink/domain";
import AppNav from "../components/AppNav";

export default function RequestsPage() {
  const [createdTitle, setCreatedTitle] = useState("");

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Staffing requests</span>
              <h1>Capture mission requirements once.</h1>
              <p className="muted">
                Aircraft, dates, airports, qualifications, and urgency become
                the inputs for search and match ranking.
              </p>
            </div>
          </div>

          <section className="grid">
            <div className="card panel" style={{ gridColumn: "span 7" }}>
              <div className="panel-title">
                <h2>Open requests</h2>
              </div>
              <div className="list">
                {requests.map((request) => (
                  <article className="request-card" key={request.id}>
                    <span className="tag">{request.status}</span>
                    <h3>{request.title}</h3>
                    <p className="meta">
                      {request.aircraftType} · {request.requiredRole} ·{" "}
                      {request.departureAirport}
                      {request.arrivalAirport ? ` to ${request.arrivalAirport}` : ""} ·{" "}
                      {request.startDate} to {request.endDate}
                    </p>
                    <div className="chips">
                      {[
                        ...request.requiredTypeRatings,
                        ...request.requiredCertificates,
                        `${request.minimumTotalTime}+ TT`,
                        request.urgency,
                      ].map((chip) => (
                        <span className="pill" key={chip}>
                          {chip}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <form
              className="card panel request-form"
              style={{ gridColumn: "span 5" }}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setCreatedTitle(String(data.get("title") || "Draft request"));
                event.currentTarget.reset();
              }}
            >
              <div className="wide">
                <h2 style={{ margin: 0 }}>Create request</h2>
                <p className="muted">
                  Frontend draft creation is wired now; deployed API persistence
                  uses the CDK HTTP API.
                </p>
              </div>
              <input name="title" required placeholder="Trip title" />
              <input name="aircraftType" required placeholder="Aircraft type" />
              <input name="departureAirport" required placeholder="Departure airport" />
              <input name="arrivalAirport" placeholder="Arrival airport" />
              <input name="startDate" required type="date" />
              <input name="endDate" required type="date" />
              <select name="requiredRole" defaultValue="PIC">
                <option>PIC</option>
                <option>SIC</option>
                <option>Relief Pilot</option>
              </select>
              <select name="urgency" defaultValue="urgent">
                <option>standard</option>
                <option>urgent</option>
                <option>instant</option>
              </select>
              <textarea className="wide" name="tripNotes" placeholder="Duty notes, documents, travel expectations" />
              <button className="btn primary wide" type="submit">
                Save draft
              </button>
              {createdTitle && <p className="fineprint wide">Draft captured: {createdTitle}</p>}
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
