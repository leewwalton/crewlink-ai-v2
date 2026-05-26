"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import "../components/AuthPage.css";

import { loadAccount } from "../utils/api-client";
import { defaultHomePath } from "../utils/account-access";

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

        <Authenticator
          hideSignUp={false}
          loginMechanisms={["email"]}
          signUpAttributes={["email"]}
        >
          {() => <AuthRedirect />}
        </Authenticator>

        <p className="auth-footer fineprint">
          <Link href="/">Back to CrewLinkAI home</Link>
          <br />
          CrewLinkAI™ is a product of Aviation AI Solutions LLC.
        </p>
      </div>
    </main>
  );
}
