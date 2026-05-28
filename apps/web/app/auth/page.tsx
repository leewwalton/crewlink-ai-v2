"use client";

import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Amplify } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import { isAppleAuthEnabled, runAmplifyConfig } from "../config/amplify";
import { loadAccount } from "../utils/api-client";
import { defaultHomePath } from "../utils/account-access";
import "../components/AuthPage.css";

function RedirectAfterSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;

    async function redirect() {
      const requestedNext = searchParams.get("next");
      if (requestedNext?.startsWith("/")) {
        router.replace(requestedNext);
        return;
      }

      try {
        const account = await loadAccount();
        if (!active) return;
        router.replace(defaultHomePath(account?.accountType ?? null));
      } catch {
        if (active) router.replace("/onboarding");
      }
    }

    redirect();
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return null;
}

function AuthRedirect() {
  return (
    <Suspense fallback={null}>
      <RedirectAfterSignIn />
    </Suspense>
  );
}

export default function AuthPage() {
  const [authenticatorReady, setAuthenticatorReady] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);

  useLayoutEffect(() => {
    runAmplifyConfig();
    const cfg = Amplify.getConfig();
    const domain =
      (cfg as { Auth?: { Cognito?: { loginWith?: { oauth?: { domain?: string } } } } })
        ?.Auth?.Cognito?.loginWith?.oauth?.domain ?? "";
    setOauthConfigured(typeof domain === "string" && domain.trim().length > 0);
    setAuthenticatorReady(true);
  }, []);

  const socialProviders = useMemo(() => {
    if (!oauthConfigured) return [] as const;
    const providers: ("google" | "apple")[] = ["google"];
    if (isAppleAuthEnabled()) {
      providers.push("apple");
    }
    return providers;
  }, [oauthConfigured]);

  return (
    <main className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-header-top">
            <Logo showText={false} />
            <ThemeToggle />
          </div>
          <span className="tag">Secure access</span>
          <h1>Sign in to CrewLinkAI</h1>
          <p className="auth-tagline">
            Sign in to manage operator or pilot profiles, staffing requests,
            matches, and messaging.
          </p>
        </div>

        {!authenticatorReady ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
            Loading sign-in…
          </div>
        ) : (
          <Authenticator
            hideSignUp={false}
            loginMechanisms={["email"]}
            signUpAttributes={["email"]}
            socialProviders={socialProviders as ("google" | "apple")[]}
          >
            {() => <AuthRedirect />}
          </Authenticator>
        )}

        <p className="auth-footer fineprint">
          <Link href="/">Back to CrewLinkAI home</Link>
          <br />
          CrewLinkAI™ is a product of Aviation AI Solutions LLC.
        </p>
      </div>
    </main>
  );
}
