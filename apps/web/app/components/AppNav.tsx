"use client";

import Logo from "./Logo";
import ProfileMenu from "./ProfileMenu";
import ThemeToggle from "./ThemeToggle";
import { useAccount } from "../contexts/AccountContext";
import { useUnreadMessageCount } from "../hooks/useUnreadMessageCount";

const sharedLinks = [
  ["Map", "/map"],
  ["Messages", "/messages"],
] as const;

const operatorLinks = [
  ["Dashboard", "/dashboard"],
  ["Requests", "/requests"],
  ["Matches", "/matches"],
  ["Pilots", "/pilots"],
] as const;

export default function AppNav() {
  const { loading, authenticated, canOperator, isAdmin } = useAccount();
  const { unreadCount } = useUnreadMessageCount(!loading && authenticated);

  const showOperatorNav = isAdmin || canOperator;

  return (
    <header className="topbar">
      <div className="container">
        <nav className="nav" aria-label="Application navigation">
          <Logo />
          <div className="menu">
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
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </nav>
      </div>
    </header>
  );
}
