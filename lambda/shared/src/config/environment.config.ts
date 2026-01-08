/**
 * Environment Configuration
 * 
 * Centralizes all environment variable access with validation.
 * Throws early if required variables are missing.
 */

export interface AwsConfig {
    region: string;
    accountId: string;
}

export interface SesConfig {
    region: string;
    fromEmail: string;
    configurationSet: string;
}

export interface SqsConfig {
    region: string;
    feedbackQueueUrl: string;
    sendingQueueUrl?: string;
    verificationQueueUrl?: string;
}

export interface DynamoDbConfig {
    leadsTable: string;
    campaignsTable: string;
    logsTable: string;
    metricsTable: string;
    settingsTable: string;
}

/**
 * Get required environment variable or throw.
 */
function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

/**
 * Get optional environment variable with default.
 */
function getOptionalEnv(name: string, defaultValue: string): string {
    return process.env[name] || defaultValue;
}

/**
 * Get AWS configuration from environment.
 */
export function getAwsConfig(): AwsConfig {
    return {
        region: getOptionalEnv('AWS_REGION', 'ap-south-1'),
        accountId: getRequiredEnv('AWS_ACCOUNT_ID'),
    };
}

/**
 * Get SES configuration from environment.
 */
export function getSesConfig(): SesConfig {
    return {
        region: getOptionalEnv('AWS_SES_REGION', 'ap-south-1'),
        fromEmail: getRequiredEnv('AWS_SES_FROM_EMAIL'),
        configurationSet: getRequiredEnv('AWS_SES_CONFIGURATION_SET'),
    };
}

/**
 * Get SQS configuration from environment.
 */
export function getSqsConfig(): SqsConfig {
    return {
        region: getOptionalEnv('AWS_SQS_REGION', 'ap-south-1'),
        feedbackQueueUrl: getRequiredEnv('AWS_SQS_QUEUE_URL'),
        sendingQueueUrl: process.env.SQS_SENDING_QUEUE_URL,
        verificationQueueUrl: process.env.SQS_VERIFICATION_QUEUE_URL,
    };
}

/**
 * Get DynamoDB table names from environment.
 */
export function getDynamoDbConfig(): DynamoDbConfig {
    return {
        leadsTable: getRequiredEnv('DYNAMODB_TABLE_LEADS'),
        campaignsTable: getRequiredEnv('DYNAMODB_TABLE_CAMPAIGNS'),
        logsTable: getRequiredEnv('DYNAMODB_TABLE_LOGS'),
        metricsTable: getRequiredEnv('DYNAMODB_TABLE_METRICS'),
        settingsTable: getRequiredEnv('DYNAMODB_TABLE_SETTINGS'),
    };
}

/**
 * Get secret from environment (placeholder for Secrets Manager).
 */
export function getSecret(name: string): string {
    return process.env[name] || '';
}
