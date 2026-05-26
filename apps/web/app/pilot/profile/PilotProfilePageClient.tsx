"use client";

import { useEffect, useState } from "react";
import type { PilotProfile, PilotRole } from "@crewlink/domain";
import { fetchUserAttributes } from "aws-amplify/auth";
import AppNav from "../../components/AppNav";
import IcaoLookupField from "../../components/IcaoLookupField";
import AppAccess from "../../components/AppAccess";
import { loadPilotProfile, savePilotProfile } from "../../utils/api-client";

type FormState = {
  name: string;
  email: string;
  phone: string;
  alternatePhone: string;
  role: PilotRole;
  homeBase: string;
  aircraftTypes: string;
  typeRatings: string;
  certificates: string;
  medicalClass: PilotProfile["medicalClass"];
  totalTime: string;
  picTime: string;
  sicTime: string;
  contractPreference: PilotProfile["contractPreference"];
  travelRegions: string;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  alternatePhone: "",
  role: "PIC",
  homeBase: "",
  aircraftTypes: "",
  typeRatings: "",
  certificates: "",
  medicalClass: "First",
  totalTime: "",
  picTime: "",
  sicTime: "",
  contractPreference: "either",
  travelRegions: "",
};

function toForm(profile: PilotProfile): FormState {
  return {
    name: profile.name,
    email: profile.email,
    phone: profile.phone ?? "",
    alternatePhone: profile.alternatePhone ?? "",
    role: profile.role,
    homeBase: profile.homeBase,
    aircraftTypes: profile.aircraftTypes.join(", "),
    typeRatings: profile.typeRatings.join(", "),
    certificates: profile.certificates.join(", "),
    medicalClass: profile.medicalClass,
    totalTime: String(profile.totalTime || ""),
    picTime: String(profile.picTime || ""),
    sicTime: String(profile.sicTime || ""),
    contractPreference: profile.contractPreference,
    travelRegions: profile.travelRegions.join(", "),
  };
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function PilotProfilePageClient() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [profile, setProfile] = useState<PilotProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [existing, attributes] = await Promise.all([
          loadPilotProfile(),
          fetchUserAttributes().catch(() => ({})),
        ]);
        if (!active) return;

        if (existing) {
          setProfile(existing);
          setForm(toForm(existing));
        } else {
          const name =
            "name" in attributes && typeof attributes.name === "string"
              ? attributes.name
              : "";
          const email =
            "email" in attributes && typeof attributes.email === "string"
              ? attributes.email
              : "";
          setForm((current) => ({
            ...current,
            name: name || current.name,
            email: email || current.email,
          }));
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load profile.");
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSavedMessage("");

    try {
      const result = await savePilotProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        alternatePhone: form.alternatePhone.trim() || undefined,
        role: form.role,
        homeBase: form.homeBase.trim(),
        aircraftTypes: parseList(form.aircraftTypes),
        typeRatings: parseList(form.typeRatings),
        certificates: parseList(form.certificates),
        medicalClass: form.medicalClass,
        totalTime: Number(form.totalTime || 0),
        picTime: Number(form.picTime || 0),
        sicTime: Number(form.sicTime || 0),
        contractPreference: form.contractPreference,
        travelRegions: parseList(form.travelRegions),
        availability: [],
        documentsStatus: profile?.documentsStatus || "review",
        currentLocation: profile?.currentLocation,
      });
      setProfile(result.profile);
      setForm(toForm(result.profile));
      setSavedMessage("Pilot profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppAccess area="pilot" authMessage="Sign in to manage your pilot profile.">
      <div className="app-shell">
        <AppNav />
        <main className="app-main">
          <div className="container">
            <div className="page-header">
              <div>
                <span className="tag">Pilot profile</span>
                <h1>Profile</h1>
              </div>
            </div>

            {loading ? (
              <section className="card panel">
                <p className="muted">Loading profile...</p>
              </section>
            ) : (
              <section className="grid">
                <form
                  className="card panel request-form"
                  style={{ gridColumn: "span 7" }}
                  onSubmit={handleSubmit}
                >
                  <div className="wide">
                    <h2 style={{ margin: 0 }}>Pilot details</h2>
                  </div>
                  <input
                    required
                    placeholder="Full name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        role: event.target.value as PilotRole,
                      }))
                    }
                  >
                    <option value="PIC">PIC</option>
                    <option value="SIC">SIC</option>
                    <option value="Relief Pilot">Relief Pilot</option>
                  </select>
                  <IcaoLookupField
                    kind="airport"
                    value={form.homeBase}
                    onChange={(value) => setForm((current) => ({ ...current, homeBase: value }))}
                    placeholder="Home base (e.g. KTEB)"
                    aria-label="Home base"
                    required
                  />
                  <IcaoLookupField
                    kind="aircraft"
                    value={form.aircraftTypes}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, aircraftTypes: value }))
                    }
                    placeholder="Primary aircraft type (e.g. G650)"
                    aria-label="Aircraft types"
                  />
                  <input
                    placeholder="Type ratings (comma separated)"
                    value={form.typeRatings}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, typeRatings: event.target.value }))
                    }
                  />
                  <input
                    placeholder="Certificates (comma separated)"
                    value={form.certificates}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, certificates: event.target.value }))
                    }
                  />
                  <select
                    value={form.medicalClass}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        medicalClass: event.target.value as PilotProfile["medicalClass"],
                      }))
                    }
                  >
                    <option value="First">First class medical</option>
                    <option value="Second">Second class medical</option>
                    <option value="Third">Third class medical</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    placeholder="Total time"
                    value={form.totalTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, totalTime: event.target.value }))
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="PIC time"
                    value={form.picTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, picTime: event.target.value }))
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="SIC time"
                    value={form.sicTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sicTime: event.target.value }))
                    }
                  />
                  <select
                    value={form.contractPreference}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        contractPreference: event.target
                          .value as PilotProfile["contractPreference"],
                      }))
                    }
                  >
                    <option value="contract">Contract</option>
                    <option value="full-time">Full-time</option>
                    <option value="either">Either</option>
                  </select>
                  <input
                    placeholder="Travel regions (comma separated)"
                    value={form.travelRegions}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, travelRegions: event.target.value }))
                    }
                  />

                  <div className="wide">
                    <h2 style={{ margin: "8px 0 0" }}>Contact information</h2>
                  </div>
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                  <input
                    type="tel"
                    placeholder="Alternate phone"
                    value={form.alternatePhone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, alternatePhone: event.target.value }))
                    }
                  />

                  <button className="btn primary wide" type="submit" disabled={saving}>
                    {saving ? "Saving..." : profile ? "Update profile" : "Save profile"}
                  </button>
                  {savedMessage && <p className="fineprint wide">{savedMessage}</p>}
                  {error && <p className="fineprint wide">{error}</p>}
                </form>

                <div className="card panel" style={{ gridColumn: "span 5" }}>
                  <h2>Next steps</h2>
                  <div className="list">
                    <p>1. Save your pilot profile</p>
                    <p>2. Keep contact details current</p>
                    <p>3. Respond to operator outreach</p>
                  </div>
                  {profile && (
                    <>
                      <h2 style={{ marginTop: 24 }}>Saved</h2>
                      <div className="chips">
                        {[
                          profile.homeBase,
                          ...profile.aircraftTypes,
                          ...profile.typeRatings,
                          profile.contractPreference,
                        ].map((chip) => (
                          <span className="pill" key={chip}>
                            {chip}
                          </span>
                        ))}
                      </div>
                      <p className="meta" style={{ marginTop: 16 }}>
                        Email: {profile.email}
                      </p>
                      {profile.phone && (
                        <p className="meta">Phone: {profile.phone}</p>
                      )}
                      <p className="meta" style={{ marginTop: profile.phone ? 0 : 16 }}>
                        Documents: {profile.documentsStatus}
                      </p>
                    </>
                  )}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </AppAccess>
  );
}
