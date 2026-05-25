"use client";

import { useEffect, useState } from "react";
import type { OperatorProfile, StaffingRequest } from "@crewlink/domain";
import AppNav from "../components/AppNav";
import DatePickerField from "../components/DatePickerField";
import {
  createStaffingRequest,
  listRequests,
  loadOperatorProfile,
} from "../utils/api-client";

export default function RequestsPage() {
  const [requests, setRequests] = useState<StaffingRequest[]>([]);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [profileResult, requestResult] = await Promise.all([
        loadOperatorProfile(),
        listRequests(),
      ]);
      setProfile(profileResult);
      setRequests(requestResult.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Staffing requests</span>
              <h1>Requests</h1>
            </div>
          </div>

          {!loading && !profile && (
            <section className="card panel" style={{ marginBottom: 18 }}>
              <h2>Complete your profile first</h2>
              <p className="muted">Save your operator profile before creating requests.</p>
              <a className="btn primary" href="/profile">
                Set up profile
              </a>
            </section>
          )}

          <section className="grid">
            <div className="card panel" style={{ gridColumn: "span 7" }}>
              <div className="panel-title">
                <h2>Your requests</h2>
              </div>
              {loading ? (
                <p className="muted">Loading requests...</p>
              ) : requests.length === 0 ? (
                <p className="muted">
                  No requests yet. Create your first staffing request on the right.
                </p>
              ) : (
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
                          <span className="pill" key={`${request.id}-${chip}`}>
                            {chip}
                          </span>
                        ))}
                      </div>
                      <a className="btn small" href={`/matches?requestId=${request.id}`}>
                        View matches
                      </a>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <form
              className="card panel request-form"
              style={{ gridColumn: "span 5" }}
              onSubmit={async (event) => {
                event.preventDefault();
                if (!profile) {
                  setError("Set up your operator profile before creating requests.");
                  return;
                }
                if (!startDate || !endDate) {
                  setError("Start and end dates are required.");
                  return;
                }

                setSubmitting(true);
                setError("");
                setSuccess("");

                const data = new FormData(event.currentTarget);
                try {
                  const result = await createStaffingRequest({
                    title: String(data.get("title") || ""),
                    aircraftType: String(data.get("aircraftType") || ""),
                    departureAirport: String(data.get("departureAirport") || ""),
                    arrivalAirport: String(data.get("arrivalAirport") || "") || undefined,
                    startDate,
                    endDate,
                    requiredRole: String(data.get("requiredRole") || "PIC") as StaffingRequest["requiredRole"],
                    urgency: String(data.get("urgency") || "standard") as StaffingRequest["urgency"],
                    requiredTypeRatings: String(data.get("requiredTypeRatings") || "")
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter(Boolean),
                    minimumTotalTime: Number(data.get("minimumTotalTime") || 2500),
                    tripNotes: String(data.get("tripNotes") || ""),
                    status: "open",
                  });
                  setRequests((current) => [result.request, ...current]);
                  setSuccess(`Request saved: ${result.request.title}`);
                  event.currentTarget.reset();
                  setStartDate("");
                  setEndDate("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to save request.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <div className="wide">
                <h2 style={{ margin: 0 }}>Create request</h2>
              </div>
              <input name="title" required placeholder="Trip title" disabled={!profile || submitting} />
              <input name="aircraftType" required placeholder="Aircraft type" disabled={!profile || submitting} />
              <input name="departureAirport" required placeholder="Departure airport" disabled={!profile || submitting} />
              <input name="arrivalAirport" placeholder="Arrival airport" disabled={!profile || submitting} />
              <DatePickerField
                name="startDate"
                value={startDate}
                onChange={setStartDate}
                placeholder="Start date"
                aria-label="Start date"
                disabled={!profile || submitting}
              />
              <DatePickerField
                name="endDate"
                value={endDate}
                onChange={setEndDate}
                placeholder="End date"
                aria-label="End date"
                disabled={!profile || submitting}
              />
              <select name="requiredRole" defaultValue="PIC" disabled={!profile || submitting}>
                <option>PIC</option>
                <option>SIC</option>
                <option>Relief Pilot</option>
              </select>
              <select name="urgency" defaultValue="standard" disabled={!profile || submitting}>
                <option>standard</option>
                <option>urgent</option>
                <option>instant</option>
              </select>
              <input
                name="requiredTypeRatings"
                placeholder="Type ratings (comma separated)"
                disabled={!profile || submitting}
              />
              <input
                name="minimumTotalTime"
                type="number"
                min={0}
                defaultValue={2500}
                placeholder="Minimum total time"
                disabled={!profile || submitting}
              />
              <textarea
                className="wide"
                name="tripNotes"
                placeholder="Duty notes, documents, travel expectations"
                disabled={!profile || submitting}
              />
              <button className="btn primary wide" type="submit" disabled={!profile || submitting}>
                {submitting ? "Saving..." : "Save request"}
              </button>
              {success && <p className="fineprint wide">{success}</p>}
              {error && <p className="fineprint wide">{error}</p>}
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
