"use client";

import { useRouter } from "next/navigation";
import "./Logo.css";

interface LogoProps {
  className?: string;
  showText?: boolean;
  href?: string;
}

export default function Logo({
  className = "",
  showText = true,
  href = "/",
}: LogoProps) {
  const router = useRouter();

  return (
    <a
      className={`brand ${className}`.trim()}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        router.push(href);
      }}
      aria-label="CrewLinkAI Home"
    >
      <span className="brandMark" aria-hidden="true" />
      {showText && (
        <span className="brandText">
          <strong>
            CrewLink<span>AI</span>
            <span className="tm" aria-hidden="true">
              ™
            </span>
          </strong>
          <small>A product of Aviation AI Solutions</small>
        </span>
      )}
    </a>
  );
}
