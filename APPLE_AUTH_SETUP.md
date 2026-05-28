# Sign in with Apple Setup

The auth page shows **Continue with Apple** only when `cdk-outputs.json` has `"appleAuthEnabled": true` (or `NEXT_PUBLIC_APPLE_AUTH_ENABLED=true`).

## 1. Apple Developer

1. Open [Identifiers → Services IDs](https://developer.apple.com/account/resources/identifiers/list/serviceId).
2. Create or select a Services ID (store the identifier in `crewlinkai/apple/clientId`).
3. Enable **Sign in with Apple → Configure**.
4. Under **Website URLs**, add exactly (run `node scripts/print-oauth-config.js` after deploy):

   **Domains and Subdomains** (hostname only, no `https://`)

   **Return URLs**

   ```
   https://<cognito-domain>/oauth2/idpresponse
   ```

5. Create a **Sign in with Apple** key if needed (Key ID → `crewlinkai/apple/keyId`, `.p8` → `crewlinkai/apple/p8`).

**Apple hostname limit (~50 chars):** The stack uses a short Cognito prefix (`clai-<accountSuffix>`, e.g. `clai-54596217.auth.us-west-2.amazoncognito.com`, 45 chars). If you previously deployed with `crewlink-<account>`, delete the old domain before redeploying:

```bash
aws cognito-idp delete-user-pool-domain \
  --domain crewlink-450545962167 \
  --user-pool-id us-west-2_O0c75kSU5 \
  --region us-west-2

npm run cdk:deploy
```

New domain: `clai-45962167.auth.us-west-2.amazoncognito.com` (45 chars).

Local dev does **not** register `localhost` on the Services ID. Apple redirects to Cognito; Cognito returns users to `http://localhost:3000/auth`.

## 2. AWS Secrets Manager

| Secret name | Contents |
|-------------|----------|
| `crewlinkai/apple/clientId` | `{"value": "<Services ID>"}` |
| `crewlinkai/apple/teamId` | `{"value": "<Apple Team ID>"}` |
| `crewlinkai/apple/keyId` | `{"value": "<Sign in with Apple Key ID>"}` |
| `crewlinkai/apple/p8` | `{"crewlinkai/apple/p8": "<PEM contents>"}` or `{"value": "<PEM>"}` |

Use the `.p8` private key, not a JWT client secret. Override secret names via CDK context if your layout differs.

## 3. Enable in CDK

Apple auth is enabled in `cdk.json` (`appleAuthEnabled: "true"`). Deploy:

```bash
npm run cdk:deploy
```

## 4. Refresh outputs

```bash
node scripts/generate-outputs-from-cdk.js
```

Confirm `"appleAuthEnabled": true` under `custom` in `cdk-outputs.json`.

## 5. Local override (optional)

```bash
# apps/web/.env.local
NEXT_PUBLIC_APPLE_AUTH_ENABLED=true
```

## Existing Cognito pool

If `COGNITO_USER_POOL_ID` is set, CDK imports the existing pool and **cannot** add Apple/Google IdPs automatically. Configure federated providers manually in the Cognito console, or remove the env vars to let CDK manage a new pool.

See [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md) for Google OAuth.
