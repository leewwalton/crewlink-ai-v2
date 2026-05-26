export type AccountRole = "operator" | "pilot" | "admin";

/** UI-facing account type selected at onboarding. */
export type AccountType = "operator" | "pilot" | "both" | "admin";

export interface UserAccount {
  id: string;
  email: string;
  roles: AccountRole[];
  createdAt: string;
  updatedAt: string;
}

const ACCOUNT_ROLES: AccountRole[] = ["operator", "pilot", "admin"];

export function normalizeRoles(value: unknown): AccountRole[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is AccountRole => ACCOUNT_ROLES.includes(entry as AccountRole)))];
}

export function rolesFromAccountType(accountType: AccountType): AccountRole[] {
  switch (accountType) {
    case "operator":
      return ["operator"];
    case "pilot":
      return ["pilot"];
    case "both":
      return ["operator", "pilot"];
    case "admin":
      return ["admin"];
    default:
      return [];
  }
}

export function getAccountType(roles: AccountRole[]): AccountType | null {
  const normalized = normalizeRoles(roles);
  if (normalized.includes("admin")) return "admin";
  const hasOperator = normalized.includes("operator");
  const hasPilot = normalized.includes("pilot");
  if (hasOperator && hasPilot) return "both";
  if (hasOperator) return "operator";
  if (hasPilot) return "pilot";
  return null;
}

export function accountTypeLabel(accountType: AccountType | null): string {
  switch (accountType) {
    case "operator":
      return "Operator";
    case "pilot":
      return "Pilot";
    case "both":
      return "Operator & Pilot";
    case "admin":
      return "Admin";
    default:
      return "Account";
  }
}

export function isAdmin(roles: AccountRole[]): boolean {
  return normalizeRoles(roles).includes("admin");
}

export function canAccessOperatorArea(roles: AccountRole[]): boolean {
  const normalized = normalizeRoles(roles);
  return normalized.includes("admin") || normalized.includes("operator");
}

export function canAccessPilotArea(roles: AccountRole[]): boolean {
  const normalized = normalizeRoles(roles);
  return normalized.includes("admin") || normalized.includes("pilot");
}

export function canAccessSharedArea(roles: AccountRole[]): boolean {
  return normalizeRoles(roles).length > 0;
}
