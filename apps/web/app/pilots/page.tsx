"use client";

import { useEffect, useMemo, useState } from "react";
import { searchPilots, type PilotProfile } from "@crewlink/domain";
import AppNav from "../components/AppNav";
import DatePickerField from "../components/DatePickerField";
import IcaoLookupField from "../components/IcaoLookupField";
import { listPilots } from "../utils/api-client";

export default function PilotsPage() {
  const [pilots, setPilots] = useState<PilotProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aircraftType, setAircraftType] = useState("");
  const [rating, setRating] = useState("");
  const [certificate, setCertificate] = useState("");
  const [availableStart, setAvailableStart] = useState("");
  const [availableEnd, setAvailableEnd] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await listPilots();
        if (active) setPilots(result.pilots);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load pilots.");
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

  const filteredPilots = useMemo(
    () =>
      searchPilots(pilots, {
        aircraftType: aircraftType || undefined,
        rating: rating || undefined,
        certificate: certificate || undefined,
        availableStart: availableStart || undefined,
        availableEnd: availableEnd || undefined,
      }),
    [pilots, aircraftType, rating, certificate, availableStart, availableEnd],
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
              <IcaoLookupField
                kind="aircraft"
                value={aircraftType}
                onChange={setAircraftType}
                placeholder="Aircraft type (G650)"
                aria-label="Aircraft type"
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
              <DatePickerField
                value={availableStart}
                onChange={setAvailableStart}
                placeholder="Available from"
                aria-label="Available from"
              />
              <DatePickerField
                value={availableEnd}
                onChange={setAvailableEnd}
                placeholder="Available to"
                aria-label="Available to"
              />
            </div>

            {loading ? (
              <p className="muted">Loading pilots...</p>
            ) : error ? (
              <p className="fineprint">{error}</p>
            ) : filteredPilots.length === 0 ? (
              <p className="muted">No pilots match these filters yet.</p>
            ) : (
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
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
