/**
 * AWS SES/SQS Test Configuration
 * Loads environment variables from root .env file
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (two levels up from scripts/test-aws-ses-sqs)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
config({ path: envPath });

// --- Validation ---
function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        console.error(`❌ Missing required environment variable: ${key}`);
        console.error(`   Please ensure ${key} is set in your .env file`);
        process.exit(1);
    }
    return value;
}

function optionalEnv(key: string, fallback: string): string {
    return process.env[key] || fallback;
}

// --- Exported Configuration ---
export const AWS_CONFIG = {
    ses: {
        accessKeyId: requireEnv('AWS_SES_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('AWS_SES_SECRET_ACCESS_KEY'),
        region: optionalEnv('AWS_SES_REGION', 'ap-south-1'),
        // Configuration set name (required if you have a default set in AWS)
        configurationSet: optionalEnv('AWS_SES_CONFIGURATION_SET', ''),
    },
    sqs: {
        queueUrl: optionalEnv('AWS_SQS_QUEUE_URL', ''),
        region: optionalEnv('AWS_SQS_REGION', 'ap-south-1'),
    },
};

export const TEST_CONFIG = {
    toEmail: 'support@pivotr.in',
    // For SES sandbox: you may need a verified "from" email
    fromEmail: optionalEnv('AWS_SES_FROM_EMAIL', 'karthik@pivotr.in'),
};

// --- Log Configuration (masked) ---
export function logConfig(): void {
    console.log('\n📋 AWS Configuration:');
    console.log('─'.repeat(40));
    console.log(`   SES Region:       ${AWS_CONFIG.ses.region}`);
    console.log(`   SES Access Key:   ${AWS_CONFIG.ses.accessKeyId.slice(0, 8)}...`);
    console.log(`   SQS Region:       ${AWS_CONFIG.sqs.region}`);
    console.log(`   SQS Queue URL:    ${AWS_CONFIG.sqs.queueUrl || '(not set)'}`);
    console.log(`   Test Email (To):  ${TEST_CONFIG.toEmail}`);
    console.log(`   From Email:       ${TEST_CONFIG.fromEmail}`);
    console.log('─'.repeat(40));
}
