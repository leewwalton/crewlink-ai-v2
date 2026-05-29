"use client";

import Link from "next/link";
import { Suspense, useCallback, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAuthSession, signInWithRedirect } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import {
  isAppleAuthEnabled,
  readConfiguredOauthDomain,
  runAmplifyConfig,
} from "../config/amplify";
import { loadAccount } from "../utils/api-client";
import { defaultHomePath } from "../utils/account-access";
import "../components/AuthPage.css";

async function hasAuthSession(): Promise<boolean> {
  try {
    const session = await fetchAuthSession({ forceRefresh: true });
    return Boolean(
      session.tokens?.idToken?.toString() ||
        session.tokens?.accessToken?.toString(),
    );
  } catch {
    return false;
  }
}

function usePostAuthRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [completingOAuth, setCompletingOAuth] = useState(false);

  useLayoutEffect(() => {
    let active = true;
    const isOAuthCallback =
      searchParams.has("code") && searchParams.has("state");

    if (isOAuthCallback) {
      setCompletingOAuth(true);
    }

    async function redirectSignedInUser() {
      if (!active || !(await hasAuthSession())) return false;

      const requestedNext = searchParams.get("next");
      if (requestedNext?.startsWith("/")) {
        router.replace(requestedNext);
        return true;
      }

      try {
        const account = await loadAccount();
        if (!active) return true;
        router.replace(defaultHomePath(account?.accountType ?? null));
      } catch {
        if (active) router.replace("/onboarding");
      }
      return true;
    }

    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      if (
        payload.event === "signInWithRedirect" ||
        payload.event === "signedIn"
      ) {
        void redirectSignedInUser();
      }
    });

    async function bootstrap() {
      runAmplifyConfig();

      if (await redirectSignedInUser()) return;

      if (!isOAuthCallback) {
        if (active) setCompletingOAuth(false);
        return;
      }

      const deadline = Date.now() + 15000;
      while (active && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (await redirectSignedInUser()) return;
      }

      if (active) setCompletingOAuth(false);
    }

    void bootstrap();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router, searchParams]);

  return completingOAuth;
}

type SocialProvider = "Google" | "Apple";

function SocialSignInPanel({
  showApple,
  onSignIn,
  redirecting,
}: {
  showApple: boolean;
  onSignIn: (provider: SocialProvider) => void;
  redirecting: SocialProvider | null;
}) {
  return (
    <div className="auth-social-panel">
      <button
        type="button"
        className="auth-social-button auth-social-button--google"
        disabled={redirecting !== null}
        onClick={() => onSignIn("Google")}
      >
        {redirecting === "Google" ? "Redirecting…" : "Continue with Google"}
      </button>
      {showApple && (
        <button
          type="button"
          className="auth-social-button auth-social-button--apple"
          disabled={redirecting !== null}
          onClick={() => onSignIn("Apple")}
        >
          {redirecting === "Apple" ? "Redirecting…" : "Continue with Apple"}
        </button>
      )}
    </div>
  );
}

function AuthPageContent() {
  const completingOAuth = usePostAuthRedirect();
  const [authReady, setAuthReady] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [showCredentialLogin, setShowCredentialLogin] = useState(false);
  const [socialRedirecting, setSocialRedirecting] = useState<SocialProvider | null>(
    null,
  );

  useLayoutEffect(() => {
    runAmplifyConfig();
    setOauthConfigured(readConfiguredOauthDomain().length > 0);
    setAuthReady(true);
  }, []);

  const showApple = isAppleAuthEnabled();
  const hasSocialLogin = oauthConfigured;
  const showSocialPrimary = hasSocialLogin && !showCredentialLogin;

  const handleSocialSignIn = useCallback(async (provider: SocialProvider) => {
    setSocialRedirecting(provider);
    try {
      runAmplifyConfig();
      await signInWithRedirect({ provider });
    } catch (err) {
      console.error("Social sign-in failed", err);
      setSocialRedirecting(null);
    }
  }, []);

  const showLoading = !authReady || completingOAuth;

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

        {showLoading ? (
          <div className="auth-sign-in-loading">
            {completingOAuth ? "Completing sign-in…" : "Loading sign-in…"}
          </div>
        ) : showSocialPrimary ? (
          <div className="auth-sign-in-options">
            <SocialSignInPanel
              showApple={showApple}
              onSignIn={handleSocialSignIn}
              redirecting={socialRedirecting}
            />
            <button
              type="button"
              className="auth-credential-toggle"
              onClick={() => setShowCredentialLogin(true)}
            >
              Sign in with email and password
            </button>
          </div>
        ) : (
          <div className="auth-sign-in-options">
            {hasSocialLogin && (
              <button
                type="button"
                className="auth-credential-toggle auth-credential-toggle--back"
                onClick={() => setShowCredentialLogin(false)}
              >
                Back to Google or Apple sign-in
              </button>
            )}
            <Authenticator
              hideSignUp={false}
              loginMechanisms={["email"]}
              signUpAttributes={["email"]}
              socialProviders={[]}
              components={{
                Header() {
                  return <></>;
                },
              }}
            >
              {() => (
                <div className="auth-sign-in-loading" aria-live="polite">
                  Signing in…
                </div>
              )}
            </Authenticator>
          </div>
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

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-container">
            <div className="auth-sign-in-loading">Loading sign-in…</div>
          </div>
        </main>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
