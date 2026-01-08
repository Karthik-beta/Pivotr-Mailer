#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { PivotrMailerStack } from '../lib/pivotr-mailer-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

new PivotrMailerStack(app, `PivotrMailer-${environment}`, {
    // Use environment variables for account/region
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'ap-south-1',
    },

    // Stack tags for cost allocation (PRD Section 5.3.9)
    tags: {
        Project: 'PivotrMailer',
        Environment: environment,
        ManagedBy: 'CDK',
    },
});
