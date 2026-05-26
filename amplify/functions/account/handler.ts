import type { AccountRole, AccountType, UserAccount } from "../../../packages/domain/src";
import {
  getAccountType,
  normalizeRoles,
  rolesFromAccountType,
} from "../../../packages/domain/src/roles";
import {
  getCognitoEmailFromEvent,
  getCognitoSubFromEvent,
} from "../shared/get-cognito-sub";
import { httpMethod, json, safeParseBody } from "../shared/http";
import {
  operatorProfileGet,
  pilotProfileGet,
  userGet,
  userPut,
} from "../shared/dynamodb-client";
import { toUserAccount } from "../shared/account-access";

const LOG_PREFIX = "[ACCOUNT]";

function parseAccountType(body: Record<string, unknown> | null): AccountType | null {
  if (!body) return null;
  const accountType = body.accountType != null ? String(body.accountType) : "";
  if (
    accountType === "operator" ||
    accountType === "pilot" ||
    accountType === "both" ||
    accountType === "admin"
  ) {
    return accountType;
  }
  return null;
}

async function inferRoles(userId: string): Promise<AccountRole[]> {
  const [operatorProfile, pilotProfile] = await Promise.all([
    operatorProfileGet(userId),
    pilotProfileGet(userId),
  ]);
  const roles: AccountRole[] = [];
  if (operatorProfile) roles.push("operator");
  if (pilotProfile) roles.push("pilot");
  return roles;
}

export const handler = async (event: any) => {
  const method = httpMethod(event);
  console.log(`${LOG_PREFIX} Invoked method=${method}`);

  if (method === "OPTIONS") {
    return json(200, { message: "OK" });
  }

  const userId = getCognitoSubFromEvent(event);
  if (!userId) {
    return json(401, { message: "Authentication required." });
  }

  const email = getCognitoEmailFromEvent(event) || "";

  if (method === "GET") {
    try {
      const existing = await userGet(userId);
      if (existing) {
        const account = toUserAccount(existing);
        return json(200, {
          account,
          accountType: getAccountType(account.roles),
        });
      }

      const inferredRoles = await inferRoles(userId);
      if (inferredRoles.length === 0) {
        return json(404, { message: "Account not configured." });
      }

      const now = new Date().toISOString();
      const account: UserAccount = {
        id: userId,
        email,
        roles: inferredRoles,
        createdAt: now,
        updatedAt: now,
      };
      await userPut(account);
      return json(200, {
        account,
        accountType: getAccountType(account.roles),
        inferred: true,
      });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} GET failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  if (method === "PUT") {
    const body = safeParseBody(event.body);
    const accountType = parseAccountType(body);
    if (!accountType) {
      return json(400, { message: "accountType must be operator, pilot, both, or admin." });
    }

    if (accountType === "admin") {
      return json(403, { message: "Admin accounts must be assigned by CrewLinkAI staff." });
    }

    try {
      const existing = await userGet(userId);
      const existingRoles = normalizeRoles(existing?.roles);
      if (existingRoles.length > 0 && !existingRoles.includes("admin")) {
        return json(409, { message: "Account type is already configured." });
      }
      if (existingRoles.includes("admin")) {
        return json(403, { message: "Admin account type cannot be changed here." });
      }

      const now = new Date().toISOString();
      const roles = rolesFromAccountType(accountType);
      const account: UserAccount = {
        id: userId,
        email: email || String(existing?.email || ""),
        roles,
        createdAt: (existing?.createdAt as string | undefined) ?? now,
        updatedAt: now,
      };
      await userPut(account);
      return json(200, {
        account,
        accountType: getAccountType(account.roles),
      });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} PUT failed`, { error: err?.message });
      return json(500, { message: "Internal server error" });
    }
  }

  return json(405, { message: "Method Not Allowed" });
};
