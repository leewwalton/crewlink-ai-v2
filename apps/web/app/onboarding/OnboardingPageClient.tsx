"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AccountType } from "@crewlink/domain";
import { accountTypeLabel } from "@crewlink/domain";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import RequireAuth from "../components/RequireAuth";
import { useAccount } from "../contexts/AccountContext";
import { saveAccountType } from "../utils/api-client";
import { defaultHomePath } from "../utils/account-access";
import "../components/AuthPage.css";

const ACCOUNT_OPTIONS: {
  type: AccountType;
  title: string;
  description: string;
}[] = [
  {
    type: "operator",
    title: "Operator",
    description: "Staff trips, review matches, and manage your flight department profile.",
  },
  {
    type: "pilot",
    title: "Pilot",
    description: "Maintain your qualifications, availability, and respond to operator outreach.",
  },
  {
    type: "both",
    title: "Both",
    description: "Use operator tools and pilot profile tools with one CrewLinkAI account.",
  },
];

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshAccount, accountType } = useAccount();
  const [selected, setSelected] = useState<AccountType>("operator");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (accountType) {
    const nextPath = searchParams.get("next") || defaultHomePath(accountType);
    router.replace(nextPath.startsWith("/") ? nextPath : defaultHomePath(accountType));
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await saveAccountType(selected);
      await refreshAccount();
      const nextPath = searchParams.get("next") || defaultHomePath(result.accountType);
      router.replace(nextPath.startsWith("/") ? nextPath : defaultHomePath(result.accountType));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account type.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-header-top">
            <Logo showText={false} />
            <ThemeToggle />
          </div>
          <span className="tag">Account setup</span>
          <h1>Choose your CrewLinkAI experience</h1>
          <p className="auth-tagline">
            Pick how you will use CrewLinkAI. This controls which areas of the app you can
            access. Admin accounts are assigned separately by CrewLinkAI staff.
          </p>
        </div>

        <form className="card panel request-form" onSubmit={handleSubmit}>
          <div className="wide">
            {ACCOUNT_OPTIONS.map((option) => (
              <label
                key={option.type}
                className="card panel"
                style={{
                  display: "grid",
                  gap: 8,
                  marginBottom: 12,
                  cursor: "pointer",
                  borderColor:
                    selected === option.type
                      ? "rgba(30, 165, 240, 0.58)"
                      : "var(--line)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="radio"
                    name="accountType"
                    value={option.type}
                    checked={selected === option.type}
                    onChange={() => setSelected(option.type)}
                  />
                  <strong>{option.title}</strong>
                  <span className="pill">{accountTypeLabel(option.type)}</span>
                </span>
                <span className="muted">{option.description}</span>
              </label>
            ))}
          </div>
          <button className="btn primary wide" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Continue"}
          </button>
          {error && <p className="fineprint wide">{error}</p>}
        </form>
      </div>
    </main>
  );
}

export default function OnboardingPageClient() {
  return (
    <RequireAuth loadingMessage="Sign in to set up your account.">
      <OnboardingForm />
    </RequireAuth>
  );
}
