#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CrewLinkPipelineStack } from "../lib/crewlink-pipeline-stack";

const app = new cdk.App();
new CrewLinkPipelineStack(app, "CrewLinkPipelineStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-west-2",
  },
});
