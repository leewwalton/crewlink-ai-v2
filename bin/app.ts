#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CrewLinkStack } from "../lib/crew-link-stack";

const app = new cdk.App();

new CrewLinkStack(app, "CrewLinkStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-west-2",
  },
});
