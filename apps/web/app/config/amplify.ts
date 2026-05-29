"use client";

import { Amplify } from "aws-amplify";

type AuthOutputs = {
  user_pool_id?: string;
  user_pool_client_id?: string;
  identity_pool_id?: string;
  aws_region?: string;
  oauth?: {
    domain?: string;
  };
};

type AppOutputs = {
  auth?: AuthOutputs;
  custom?: {
    cognitoDomain?: string;
    appleAuthEnabled?: boolean | string;
  };
};

function loadCdkOutputs(): AppOutputs | null {
  try {
    return require("@root/cdk-outputs.json") as AppOutputs;
  } catch {
    return null;
  }
}

function loadAmplifyOutputs(): AppOutputs | null {
  try {
    return require("@root/amplify_outputs.json") as AppOutputs;
  } catch {
    return null;
  }
}

/** Prefer CDK custom fields (cognitoDomain, appleAuthEnabled); merge auth from either file. */
function loadOutputs(): AppOutputs | null {
  const cdk = loadCdkOutputs();
  const amplify = loadAmplifyOutputs();
  if (!cdk && !amplify) return null;

  return {
    auth: cdk?.auth ?? amplify?.auth,
    custom: {
      ...amplify?.custom,
      ...cdk?.custom,
    },
  };
}

function resolveOauthDomain(outputs: AppOutputs | null): string {
  const fromEnv = process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "";
  const fromCustom = outputs?.custom?.cognitoDomain ?? "";
  const fromAuthOauth = outputs?.auth?.oauth?.domain ?? "";
  return (fromEnv || fromCustom || fromAuthOauth)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

/** True when Sign in with Apple is configured on the Cognito app client. */
export function isAppleAuthEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true") {
    return true;
  }
  const outputs = loadOutputs();
  const flag = outputs?.custom?.appleAuthEnabled;
  return flag === true || flag === "true";
}

export function isOauthConfigured(): boolean {
  return resolveOauthDomain(loadOutputs()).length > 0;
}

export function runAmplifyConfig(): void {
  if (typeof window === "undefined") return;

  const outputs = loadOutputs();
  const auth = outputs?.auth;
  if (!auth?.user_pool_id || !auth.user_pool_client_id) return;

  const origin = window.location.origin;
  const oauthDomain = resolveOauthDomain(outputs);

  const loginWith = {
    email: true,
    ...(oauthDomain
      ? {
          oauth: {
            domain: oauthDomain,
            scopes: ["openid", "email", "profile"],
            redirectSignIn: [`${origin}/auth`],
            redirectSignOut: [`${origin}/`],
            responseType: "code" as const,
          },
        }
      : {}),
  };

  const config = {
    Auth: {
      Cognito: {
        userPoolId: auth.user_pool_id,
        userPoolClientId: auth.user_pool_client_id,
        ...(auth.identity_pool_id ? { identityPoolId: auth.identity_pool_id } : {}),
        loginWith,
      },
    },
  };

  Amplify.configure(config as Parameters<typeof Amplify.configure>[0], { ssr: true });
}

export function readConfiguredOauthDomain(): string {
  runAmplifyConfig();
  const cfg = Amplify.getConfig() as {
    Auth?: {
      Cognito?: {
        loginWith?: { oauth?: { domain?: string } };
        oauth?: { domain?: string };
      };
    };
  };
  const domain =
    cfg.Auth?.Cognito?.loginWith?.oauth?.domain ??
    cfg.Auth?.Cognito?.oauth?.domain ??
    "";
  return typeof domain === "string" ? domain.trim() : "";
}
