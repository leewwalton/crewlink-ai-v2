"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import type { AccountRole, AccountType, UserAccount } from "@crewlink/domain";
import {
  accountTypeLabel,
  canAccessOperatorArea,
  canAccessPilotArea,
  getAccountType,
  isAdmin,
} from "@crewlink/domain";
import { loadAccount } from "../utils/api-client";
import {
  defaultHomePath,
  getActivePersona,
  setActivePersona,
  type ActivePersona,
} from "../utils/account-access";

type AccountContextValue = {
  loading: boolean;
  authenticated: boolean;
  account: UserAccount | null;
  accountType: AccountType | null;
  roles: AccountRole[];
  activePersona: ActivePersona;
  setPersona: (persona: ActivePersona) => void;
  refreshAccount: () => Promise<void>;
  canOperator: boolean;
  canPilot: boolean;
  isAdmin: boolean;
  label: string;
};

const AccountContext = createContext<AccountContextValue | null>(null);

const PUBLIC_PATHS = new Set(["/", "/auth", "/onboarding"]);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [activePersona, setActivePersonaState] = useState<ActivePersona>("operator");

  const refreshAccount = useCallback(async () => {
    const session = await fetchAuthSession();
    const token =
      session.tokens?.idToken?.toString() ||
      session.tokens?.accessToken?.toString();
    if (!token) {
      setAuthenticated(false);
      setAccount(null);
      setAccountType(null);
      return;
    }

    setAuthenticated(true);
    const result = await loadAccount();
    if (result) {
      setAccount(result.account);
      setAccountType(result.accountType);
      setActivePersonaState(getActivePersona(result.accountType));
    } else {
      setAccount(null);
      setAccountType(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      try {
        await refreshAccount();
      } catch {
        if (active) {
          setAuthenticated(false);
          setAccount(null);
          setAccountType(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [refreshAccount, pathname]);

  useEffect(() => {
    if (loading || !authenticated) return;
    if (PUBLIC_PATHS.has(pathname)) return;
    if (accountType) return;
    router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
  }, [accountType, authenticated, loading, pathname, router]);

  const setPersona = useCallback((persona: ActivePersona) => {
    setActivePersona(persona);
    setActivePersonaState(persona);
  }, []);

  const roles = account?.roles ?? [];
  const value = useMemo<AccountContextValue>(
    () => ({
      loading,
      authenticated,
      account,
      accountType,
      roles,
      activePersona,
      setPersona,
      refreshAccount,
      canOperator: canAccessOperatorArea(roles),
      canPilot: canAccessPilotArea(roles),
      isAdmin: isAdmin(roles),
      label: accountTypeLabel(accountType),
    }),
    [
      account,
      accountType,
      activePersona,
      authenticated,
      loading,
      refreshAccount,
      roles,
      setPersona,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within AccountProvider.");
  }
  return context;
}

export function useOptionalAccount() {
  return useContext(AccountContext);
}

export { defaultHomePath };
