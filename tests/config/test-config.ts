/**
 * Test Environment Configuration
 *
 * Centralized configuration for all test layers.
 * Loads from environment variables with sensible defaults for LocalStack.
 */

export interface TestConfig {
    // Test layer
    layer: 'unit' | 'integration' | 'lambda';

    // AWS Configuration
    aws: {
        endpoint: string;
        region: string;
        credentials: {
            accessKeyId: string;
            secretAccessKey: string;
        };
    };

    // DynamoDB Tables
    dynamodb: {
        tables: {
            leads: string;
            campaigns: string;
            metrics: string;
            logs: string;
            settings: string;
        };
    };

    // SQS Queues
    sqs: {
        queues: {
            sending: string;
            feedback: string;
            verification: string;
            sendingDlq: string;
            feedbackDlq: string;
            verificationDlq: string;
        };
    };

    // SNS Topics
    sns: {
        topics: {
            alarms: string;
            sesFeedback: string;
        };
    };

    // SES Configuration
    ses: {
        fromEmail: string;
        configurationSet: string;
    };

    // S3 Configuration
    s3: {
        buckets: {
            auditLogs: string;
        };
    };

    // CloudWatch Configuration
    cloudwatch: {
        logs: {
            logGroupPrefix: string;
            testLogGroup: string;
        };
        metrics: {
            namespace: string;
        };
    };

    // Logging
    logLevel: string;
}

/**
 * Get environment variable with fallback
 */
function getEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

/**
 * Detect the current test layer
 */
function detectTestLayer(): TestConfig['layer'] {
    const layer = getEnv('TEST_LAYER', 'unit');
    if (layer === 'integration' || layer === 'lambda' || layer === 'unit') {
        return layer;
    }
    return 'unit';
}

/**
 * Build test configuration from environment
 */
export function getTestConfig(): TestConfig {
    const endpoint = getEnv('AWS_ENDPOINT_URL', 'http://localhost:4566');
    const accountId = '000000000000'; // LocalStack default

    return {
        layer: detectTestLayer(),

        aws: {
            endpoint,
            region: getEnv('AWS_REGION', 'us-east-1'),
            credentials: {
                accessKeyId: getEnv('AWS_ACCESS_KEY_ID', 'test'),
                secretAccessKey: getEnv('AWS_SECRET_ACCESS_KEY', 'test'),
            },
        },

        dynamodb: {
            tables: {
                leads: getEnv('DYNAMODB_TABLE_LEADS', 'pivotr-leads'),
                campaigns: getEnv('DYNAMODB_TABLE_CAMPAIGNS', 'pivotr-campaigns'),
                metrics: getEnv('DYNAMODB_TABLE_METRICS', 'pivotr-metrics'),
                logs: getEnv('DYNAMODB_TABLE_LOGS', 'pivotr-logs'),
                settings: getEnv('DYNAMODB_TABLE_SETTINGS', 'pivotr-settings'),
            },
        },

        sqs: {
            queues: {
                sending: getEnv('SQS_QUEUE_SENDING', `${endpoint}/${accountId}/sending-queue`),
                feedback: getEnv('SQS_QUEUE_FEEDBACK', `${endpoint}/${accountId}/feedback-queue`),
                verification: getEnv('SQS_QUEUE_VERIFICATION', `${endpoint}/${accountId}/verification-queue`),
                sendingDlq: `${endpoint}/${accountId}/sending-dlq`,
                feedbackDlq: `${endpoint}/${accountId}/feedback-dlq`,
                verificationDlq: `${endpoint}/${accountId}/verification-dlq`,
            },
        },

        sns: {
            topics: {
                alarms: `arn:aws:sns:us-east-1:${accountId}:pivotr-alarms`,
                sesFeedback: `arn:aws:sns:us-east-1:${accountId}:pivotr-ses-feedback`,
            },
        },

        ses: {
            fromEmail: getEnv('SES_FROM_EMAIL', 'noreply@pivotr.local'),
            configurationSet: getEnv('SES_CONFIGURATION_SET', 'PivotrLocalConfigSet'),
        },

        s3: {
            buckets: {
                auditLogs: getEnv('S3_BUCKET_AUDIT_LOGS', 'pivotr-audit-logs'),
            },
        },

        cloudwatch: {
            logs: {
                logGroupPrefix: getEnv('CLOUDWATCH_LOG_GROUP_PREFIX', '/aws/lambda/pivotr'),
                testLogGroup: getEnv('CLOUDWATCH_TEST_LOG_GROUP', '/pivotr/test'),
            },
            metrics: {
                namespace: getEnv('CLOUDWATCH_METRICS_NAMESPACE', 'PivotrMailer'),
            },
        },

        logLevel: getEnv('LOG_LEVEL', 'DEBUG'),
    };
}

/**
 * Get AWS client configuration for LocalStack
 */
export function getAWSClientConfig() {
    const config = getTestConfig();

    // For unit tests, return config that will fail if accidentally called
    if (config.layer === 'unit') {
        return {
            endpoint: 'http://localhost:0', // Invalid endpoint
            region: config.aws.region,
            credentials: config.aws.credentials,
        };
    }

    return {
        endpoint: config.aws.endpoint,
        region: config.aws.region,
        credentials: config.aws.credentials,
    };
}

/**
 * Check if LocalStack is available
 */
export async function isLocalStackAvailable(): Promise<boolean> {
    const config = getTestConfig();

    try {
        const response = await fetch(`${config.aws.endpoint}/_localstack/health`, {
            signal: AbortSignal.timeout(3000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Wait for LocalStack to be ready
 */
export async function waitForLocalStack(
    timeoutMs: number = 30000,
    intervalMs: number = 1000
): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        if (await isLocalStackAvailable()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`LocalStack not available after ${timeoutMs}ms`);
}

// Export singleton config
export const testConfig = getTestConfig();
