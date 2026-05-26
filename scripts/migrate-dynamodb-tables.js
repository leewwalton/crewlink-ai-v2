#!/usr/bin/env node

/**
 * Copy data from legacy CloudFormation-generated DynamoDB tables into the
 * stable crewlink-* tables used by CrewLinkPipelineStack.
 *
 * Run after:
 *   npx cdk deploy CrewLinkPipelineStack
 */

const { execSync } = require("child_process");
const {
  DynamoDBClient,
  DescribeTableCommand,
  ListTablesCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const STACK_NAME = "CrewLinkPipelineStack";

const TABLE_NAMES = {
  users: "crewlink-users",
  pilotProfiles: "crewlink-pilot-profiles",
  operatorProfiles: "crewlink-operator-profiles",
  staffingRequests: "crewlink-staffing-requests",
  matches: "crewlink-matches",
  availability: "crewlink-availability",
  locations: "crewlink-locations",
  contactLeads: "crewlink-contact-leads",
  conversations: "crewlink-conversations",
  messages: "crewlink-messages",
  userConversations: "crewlink-user-conversations",
};

const LEGACY_SUFFIXES = {
  users: "Users0A0EEA89",
  pilotProfiles: "PilotProfiles4C888116",
  operatorProfiles: "OperatorProfilesAC6C89C2",
  staffingRequests: "StaffingRequestsE71304E9",
  matches: "MatchesBB86CD35",
  availability: "Availability367DB12B",
  locations: "Locations439EEF50",
  contactLeads: "ContactLeadsAC27590C",
  conversations: "ConversationsBC91B70D",
  messages: "Messages804FA4EB",
  userConversations: "UserConversations3BFD704F",
};

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

function awsJson(command) {
  return JSON.parse(execSync(command, { encoding: "utf8" }));
}

async function listAllTables() {
  const names = [];
  let startKey;
  do {
    const input = startKey ? { ExclusiveStartKey: startKey } : {};
    const result = await ddbClient.send(new ListTablesCommand(input));
    names.push(...(result.TableNames ?? []));
    startKey = result.LastEvaluatedTableName;
  } while (startKey);
  return names;
}

async function tableExists(tableName) {
  try {
    await ddbClient.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error.name === "ResourceNotFoundException") return false;
    throw error;
  }
}

async function countItems(tableName) {
  let count = 0;
  let startKey;
  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        Select: "COUNT",
        ExclusiveStartKey: startKey,
      }),
    );
    count += result.Count ?? 0;
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return count;
}

function getStackTableNames() {
  const resources = awsJson(
    `aws cloudformation describe-stack-resources --stack-name ${STACK_NAME} --output json`,
  ).StackResources ?? [];
  return new Set(
    resources
      .filter((resource) => resource.ResourceType === "AWS::DynamoDB::Table")
      .map((resource) => resource.PhysicalResourceId)
      .filter(Boolean),
  );
}

async function pickLegacySource(allTables, suffix, targetName, stackTables) {
  const candidates = allTables.filter(
    (name) => name.includes(suffix) && name !== targetName,
  );
  if (candidates.length === 0) return null;

  let best = null;
  let bestScore = -1;
  for (const name of candidates) {
    const count = await countItems(name);
    const retainedBonus = stackTables.has(name) ? 0 : 1;
    const score = count * 10 + retainedBonus;
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}

async function copyTable(sourceName, targetName, dryRun) {
  if (sourceName === targetName) {
    console.log(`skip ${targetName} (already stable)`);
    return 0;
  }

  const sourceCount = await countItems(sourceName);
  if (sourceCount === 0) {
    console.log(`skip ${targetName} (legacy ${sourceName} is empty)`);
    return 0;
  }

  if (!(await tableExists(targetName))) {
    console.warn(`skip ${targetName} (target table does not exist yet)`);
    return 0;
  }

  if (dryRun) {
    console.log(`would copy ${sourceCount} items: ${sourceName} -> ${targetName}`);
    return sourceCount;
  }

  let copied = 0;
  let startKey;
  do {
    const page = await ddb.send(
      new ScanCommand({
        TableName: sourceName,
        ExclusiveStartKey: startKey,
      }),
    );
    const items = page.Items ?? [];
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25);
      await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [targetName]: chunk.map((Item) => ({ PutRequest: { Item } })),
          },
        }),
      );
      copied += chunk.length;
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  console.log(`copied ${copied} items: ${sourceName} -> ${targetName}`);
  return copied;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  let allTables;
  try {
    allTables = await listAllTables();
  } catch (error) {
    if (error.name === "AccessDeniedException") {
      console.warn("Skipping migration (dynamodb:ListTables not allowed).");
      console.warn("Run `npm run cdk:migrate-tables` locally after one-time schema changes.");
      return;
    }
    throw error;
  }
  const stackTables = getStackTableNames();
  let totalCopied = 0;

  for (const key of Object.keys(TABLE_NAMES)) {
    const targetName = TABLE_NAMES[key];
    const suffix = LEGACY_SUFFIXES[key];
    const sourceName = await pickLegacySource(
      allTables,
      suffix,
      targetName,
      stackTables,
    );
    if (!sourceName) {
      console.log(`skip ${targetName} (no legacy source found)`);
      continue;
    }
    totalCopied += await copyTable(sourceName, targetName, dryRun);
  }

  console.log(`${dryRun ? "Would copy" : "Copied"} ${totalCopied} total items`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
