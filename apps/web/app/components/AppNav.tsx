import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const links = [
  ["Dashboard", "/dashboard"],
  ["Pilots", "/pilots"],
  ["Map", "/map"],
  ["Requests", "/requests"],
  ["Matches", "/matches"],
  ["Messages", "/messages"],
  ["Profile", "/profile"],
] as const;

export default function AppNav() {
  return (
    <header className="topbar">
      <div className="container">
        <nav className="nav" aria-label="Application navigation">
          <Logo />
          <div className="menu">
            {links.map(([label, href]) => (
              <a href={href} key={href}>
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
