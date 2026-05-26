"use client";

import Logo from "./Logo";
import SignOutButton from "./SignOutButton";
import ThemeToggle from "./ThemeToggle";
import { useAccount } from "../contexts/AccountContext";
import { setActivePersona, type ActivePersona } from "../utils/account-access";

const sharedLinks = [
  ["Map", "/map"],
  ["Messages", "/messages"],
] as const;

const operatorLinks = [
  ["Dashboard", "/dashboard"],
  ["Requests", "/requests"],
  ["Matches", "/matches"],
  ["Pilots", "/pilots"],
  ["Operator", "/profile"],
] as const;

const pilotLinks = [["Pilot profile", "/pilot/profile"]] as const;

export default function AppNav() {
  const { loading, authenticated, accountType, canOperator, canPilot, isAdmin, activePersona, setPersona, label } =
    useAccount();

  const showOperatorNav = isAdmin || canOperator;
  const showPilotNav = isAdmin || canPilot;
  const showPersonaToggle = accountType === "both";

  function switchPersona(persona: ActivePersona) {
    setPersona(persona);
    setActivePersona(persona);
  }

  return (
    <header className="topbar">
      <div className="container">
        <nav className="nav" aria-label="Application navigation">
          <Logo />
          <div className="menu">
            {!loading && accountType && (
              <span className="pill" title="Account type">
                {label}
              </span>
            )}
            {showPersonaToggle && (
              <>
                <button
                  className={`btn small${activePersona === "operator" ? " primary" : ""}`}
                  type="button"
                  onClick={() => switchPersona("operator")}
                >
                  Operator view
                </button>
                <button
                  className={`btn small${activePersona === "pilot" ? " primary" : ""}`}
                  type="button"
                  onClick={() => switchPersona("pilot")}
                >
                  Pilot view
                </button>
              </>
            )}
            {sharedLinks.map(([labelText, href]) => (
              <a href={href} key={href}>
                {labelText}
              </a>
            ))}
            {showOperatorNav &&
              operatorLinks.map(([labelText, href]) => (
                <a href={href} key={href} className="nav-link-operator">
                  {labelText}
                </a>
              ))}
            {showPilotNav &&
              pilotLinks.map(([labelText, href]) => (
                <a href={href} key={href} className="nav-link-pilot">
                  {labelText}
                </a>
              ))}
            <ThemeToggle />
            {!loading && authenticated && <SignOutButton />}
          </div>
        </nav>
      </div>
    </header>
  );
}
