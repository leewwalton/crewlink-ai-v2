"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import "../components/AuthPage.css";

function RedirectToDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
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
          <span className="tag">Secure operator access</span>
          <h1>Sign in to CrewLinkAI</h1>
          <p className="auth-tagline">
            Use Cognito-backed authentication to access pilot search, requests,
            matches, and map data.
          </p>
        </div>

        <Authenticator
          hideSignUp={false}
          loginMechanisms={["email"]}
          signUpAttributes={["email"]}
        >
          {() => <RedirectToDashboard />}
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
