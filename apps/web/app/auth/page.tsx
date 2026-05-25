"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import "../components/AuthPage.css";

function RedirectAfterSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
  }, [nextPath, router]);

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
