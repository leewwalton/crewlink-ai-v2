import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const sharedLinks = [
  ["Dashboard", "/dashboard"],
  ["Pilots", "/pilots"],
  ["Map", "/map"],
  ["Messages", "/messages"],
] as const;

const operatorLinks = [
  ["Requests", "/requests"],
  ["Matches", "/matches"],
  ["Operator", "/profile"],
] as const;

const pilotLinks = [["Pilot", "/pilot/profile"]] as const;

export default function AppNav() {
  return (
    <header className="topbar">
      <div className="container">
        <nav className="nav" aria-label="Application navigation">
          <Logo />
          <div className="menu">
            {sharedLinks.map(([label, href]) => (
              <a href={href} key={href}>
                {label}
              </a>
            ))}
            {operatorLinks.map(([label, href]) => (
              <a href={href} key={href} className="nav-link-operator">
                {label}
              </a>
            ))}
            {pilotLinks.map(([label, href]) => (
              <a href={href} key={href} className="nav-link-pilot">
                {label}
              </a>
            ))}
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
