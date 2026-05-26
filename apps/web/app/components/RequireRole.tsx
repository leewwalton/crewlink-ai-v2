"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AccountRole } from "@crewlink/domain";
import {
  canAccessOperatorArea,
  canAccessPilotArea,
  isAdmin,
} from "@crewlink/domain";
import { useAccount } from "../contexts/AccountContext";
import { defaultHomePath } from "../utils/account-access";

type AccessArea = "operator" | "pilot" | "shared" | "admin";

type RequireRoleProps = {
  area: AccessArea;
  children: React.ReactNode;
  loadingMessage?: string;
};

function hasAreaAccess(area: AccessArea, roles: AccountRole[]): boolean {
  switch (area) {
    case "admin":
      return isAdmin(roles);
    case "operator":
      return canAccessOperatorArea(roles);
    case "pilot":
      return canAccessPilotArea(roles);
    case "shared":
      return roles.length > 0 || isAdmin(roles);
    default:
      return false;
  }
}

export default function RequireRole({
  area,
  children,
  loadingMessage = "Checking access...",
}: RequireRoleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, accountType, roles } = useAccount();
  const allowed = hasAreaAccess(area, roles);

  useEffect(() => {
    if (loading || allowed) return;
    router.replace(defaultHomePath(accountType));
  }, [accountType, allowed, loading, pathname, router]);

  if (loading) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <div className="container">
            <section className="card panel">
              <p className="muted">{loadingMessage}</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <div className="container">
            <section className="card panel">
              <p className="muted">Redirecting to the right workspace...</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return children;
}
