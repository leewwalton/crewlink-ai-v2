#!/usr/bin/env node

/**
 * Print OAuth redirect URLs for Apple Developer and Google Cloud Console.
 *
 * Usage: node scripts/print-oauth-config.js
 */

const { execSync } = require("child_process");

const STACK = "CrewLinkPipelineStack";
const REGION = process.env.AWS_REGION || "us-west-2";

function output(key) {
  try {
    const v = execSync(
      `aws cloudformation describe-stacks --stack-name ${STACK} --region ${REGION} --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" --output text`,
      { encoding: "utf8" },
    ).trim();
    return v === "None" || v === "null" ? "" : v;
  } catch {
    return "";
  }
}

function main() {
  const cognitoDomain = output("CognitoDomain");
  const appleRedirect = output("AppleOAuthRedirectUrl");
  const appleDomain = output("AppleOAuthDomain");
  const appleEnabled = output("AppleAuthEnabled") === "true";

  const idpResponse =
    appleRedirect ||
    (cognitoDomain ? `${cognitoDomain.replace(/\/$/, "")}/oauth2/idpresponse` : "");
  const domain =
    appleDomain ||
    (cognitoDomain
      ? cognitoDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
      : "");

  console.log("\n=== Cognito Hosted UI ===");
  console.log("Domain:", cognitoDomain || "(stack output missing)");
  console.log("\n=== Google Cloud Console → OAuth client → Authorized redirect URIs ===");
  console.log(idpResponse || "(unknown)");
  console.log("\n=== Apple Developer → Identifiers → Services ID → Sign in with Apple → Configure ===");
  console.log("Services ID (client_id in Cognito): check secret crewlinkai/apple/clientId");
  if (appleEnabled) {
    console.log("\nDomains and Subdomains (add exactly):");
    console.log(`  ${domain}`);
    console.log("\nReturn URLs (add exactly):");
    console.log(`  ${idpResponse}`);
    if (domain) {
      console.log(`\nHostname length: ${domain.length} chars (Apple limit ~50)`);
    }
  } else {
    console.log("\nApple auth not enabled on stack (AppleAuthEnabled=false).");
  }
  console.log("\n=== Cognito app client callback URLs (localhost dev) ===");
  console.log("  http://localhost:3000/auth");
  console.log("  http://localhost:3000/dashboard");
  console.log("  http://localhost:3000/");
  console.log("");
}

main();
