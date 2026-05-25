"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";

type RequireAuthProps = {
  children: React.ReactNode;
  loadingMessage?: string;
};

export default function RequireAuth({
  children,
  loadingMessage = "Checking sign-in...",
}: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const session = await fetchAuthSession();
        const token =
          session.tokens?.idToken?.toString() ||
          session.tokens?.accessToken?.toString();
        if (!token) {
          router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (active) setReady(true);
      } catch {
        router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      }
    }

    checkAuth();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (!ready) {
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

  return children;
}
