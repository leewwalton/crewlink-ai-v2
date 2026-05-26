#!/usr/bin/env node

/**
 * Resolve the repository root for Amplify CodeBuild and local shells.
 */

const fs = require("fs");
const path = require("path");

const candidates = [
  path.join(__dirname, ".."),
  process.env.CODEBUILD_SRC_DIR,
  process.env.REPO_ROOT,
  process.env.CODEBUILD_SRC_DIR
    ? path.join(process.env.CODEBUILD_SRC_DIR, "crewlink-ai-v2")
    : null,
].filter(Boolean);

for (const candidate of candidates) {
  if (fs.existsSync(path.join(candidate, "cdk.json"))) {
    process.stdout.write(candidate);
    process.exit(0);
  }
}

console.error("Could not locate repository root containing cdk.json");
process.exit(1);
