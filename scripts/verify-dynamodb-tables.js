#!/usr/bin/env node

/**
 * Verify CrewLinkPipelineStack Lambdas and DynamoDB tables are aligned on the
 * stable crewlink-* table names.
 */

const { execSync } = require("child_process");

const STACK_NAME = "CrewLinkPipelineStack";

const STABLE_TABLES = new Set([
  "crewlink-users",
  "crewlink-pilot-profiles",
  "crewlink-operator-profiles",
  "crewlink-staffing-requests",
  "crewlink-matches",
  "crewlink-availability",
  "crewlink-locations",
  "crewlink-contact-leads",
  "crewlink-conversations",
  "crewlink-messages",
  "crewlink-user-conversations",
]);

const TABLE_ENV_KEYS = [
  "PILOT_PROFILES_TABLE_NAME",
  "OPERATOR_PROFILES_TABLE_NAME",
  "STAFFING_REQUESTS_TABLE_NAME",
  "CONTACT_LEADS_TABLE_NAME",
  "CONVERSATIONS_TABLE_NAME",
  "MESSAGES_TABLE_NAME",
  "USER_CONVERSATIONS_TABLE_NAME",
];

function awsJson(command) {
  return JSON.parse(execSync(command, { encoding: "utf8" }));
}

function main() {
  const resources =
    awsJson(
      `aws cloudformation describe-stack-resources --stack-name ${STACK_NAME} --output json`,
    ).StackResources ?? [];

  const stackTables = resources
    .filter((resource) => resource.ResourceType === "AWS::DynamoDB::Table")
    .map((resource) => resource.PhysicalResourceId)
    .filter(Boolean);

  const lambdas = resources
    .filter((resource) => resource.ResourceType === "AWS::Lambda::Function")
    .map((resource) => resource.PhysicalResourceId)
    .filter(Boolean);

  let failed = false;

  console.log("Stack DynamoDB tables:");
  for (const tableName of stackTables) {
    const stable = STABLE_TABLES.has(tableName);
    console.log(`  ${stable ? "OK" : "WARN"} ${tableName}`);
    if (!stable) failed = true;
  }

  console.log("\nLambda table env vars:");
  for (const functionName of lambdas) {
    const config = awsJson(
      `aws lambda get-function-configuration --function-name ${functionName} --output json`,
    );
    const vars = config.Environment?.Variables ?? {};
    for (const key of TABLE_ENV_KEYS) {
      const value = vars[key];
      if (!value) continue;
      const stable = STABLE_TABLES.has(value);
      const inStack = stackTables.includes(value);
      const ok = stable && inStack;
      console.log(
        `  ${ok ? "OK" : "FAIL"} ${functionName.split("-").slice(-1)[0]} ${key}=${value}`,
      );
      if (!ok) failed = true;
    }
  }

  const allTables = (() => {
    try {
      return awsJson("aws dynamodb list-tables --output json").TableNames ?? [];
    } catch (error) {
      console.warn("Skipping legacy table listing (dynamodb:ListTables not allowed).");
      return [];
    }
  })();
  const legacyTables = allTables.filter(
    (name) =>
      (name.startsWith("CrewLinkPipelineStack-") || name.startsWith("CrewLinkStack-")) &&
      !stackTables.includes(name),
  );

  if (legacyTables.length > 0) {
    console.log("\nLegacy retained tables (safe to delete after migration):");
    for (const tableName of legacyTables.sort()) {
      console.log(`  - ${tableName}`);
    }
  }

  if (failed) {
    console.error("\nDynamoDB alignment check failed.");
    process.exit(1);
  }

  console.log("\nDynamoDB alignment check passed.");
}

main();
