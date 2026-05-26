"use client";

import { useEffect, useState } from "react";
import type { OperatorProfile, StaffingRequest } from "@crewlink/domain";
import AppNav from "../components/AppNav";
import AppAccess from "../components/AppAccess";
import DatePickerField from "../components/DatePickerField";
import IcaoLookupField from "../components/IcaoLookupField";
import {
  createStaffingRequest,
  listRequests,
  loadOperatorProfile,
  updateStaffingRequest,
} from "../utils/api-client";
import { resolveAirportCoords } from "../hooks/useAirportCoords";
import { airportToLocationSnapshot } from "../utils/airport-coords";

type RequestFormState = {
  title: string;
  aircraftType: string;
  departureAirport: string;
  arrivalAirport: string;
  startDate: string;
  endDate: string;
  requiredRole: StaffingRequest["requiredRole"];
  urgency: StaffingRequest["urgency"];
  status: StaffingRequest["status"];
  requiredTypeRatings: string;
  minimumTotalTime: string;
  tripNotes: string;
};

const emptyForm: RequestFormState = {
  title: "",
  aircraftType: "",
  departureAirport: "",
  arrivalAirport: "",
  startDate: "",
  endDate: "",
  requiredRole: "PIC",
  urgency: "standard",
  status: "open",
  requiredTypeRatings: "",
  minimumTotalTime: "2500",
  tripNotes: "",
};

function toForm(request: StaffingRequest): RequestFormState {
  return {
    title: request.title,
    aircraftType: request.aircraftType,
    departureAirport: request.departureAirport,
    arrivalAirport: request.arrivalAirport ?? "",
    startDate: request.startDate,
    endDate: request.endDate,
    requiredRole: request.requiredRole,
    urgency: request.urgency,
    status: request.status,
    requiredTypeRatings: request.requiredTypeRatings.join(", "),
    minimumTotalTime: String(request.minimumTotalTime || 2500),
    tripNotes: request.tripNotes,
  };
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<StaffingRequest[]>([]);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RequestFormState>(emptyForm);
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

  function startEdit(request: StaffingRequest) {
    setEditingId(request.id);
    setForm(toForm(request));
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) {
      setError("Set up your operator profile before creating requests.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (!form.aircraftType.trim() || !form.departureAirport.trim()) {
      setError("Aircraft type and departure airport are required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const departureCode = form.departureAirport.trim();
      const airport = await resolveAirportCoords(departureCode);
      const location = airport
        ? airportToLocationSnapshot(airport)
        : {
            id: editingId ? `loc-${editingId}` : `loc-${Date.now()}`,
            label: departureCode,
            latitude: 0,
            longitude: 0,
            sourceTimestamp: new Date().toISOString(),
            precision: "airport" as const,
          };

      const payload = {
        title: form.title.trim(),
        aircraftType: form.aircraftType.trim(),
        departureAirport: departureCode,
        arrivalAirport: form.arrivalAirport.trim() || undefined,
        location,
        startDate: form.startDate,
        endDate: form.endDate,
        requiredRole: form.requiredRole,
        urgency: form.urgency,
        status: form.status,
        requiredTypeRatings: form.requiredTypeRatings
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        minimumTotalTime: Number(form.minimumTotalTime || 2500),
        tripNotes: form.tripNotes.trim(),
      };

      const result = editingId
        ? await updateStaffingRequest(editingId, payload)
        : await createStaffingRequest(payload);

      setRequests((current) => {
        if (editingId) {
          return current.map((request) =>
            request.id === editingId ? result.request : request,
          );
        }
        return [result.request, ...current];
      });
      setSuccess(
        editingId
          ? `Request updated: ${result.request.title}`
          : `Request saved: ${result.request.title}`,
      );
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppAccess area="operator" authMessage="Sign in to manage staffing requests.">
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
                    <article
                      className="request-card"
                      key={request.id}
                      style={
                        editingId === request.id
                          ? { borderColor: "rgba(30, 165, 240, 0.45)" }
                          : undefined
                      }
                    >
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
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                        <button
                          className="btn small"
                          type="button"
                          onClick={() => startEdit(request)}
                          disabled={submitting}
                        >
                          Edit
                        </button>
                        <a className="btn small" href={`/matches?requestId=${request.id}`}>
                          View matches
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <form
              className="card panel request-form"
              style={{ gridColumn: "span 5" }}
              onSubmit={handleSubmit}
            >
              <div className="wide panel-title">
                <h2 style={{ margin: 0 }}>{editingId ? "Edit request" : "Create request"}</h2>
                {editingId && (
                  <button className="btn small" type="button" onClick={cancelEdit} disabled={submitting}>
                    Cancel
                  </button>
                )}
              </div>
              <input
                required
                placeholder="Trip title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                disabled={!profile || submitting}
              />
              <IcaoLookupField
                kind="aircraft"
                value={form.aircraftType}
                onChange={(value) => setForm((current) => ({ ...current, aircraftType: value }))}
                placeholder="Aircraft type (e.g. G650, C172)"
                aria-label="Aircraft type"
                disabled={!profile || submitting}
                required
              />
              <IcaoLookupField
                kind="airport"
                value={form.departureAirport}
                onChange={(value) => setForm((current) => ({ ...current, departureAirport: value }))}
                placeholder="Departure airport (e.g. KIAH)"
                aria-label="Departure airport"
                disabled={!profile || submitting}
                required
              />
              <IcaoLookupField
                kind="airport"
                value={form.arrivalAirport}
                onChange={(value) => setForm((current) => ({ ...current, arrivalAirport: value }))}
                placeholder="Arrival airport (e.g. KJFK)"
                aria-label="Arrival airport"
                disabled={!profile || submitting}
              />
              <DatePickerField
                value={form.startDate}
                onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
                placeholder="Start date"
                aria-label="Start date"
                disabled={!profile || submitting}
              />
              <DatePickerField
                value={form.endDate}
                onChange={(value) => setForm((current) => ({ ...current, endDate: value }))}
                placeholder="End date"
                aria-label="End date"
                disabled={!profile || submitting}
              />
              <select
                value={form.requiredRole}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requiredRole: event.target.value as StaffingRequest["requiredRole"],
                  }))
                }
                disabled={!profile || submitting}
              >
                <option value="PIC">PIC</option>
                <option value="SIC">SIC</option>
                <option value="Relief Pilot">Relief Pilot</option>
              </select>
              <select
                value={form.urgency}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    urgency: event.target.value as StaffingRequest["urgency"],
                  }))
                }
                disabled={!profile || submitting}
              >
                <option value="standard">standard</option>
                <option value="urgent">urgent</option>
                <option value="instant">instant</option>
              </select>
              {editingId && (
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as StaffingRequest["status"],
                    }))
                  }
                  disabled={!profile || submitting}
                >
                  <option value="draft">draft</option>
                  <option value="open">open</option>
                  <option value="reviewing">reviewing</option>
                  <option value="filled">filled</option>
                  <option value="cancelled">cancelled</option>
                </select>
              )}
              <input
                placeholder="Type ratings (comma separated)"
                value={form.requiredTypeRatings}
                onChange={(event) =>
                  setForm((current) => ({ ...current, requiredTypeRatings: event.target.value }))
                }
                disabled={!profile || submitting}
              />
              <input
                type="number"
                min={0}
                placeholder="Minimum total time"
                value={form.minimumTotalTime}
                onChange={(event) =>
                  setForm((current) => ({ ...current, minimumTotalTime: event.target.value }))
                }
                disabled={!profile || submitting}
              />
              <textarea
                className="wide"
                placeholder="Duty notes, documents, travel expectations"
                value={form.tripNotes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tripNotes: event.target.value }))
                }
                disabled={!profile || submitting}
              />
              <button className="btn primary wide" type="submit" disabled={!profile || submitting}>
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Update request"
                    : "Save request"}
              </button>
              {success && <p className="fineprint wide">{success}</p>}
              {error && <p className="fineprint wide">{error}</p>}
            </form>
          </section>
        </div>
      </main>
    </div>
    </AppAccess>
  );
}
