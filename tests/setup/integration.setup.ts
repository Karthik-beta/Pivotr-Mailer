/**
 * Integration Test Setup
 *
 * Runs before integration tests.
 * Ensures LocalStack is available and tables are clean.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { waitForLocalStack, testConfig } from '../config/test-config.js';
import { bootstrapLocalStack } from '../localstack/bootstrap.js';
import { resetClients } from '../utils/aws-clients.js';
import { clearAllTables } from '../utils/dynamodb-helpers.js';
import { purgeAllQueues } from '../utils/sqs-helpers.js';

// Track if bootstrap has run
let bootstrapped = false;

// =============================================================================
// Integration Test Setup
// =============================================================================

beforeAll(async () => {
    console.log('');
    console.log('==========================================');
    console.log('Integration Test Setup');
    console.log('==========================================');
    console.log(`LocalStack endpoint: ${testConfig.aws.endpoint}`);

    // Wait for LocalStack to be available
    console.log('Waiting for LocalStack...');
    await waitForLocalStack(60000);
    console.log('LocalStack is ready!');

    // Bootstrap only once per test run
    if (!bootstrapped) {
        console.log('Bootstrapping LocalStack resources...');
        await bootstrapLocalStack();
        bootstrapped = true;
    }

    console.log('==========================================');
    console.log('');
});

beforeEach(async () => {
    // Clean up data between tests for isolation
    await Promise.all([
        clearAllTables(),
        purgeAllQueues(),
    ]);
});

afterAll(async () => {
    // Reset AWS clients
    resetClients();
});
