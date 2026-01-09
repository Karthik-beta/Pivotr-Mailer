/**
 * Lambda Runtime Test Setup
 *
 * Runs before Lambda tests.
 * Ensures SAM CLI and Docker are available.
 */

import { beforeAll, afterAll } from 'vitest';
import { isSAMAvailable, stopSAMLocalAPI } from '../utils/sam-helpers.js';
import { waitForLocalStack } from '../config/test-config.js';
import { bootstrapLocalStack } from '../localstack/bootstrap.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Track if setup has run
let isSetup = false;

// =============================================================================
// Lambda Test Setup
// =============================================================================

beforeAll(async () => {
    console.log('');
    console.log('==========================================');
    console.log('Lambda Runtime Test Setup');
    console.log('==========================================');

    // Check SAM CLI availability
    const samAvailable = await isSAMAvailable();
    if (!samAvailable) {
        throw new Error(
            'SAM CLI is not available. Please install it: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html'
        );
    }
    console.log('✓ SAM CLI is available');

    // Check Docker availability
    try {
        await execAsync('docker info');
        console.log('✓ Docker is available');
    } catch {
        throw new Error(
            'Docker is not available. Please ensure Docker Desktop is running.'
        );
    }

    // Check LocalStack
    console.log('Waiting for LocalStack...');
    await waitForLocalStack(60000);
    console.log('✓ LocalStack is ready');

    // Bootstrap LocalStack if needed
    if (!isSetup) {
        console.log('Bootstrapping LocalStack resources...');
        await bootstrapLocalStack();
        isSetup = true;
    }

    // Build Lambda artifacts
    console.log('Building Lambda functions...');
    try {
        await execAsync('sam build', { timeout: 120000 });
        console.log('✓ Lambda functions built');
    } catch (error) {
        console.error('Failed to build Lambda functions:', error);
        throw error;
    }

    console.log('==========================================');
    console.log('');
});

afterAll(async () => {
    // Stop SAM local API if running
    await stopSAMLocalAPI();
});
