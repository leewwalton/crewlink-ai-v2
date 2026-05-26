"use client";

import { useEffect, useState } from "react";
import type { OperatorProfile } from "@crewlink/domain";
import { fetchUserAttributes } from "aws-amplify/auth";
import AppNav from "../components/AppNav";
import AppAccess from "../components/AppAccess";
import { loadOperatorProfile, saveOperatorProfile } from "../utils/api-client";

type FormState = {
  organization: string;
  contactName: string;
  email: string;
  fleetTypes: string;
  operatingRegions: string;
};

const emptyForm: FormState = {
  organization: "",
  contactName: "",
  email: "",
  fleetTypes: "",
  operatingRegions: "",
};

function toForm(profile: OperatorProfile): FormState {
  return {
    organization: profile.organization,
    contactName: profile.contactName,
    email: profile.email,
    fleetTypes: profile.fleetTypes.join(", "),
    operatingRegions: profile.operatingRegions.join(", "),
  };
}

export default function ProfilePageClient() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
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
          loadOperatorProfile(),
          fetchUserAttributes().catch(() => ({})),
        ]);
        if (!active) return;

        if (existing) {
          setProfile(existing);
          setForm(toForm(existing));
        } else {
          const email =
            "email" in attributes && typeof attributes.email === "string"
              ? attributes.email
              : "";
          setForm((current) => ({
            ...current,
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
      const result = await saveOperatorProfile({
        organization: form.organization.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        fleetTypes: form.fleetTypes
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        operatingRegions: form.operatingRegions
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        status: profile?.status || "trial",
      });
      setProfile(result.profile);
      setForm(toForm(result.profile));
      setSavedMessage("Operator profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppAccess area="operator" authMessage="Sign in to manage your operator profile.">
      <div className="app-shell">
      <AppNav />
      <main className="app-main">
        <div className="container">
          <div className="page-header">
            <div>
              <span className="tag">Operator profile</span>
              <h1>Profile</h1>
            </div>
            {profile && (
              <a className="btn primary page-header-action" href="/requests">
                Create request
              </a>
            )}
          </div>

          {loading ? (
            <section className="card panel">
              <p className="muted">Loading profile...</p>
            </section>
          ) : (
            <section className="grid">
              <form className="card panel request-form" style={{ gridColumn: "span 7" }} onSubmit={handleSubmit}>
                <div className="wide">
                  <h2 style={{ margin: 0 }}>Organization details</h2>
                </div>
                <input
                  required
                  placeholder="Organization name"
                  value={form.organization}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, organization: event.target.value }))
                  }
                />
                <input
                  required
                  placeholder="Primary contact name"
                  value={form.contactName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, contactName: event.target.value }))
                  }
                />
                <input
                  required
                  type="email"
                  placeholder="Operations email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
                <input
                  placeholder="Fleet types (comma separated, e.g. G650, CL350)"
                  value={form.fleetTypes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, fleetTypes: event.target.value }))
                  }
                />
                <input
                  placeholder="Operating regions (comma separated)"
                  value={form.operatingRegions}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, operatingRegions: event.target.value }))
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
                  <p>1. Save profile</p>
                  <p>2. Create requests</p>
                  <p>3. Review matches</p>
                </div>
                {profile && (
                  <>
                    <h2 style={{ marginTop: 24 }}>Saved</h2>
                    <div className="chips">
                      {[...profile.fleetTypes, ...profile.operatingRegions].map((chip) => (
                        <span className="pill" key={chip}>
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p className="meta" style={{ marginTop: 16 }}>
                      Status: {profile.status}
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
