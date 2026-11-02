#!/usr/bin/env node
import { App } from "aws-cdk-lib/core";
import { config } from "dotenv";
import { resolve } from "path";
import { ProjectStack } from "../project-stack";

config({ path: resolve(__dirname, "../.env") });

const app = new App();
new ProjectStack(app, `${process.env.PROJECT_NAME}-${process.env.STAGE}-Stack`, {
    env: {
        account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
    }
});
