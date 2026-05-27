"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import type { AccountType } from "@crewlink/domain";
import { useAccount } from "../contexts/AccountContext";
import { setActivePersona, type ActivePersona } from "../utils/account-access";
import "./ProfileMenu.css";

function AccountTypeIcon({
  accountType,
  large = false,
}: {
  accountType: AccountType | null;
  large?: boolean;
}) {
  const className = large ? "profile-menu-icon-large" : undefined;

  switch (accountType) {
    case "operator":
      return (
        <span className={className} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 20h16M6 20V9l6-5 6 5v11" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 20v-5h4v5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case "pilot":
      return (
        <span className={className} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10.18 9.01 3 8.25l1.2 1.2 6.3-.75 2.25-2.25L21 3l-3 8.25-2.25 2.25-.75 6.3 1.2 1.2-.75-7.18-2.83 2.83 1.06 3.18-1.77.53-.53-1.77-3.18 1.06-3.18-2.83 2.83Z" />
          </svg>
        </span>
      );
    case "both":
      return (
        <span className={className} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 18h7M13 18h7" strokeLinecap="round" />
            <path d="M6.5 18V10l3.5-2.5L13.5 10v8" strokeLinejoin="round" />
            <path d="M16.5 11.5 20 9l1 3-3 1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case "admin":
      return (
        <span className={className} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M12 3 4 7v6c0 5 3.5 7.5 8 8 4.5-.5 8-3 8-8V7l-8-4Z"
              strokeLinejoin="round"
            />
            <path d="M9.5 12.5 11 14l3.5-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    default:
      return (
        <span className={className} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M5 20c1.5-3.5 4.5-5 7-5s5.5 1.5 7 5" strokeLinecap="round" />
          </svg>
        </span>
      );
  }
}

export default function ProfileMenu() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const {
    loading,
    authenticated,
    account,
    accountType,
    label,
    canOperator,
    canPilot,
    activePersona,
    setPersona,
  } = useAccount();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (loading || !authenticated || !accountType) return null;

  function switchPersona(persona: ActivePersona) {
    setPersona(persona);
    setActivePersona(persona);
  }

  async function handleSignOut() {
    setOpen(false);
    try {
      await signOut();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className="nav-pill nav-pill-icon profile-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu, ${label}`}
        onClick={() => setOpen((current) => !current)}
      >
        <AccountTypeIcon accountType={accountType} />
      </button>

      {open && (
        <div className="profile-menu-panel" role="menu">
          <div className="profile-menu-header">
            <AccountTypeIcon accountType={accountType} large />
            <div>
              <strong>{label}</strong>
              <span>{account?.email}</span>
            </div>
          </div>

          {accountType === "both" && (
            <div className="profile-menu-section">
              <p className="profile-menu-label">Active view</p>
              <div className="profile-menu-persona">
                <button
                  type="button"
                  className={`nav-pill${activePersona === "operator" ? " is-active" : ""}`}
                  onClick={() => switchPersona("operator")}
                >
                  Operator
                </button>
                <button
                  type="button"
                  className={`nav-pill${activePersona === "pilot" ? " is-active" : ""}`}
                  onClick={() => switchPersona("pilot")}
                >
                  Pilot
                </button>
              </div>
            </div>
          )}

          <div className="profile-menu-links">
            {canOperator && (
              <a href="/profile" role="menuitem" onClick={() => setOpen(false)}>
                Operator profile
              </a>
            )}
            {canPilot && (
              <a href="/pilot/profile" role="menuitem" onClick={() => setOpen(false)}>
                Pilot profile
              </a>
            )}
          </div>

          <button
            type="button"
            className="profile-menu-logout"
            role="menuitem"
            onClick={handleSignOut}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
