"use client";

import Logo from "./Logo";
import SignOutButton from "./SignOutButton";
import ThemeToggle from "./ThemeToggle";
import { useAccount } from "../contexts/AccountContext";
import { useUnreadMessageCount } from "../hooks/useUnreadMessageCount";
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
  const { unreadCount } = useUnreadMessageCount(!loading && authenticated);

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
              <span className="pill nav-pill nav-pill-static" title="Account type">
                {label}
              </span>
            )}
            {showPersonaToggle && (
              <>
                <button
                  className={`nav-pill${activePersona === "operator" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => switchPersona("operator")}
                >
                  Operator view
                </button>
                <button
                  className={`nav-pill${activePersona === "pilot" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => switchPersona("pilot")}
                >
                  Pilot view
                </button>
              </>
            )}
            {sharedLinks.map(([labelText, href]) => {
              if (href === "/messages") {
                const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
                const hasUnread = unreadCount > 0;
                return (
                  <a
                    href={href}
                    key={href}
                    className={`nav-pill nav-messages-pill${hasUnread ? " has-unread" : ""}`}
                    aria-label={
                      hasUnread ? `Messages, ${unreadCount} unread` : "Messages"
                    }
                  >
                    {labelText}
                    {hasUnread && (
                      <span className="nav-message-count" aria-hidden="true">
                        {badgeLabel}
                      </span>
                    )}
                  </a>
                );
              }

              return (
                <a href={href} key={href} className="nav-pill">
                  {labelText}
                </a>
              );
            })}
            {showOperatorNav &&
              operatorLinks.map(([labelText, href]) => (
                <a href={href} key={href} className="nav-pill nav-link-operator">
                  {labelText}
                </a>
              ))}
            {showPilotNav &&
              pilotLinks.map(([labelText, href]) => (
                <a href={href} key={href} className="nav-pill nav-link-pilot">
                  {labelText}
                </a>
              ))}
            <ThemeToggle />
            {!loading && authenticated && <SignOutButton className="nav-pill" />}
          </div>
        </nav>
      </div>
    </header>
  );
}
