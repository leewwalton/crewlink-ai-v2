"use client";

import { useMemo, useState } from "react";
import { pilots, searchPilots } from "@crewlink/domain";
import AppNav from "../components/AppNav";

export default function PilotsPage() {
  const [aircraftType, setAircraftType] = useState("");
  const [rating, setRating] = useState("");
  const [certificate, setCertificate] = useState("");
  const [availableStart, setAvailableStart] = useState("");
  const [availableEnd, setAvailableEnd] = useState("");

  const filteredPilots = useMemo(
    () =>
      searchPilots(pilots, {
        aircraftType: aircraftType || undefined,
        rating: rating || undefined,
        certificate: certificate || undefined,
        availableStart: availableStart || undefined,
        availableEnd: availableEnd || undefined,
      }),
    [aircraftType, rating, certificate, availableStart, availableEnd],
  );

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Pilot discovery</span>
              <h1>Pilots</h1>
            </div>
          </div>

          <section className="card panel">
            <div className="filters">
              <input
                placeholder="Aircraft type (G650)"
                value={aircraftType}
                onChange={(event) => setAircraftType(event.target.value)}
              />
              <input
                placeholder="Type rating (G-VI)"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
              />
              <input
                placeholder="Certificate (ATP)"
                value={certificate}
                onChange={(event) => setCertificate(event.target.value)}
              />
              <input
                type="date"
                value={availableStart}
                onChange={(event) => setAvailableStart(event.target.value)}
              />
              <input
                type="date"
                value={availableEnd}
                onChange={(event) => setAvailableEnd(event.target.value)}
              />
            </div>

            <div className="list">
              {filteredPilots.map((pilot) => (
                <article className="pilot-card" key={pilot.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <h3>{pilot.name}</h3>
                      <p className="meta">
                        {pilot.role} · {pilot.homeBase} · {pilot.currentLocation.label} ·{" "}
                        {pilot.totalTime.toLocaleString()} total hours
                      </p>
                    </div>
                    <span className="tag">{pilot.documentsStatus}</span>
                  </div>
                  <div className="chips">
                    {[
                      ...pilot.aircraftTypes,
                      ...pilot.typeRatings,
                      ...pilot.certificates,
                      pilot.medicalClass,
                      pilot.contractPreference,
                    ].map((chip) => (
                      <span className="pill" key={chip}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
