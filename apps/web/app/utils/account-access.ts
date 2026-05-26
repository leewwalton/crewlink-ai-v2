import type { AccountRole } from "@crewlink/domain";
import {
  canAccessOperatorArea,
  canAccessPilotArea,
  getAccountType,
  rolesFromAccountType,
} from "@crewlink/domain";

export type ActivePersona = "operator" | "pilot";

const PERSONA_KEY = "crewlink-active-persona";

export function getActivePersona(accountType: ReturnType<typeof getAccountType>): ActivePersona {
  if (accountType === "pilot") return "pilot";
  if (accountType === "operator" || accountType === "admin") return "operator";
  if (typeof window === "undefined") return "operator";
  const stored = window.localStorage.getItem(PERSONA_KEY);
  if (stored === "pilot" || stored === "operator") return stored;
  return "operator";
}

export function setActivePersona(persona: ActivePersona) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PERSONA_KEY, persona);
}

export function defaultHomePath(accountType: ReturnType<typeof getAccountType>): string {
  switch (accountType) {
    case "pilot":
      return "/pilot/profile";
    case "operator":
    case "admin":
      return "/dashboard";
    case "both":
      return getActivePersona(accountType) === "pilot" ? "/pilot/profile" : "/dashboard";
    default:
      return "/onboarding";
  }
}

export function canAccessArea(
  area: "operator" | "pilot" | "shared" | "admin",
  roles: AccountRole[],
): boolean {
  switch (area) {
    case "admin":
      return roles.includes("admin");
    case "operator":
      return canAccessOperatorArea(roles);
    case "pilot":
      return canAccessPilotArea(roles);
    case "shared":
      return roles.length > 0;
    default:
      return false;
  }
}

export { rolesFromAccountType };
