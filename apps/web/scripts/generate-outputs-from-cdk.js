#!/usr/bin/env node

/**
 * Generates amplify_outputs.json and cdk-outputs.json from CrewLinkStack CDK outputs.
 *
 * Run after:
 *   npx cdk deploy CrewLinkStack --outputs-file cdk-deploy-outputs.json --require-approval never
 *
 * Or fetch from CloudFormation:
 *   node apps/web/scripts/generate-outputs-from-cdk.js
 */

const fs = require("fs");
const path = require("path");

const STACK_NAME = "CrewLinkStack";
const ROOT = path.join(__dirname, "../..");

function getOutputValue(outputs, key) {
  const o = outputs.find((x) => x.OutputKey === key);
  return o ? o.OutputValue : undefined;
}

async function fetchStackOutputs() {
  const { execSync } = require("child_process");
  try {
    const result = execSync(
      `aws cloudformation describe-stacks --stack-name ${STACK_NAME} --query 'Stacks[0].Outputs' --output json`,
      { encoding: "utf8" },
    );
    return JSON.parse(result);
  } catch (e) {
    console.error(
      "Failed to fetch stack outputs. Ensure AWS CLI is configured and CrewLinkStack exists.",
    );
    throw e;
  }
}

function buildAmplifyOutputs(outputs) {
  const userPoolId = getOutputValue(outputs, "UserPoolId");
  const userPoolClientId = getOutputValue(outputs, "UserPoolClientId");
  const identityPoolId = getOutputValue(outputs, "IdentityPoolId");
  const cognitoDomain = getOutputValue(outputs, "CognitoDomain");
  const region = getOutputValue(outputs, "AwsRegion") || process.env.AWS_REGION || "us-west-2";

  const auth = {
    user_pool_id: userPoolId,
    user_pool_client_id: userPoolClientId,
    identity_pool_id: identityPoolId,
    aws_region: region,
  };

  if (cognitoDomain) {
    const domain = cognitoDomain.startsWith("https://")
      ? cognitoDomain
      : `https://${cognitoDomain}`;
    auth.oauth = {
      domain: domain.replace(/\/$/, ""),
      scopes: ["email", "openid", "profile"],
      redirect_sign_in_uri: "https://flycrewlink.com/dashboard",
      redirect_sign_out_uri: "https://flycrewlink.com/",
      response_type: "code",
    };
  }

  return {
    version: "1",
    auth,
    custom: {
      httpApiUrl: getOutputValue(outputs, "HttpApiUrl"),
    },
  };
}

function buildCdkOutputs(outputs) {
  const region = getOutputValue(outputs, "AwsRegion") || process.env.AWS_REGION || "us-west-2";
  const cognitoDomainRaw = getOutputValue(outputs, "CognitoDomain");
  const cognitoDomain = cognitoDomainRaw
    ? cognitoDomainRaw.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : undefined;

  return {
    auth: {
      user_pool_id: getOutputValue(outputs, "UserPoolId"),
      user_pool_client_id: getOutputValue(outputs, "UserPoolClientId"),
      identity_pool_id: getOutputValue(outputs, "IdentityPoolId"),
      aws_region: region,
    },
    custom: {
      httpApiUrl: getOutputValue(outputs, "HttpApiUrl"),
      ...(cognitoDomain ? { cognitoDomain } : {}),
    },
  };
}

function normalizeOutputs(data) {
  const raw = data[STACK_NAME] ?? data;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && !raw.OutputKey) {
    return Object.entries(raw).map(([k, v]) => ({ OutputKey: k, OutputValue: v }));
  }
  return raw?.Outputs ?? [];
}

async function main() {
  let outputs = [];

  const outputsPath = process.argv[2] || path.join(ROOT, "cdk-deploy-outputs.json");
  if (fs.existsSync(outputsPath)) {
    const data = JSON.parse(fs.readFileSync(outputsPath, "utf8"));
    outputs = normalizeOutputs(data);
  }

  if (!outputs || outputs.length === 0) {
    console.log("No local outputs file found, fetching from CloudFormation...");
    outputs = await fetchStackOutputs();
  }

  const amplifyOutputs = buildAmplifyOutputs(outputs);
  const cdkOutputs = buildCdkOutputs(outputs);

  const amplifyPath = path.join(ROOT, "amplify_outputs.json");
  const cdkPath = path.join(ROOT, "cdk-outputs.json");

  fs.writeFileSync(amplifyPath, JSON.stringify(amplifyOutputs, null, 2) + "\n");
  fs.writeFileSync(cdkPath, JSON.stringify(cdkOutputs, null, 2) + "\n");

  console.log(`Wrote ${amplifyPath}`);
  console.log(`Wrote ${cdkPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
