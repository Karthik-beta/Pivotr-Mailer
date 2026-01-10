/**
 * Environment Guard
 *
 * Prevents accidental cross-environment usage.
 * Must be imported at the start of any test file or test setup.
 *
 * SAFETY: This module will throw if it detects production configuration
 * is being used during test execution.
 */

// =============================================================================
// Environment Constants
// =============================================================================

export const ENVIRONMENTS = {
    TEST: 'test',
    LOCAL: 'local',
    DEV: 'development',
    PROD: 'production',
} as const;

export type Environment = (typeof ENVIRONMENTS)[keyof typeof ENVIRONMENTS];

// =============================================================================
// Production Detection
// =============================================================================

/**
 * Patterns that indicate production configuration
 */
const PRODUCTION_INDICATORS = {
    endpoints: [
        /\.amazonaws\.com/i,           // Real AWS endpoints
        /\.aws\.amazon\.com/i,         // AWS console
        /dynamodb\.[a-z]{2}-[a-z]+-\d\.amazonaws\.com/i,  // DynamoDB
        /sqs\.[a-z]{2}-[a-z]+-\d\.amazonaws\.com/i,       // SQS
        /ses\.[a-z]{2}-[a-z]+-\d\.amazonaws\.com/i,       // SES
        /sns\.[a-z]{2}-[a-z]+-\d\.amazonaws\.com/i,       // SNS
    ],
    regions: [
        'ap-south-1',    // Production region (from CDK stack)
    ],
    tableNames: [
        /^(prod|production)-/i,    // Production prefixed tables
        /LeadsTable$/,             // CDK-generated table names
        /CampaignsTable$/,
        /MetricsTable$/,
    ],
} as const;

// =============================================================================
// Validation Functions
// =============================================================================

export interface EnvironmentViolation {
    type: 'endpoint' | 'region' | 'table' | 'env_var' | 'config';
    message: string;
    value: string;
}

/**
 * Check if a value looks like production configuration
 */
function detectProductionValue(value: string, type: keyof typeof PRODUCTION_INDICATORS): boolean {
    const patterns = PRODUCTION_INDICATORS[type];
    return patterns.some((pattern) => {
        if (pattern instanceof RegExp) {
            return pattern.test(value);
        }
        return value.includes(pattern);
    });
}

/**
 * Validate that the current environment is safe for testing
 */
export function validateTestEnvironment(): EnvironmentViolation[] {
    const violations: EnvironmentViolation[] = [];

    // Check NODE_ENV
    if (process.env.NODE_ENV === 'production') {
        violations.push({
            type: 'env_var',
            message: 'NODE_ENV is set to "production"',
            value: process.env.NODE_ENV,
        });
    }

    // Check ENVIRONMENT
    if (process.env.ENVIRONMENT === 'production') {
        violations.push({
            type: 'env_var',
            message: 'ENVIRONMENT is set to "production"',
            value: process.env.ENVIRONMENT,
        });
    }

    // Check AWS_ENDPOINT_URL
    const endpoint = process.env.AWS_ENDPOINT_URL;
    if (!endpoint) {
        violations.push({
            type: 'endpoint',
            message: 'AWS_ENDPOINT_URL is not set. Tests must use LocalStack.',
            value: 'undefined',
        });
    } else if (!endpoint.includes('localhost') && !endpoint.includes('127.0.0.1') && !endpoint.includes('host.docker.internal')) {
        violations.push({
            type: 'endpoint',
            message: 'AWS_ENDPOINT_URL does not point to localhost/LocalStack',
            value: endpoint,
        });
    }

    // Check for production regions
    const region = process.env.AWS_REGION;
    if (region && detectProductionValue(region, 'regions')) {
        violations.push({
            type: 'region',
            message: `AWS_REGION "${region}" is a production region. Use "us-east-1" for tests.`,
            value: region,
        });
    }

    // Check for production-looking credentials
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    if (accessKey && accessKey !== 'test' && accessKey.startsWith('AKIA')) {
        violations.push({
            type: 'env_var',
            message: 'AWS_ACCESS_KEY_ID appears to be a real AWS access key',
            value: accessKey.slice(0, 8) + '...',
        });
    }

    // Check table names
    const tableVars = [
        'DYNAMODB_TABLE_LEADS',
        'DYNAMODB_TABLE_CAMPAIGNS',
        'DYNAMODB_TABLE_METRICS',
        'DYNAMODB_TABLE_LOGS',
        'DYNAMODB_TABLE_SETTINGS',
    ];

    for (const varName of tableVars) {
        const value = process.env[varName];
        if (value && detectProductionValue(value, 'tableNames')) {
            violations.push({
                type: 'table',
                message: `${varName} appears to reference a production table`,
                value,
            });
        }
    }

    return violations;
}

/**
 * Assert that the environment is safe for testing
 * Throws if violations are found
 */
export function assertTestEnvironment(): void {
    const violations = validateTestEnvironment();

    if (violations.length > 0) {
        const message = [
            '',
            '╔═══════════════════════════════════════════════════════════════╗',
            '║  ENVIRONMENT SAFETY VIOLATION - TEST EXECUTION BLOCKED        ║',
            '╚═══════════════════════════════════════════════════════════════╝',
            '',
            'The following violations were detected:',
            '',
            ...violations.map((v, i) => `  ${i + 1}. [${v.type.toUpperCase()}] ${v.message}`),
            '',
            'Tests cannot run with production configuration.',
            'Please ensure you are using the correct environment:',
            '',
            '  1. Set NODE_ENV=test',
            '  2. Set AWS_ENDPOINT_URL=http://localhost:4566',
            '  3. Set AWS_REGION=us-east-1',
            '  4. Set AWS_ACCESS_KEY_ID=test',
            '  5. Use pivotr-* prefixed table names',
            '',
            'Run: bun run test:env:check to validate your environment',
            '',
        ].join('\n');

        throw new Error(message);
    }
}

/**
 * Set up safe test environment
 * Call this at the start of test setup
 */
export function setupTestEnvironment(): void {
    // Force test environment values
    process.env.NODE_ENV = 'test';
    process.env.ENVIRONMENT = 'test';

    // Set LocalStack endpoint if not set
    if (!process.env.AWS_ENDPOINT_URL) {
        process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
    }

    // Set safe region
    process.env.AWS_REGION = 'us-east-1';

    // Set test credentials
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';

    // Set test table names
    process.env.DYNAMODB_TABLE_LEADS = 'pivotr-leads';
    process.env.DYNAMODB_TABLE_CAMPAIGNS = 'pivotr-campaigns';
    process.env.DYNAMODB_TABLE_METRICS = 'pivotr-metrics';
    process.env.DYNAMODB_TABLE_LOGS = 'pivotr-logs';
    process.env.DYNAMODB_TABLE_SETTINGS = 'pivotr-settings';

    // Validate after setup
    assertTestEnvironment();
}

/**
 * Create isolated test environment for a specific test
 * Returns cleanup function
 */
export function createIsolatedEnvironment(overrides: Record<string, string> = {}): () => void {
    const originalEnv: Record<string, string | undefined> = {};

    // Save original values
    const keys = Object.keys(overrides);
    for (const key of keys) {
        originalEnv[key] = process.env[key];
        process.env[key] = overrides[key];
    }

    // Return cleanup function
    return () => {
        for (const key of keys) {
            if (originalEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = originalEnv[key];
            }
        }
    };
}
