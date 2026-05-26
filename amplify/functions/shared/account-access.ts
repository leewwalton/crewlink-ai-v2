import type { AccountRole, UserAccount } from "../../../packages/domain/src";
import {
  canAccessOperatorArea,
  canAccessPilotArea,
  normalizeRoles,
} from "../../../packages/domain/src/roles";
import {
  operatorProfileGet,
  pilotProfileGet,
  userGet,
} from "./dynamodb-client";

export async function resolveAccountRoles(userId: string): Promise<AccountRole[]> {
  const stored = await userGet(userId);
  const storedRoles = normalizeRoles(stored?.roles);
  if (storedRoles.length > 0) {
    return storedRoles;
  }

  const [operatorProfile, pilotProfile] = await Promise.all([
    operatorProfileGet(userId),
    pilotProfileGet(userId),
  ]);
  const inferred: AccountRole[] = [];
  if (operatorProfile) inferred.push("operator");
  if (pilotProfile) inferred.push("pilot");
  return inferred;
}

export function toUserAccount(item: Record<string, unknown>): UserAccount {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...account } = item;
  return {
    ...(account as UserAccount),
    roles: normalizeRoles(item.roles),
  };
}

export async function requireOperatorAccess(
  userId: string,
): Promise<{ ok: true; roles: AccountRole[] } | { ok: false; message: string }> {
  const roles = await resolveAccountRoles(userId);
  if (!canAccessOperatorArea(roles)) {
    return { ok: false, message: "Operator access required." };
  }
  return { ok: true, roles };
}

export async function requirePilotAccess(
  userId: string,
): Promise<{ ok: true; roles: AccountRole[] } | { ok: false; message: string }> {
  const roles = await resolveAccountRoles(userId);
  if (!canAccessPilotArea(roles)) {
    return { ok: false, message: "Pilot access required." };
  }
  return { ok: true, roles };
}
