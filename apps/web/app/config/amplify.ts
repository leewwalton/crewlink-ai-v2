"use client";

import { Amplify } from "aws-amplify";

type AuthOutputs = {
  user_pool_id?: string;
  user_pool_client_id?: string;
  identity_pool_id?: string;
  aws_region?: string;
};

type AppOutputs = {
  auth?: AuthOutputs;
  custom?: {
    cognitoDomain?: string;
  };
};

function loadOutputs(): AppOutputs | null {
  try {
    return require("@root/amplify_outputs.json") as AppOutputs;
  } catch {
    try {
      return require("@root/cdk-outputs.json") as AppOutputs;
    } catch {
      return null;
    }
  }
}

export function runAmplifyConfig(): void {
  if (typeof window === "undefined") return;

  const outputs = loadOutputs();
  const auth = outputs?.auth;
  if (!auth?.user_pool_id || !auth.user_pool_client_id) return;

  const origin = window.location.origin;
  const oauthDomain = (
    process.env.NEXT_PUBLIC_COGNITO_DOMAIN ||
    outputs?.custom?.cognitoDomain ||
    ""
  )
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  const loginWith = {
    email: true,
    ...(oauthDomain
      ? {
          oauth: {
            domain: oauthDomain,
            scopes: ["openid", "email", "profile"],
            redirectSignIn: [`${origin}/dashboard`],
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
