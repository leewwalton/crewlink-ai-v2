# Google Authentication Setup Guide

This guide configures Google OAuth for CrewLinkAI using the CDK-managed Cognito User Pool.

## 1. Create Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **APIs & Services → Credentials**
4. **Create Credentials → OAuth client ID → Web application**
5. Note the **Client ID** and **Client secret**

## 2. Store secrets in AWS Secrets Manager

Create two secrets in AWS Secrets Manager (JSON with a **`value`** key only):

| Secret name                       | Example value                                            |
| --------------------------------- | -------------------------------------------------------- |
| `crewlinkai/google/clientId`     | `{"value": "YOUR_CLIENT_ID.apps.googleusercontent.com"}` |
| `crewlinkai/google/clientSecret` | `{"value": "GOCSPX-your-client-secret"}`                 |

Override secret names at deploy time with CDK context if needed. Disable Google IdP with `-c googleAuthEnabled=false`.

Using any other JSON shape can cause Cognito to send the whole JSON to Google as `client_id`, producing **Error 401: invalid_client**.

## 3. Deploy the CDK stack

```bash
npm run cdk:deploy
```

After deploy, print OAuth URLs:

```bash
node scripts/print-oauth-config.js
```

## 4. Configure Google redirect URI

In Google Cloud Console → your OAuth client → **Authorized redirect URIs**, add:

```
https://<your-cognito-domain>/oauth2/idpresponse
```

Use the exact URL from `node scripts/print-oauth-config.js` (Cognito Hosted UI → idpresponse).

## 5. Refresh local outputs

```bash
node scripts/generate-outputs-from-cdk.js
```

Confirm `cdk-outputs.json` includes `custom.cognitoDomain`.

## 6. Test

1. `npm run dev`
2. Open `/auth`
3. Use **Continue with Google**

## Troubleshooting

- **No Google button** — Ensure `custom.cognitoDomain` is set in `cdk-outputs.json` or set `NEXT_PUBLIC_COGNITO_DOMAIN`.
- **Login option is not available** — Redeploy CDK after creating Secrets Manager entries; verify Google IdP exists in Cognito → Sign-in experience → Federated identity providers.
- **redirect_mismatch** — Add the exact callback URL to Cognito app client **Allowed callback URLs** (e.g. `http://localhost:3000/auth`, `https://crew-link-ai.com/auth`).
- **ResourceNotFoundException (Secrets Manager)** — Create `crewlinkai/google/clientId` and `crewlinkai/google/clientSecret`. Apple is off by default; enable with `-c appleAuthEnabled=true` only after `crewlinkai/apple/*` secrets exist.
- **attributes required: [email]** — Ensure Google OAuth consent screen includes `email`, `profile`, and `openid` scopes.

See also [APPLE_AUTH_SETUP.md](./APPLE_AUTH_SETUP.md) for Sign in with Apple.
