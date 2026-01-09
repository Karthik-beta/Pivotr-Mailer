/**
 * Global Test Setup
 *
 * Runs before all tests in all layers.
 * Sets up common environment and utilities.
 *
 * CRITICAL: This file enforces strict environment separation.
 * Production configuration is blocked by design.
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { setupTestEnvironment, assertTestEnvironment } from '../config/environment-guard.js';
import { testConfig } from '../config/test-config.js';

// =============================================================================
// ENVIRONMENT SAFETY - First Priority
// =============================================================================

// Set up test environment IMMEDIATELY before anything else
setupTestEnvironment();

// =============================================================================
// Global Setup
// =============================================================================

beforeAll(() => {
    // Re-validate environment at the start of test runs
    assertTestEnvironment();

    // Ensure we're in test environment
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('NODE_ENV must be "test". Environment safety check failed.');
    }

    // Verify LocalStack endpoint is configured
    if (!process.env.AWS_ENDPOINT_URL?.includes('localhost') &&
        !process.env.AWS_ENDPOINT_URL?.includes('127.0.0.1') &&
        !process.env.AWS_ENDPOINT_URL?.includes('host.docker.internal')) {
        throw new Error('AWS_ENDPOINT_URL must point to LocalStack (localhost:4566)');
    }

    // Set common test environment variables
    process.env.AWS_REGION = testConfig.aws.region;
    process.env.AWS_ACCESS_KEY_ID = testConfig.aws.credentials.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = testConfig.aws.credentials.secretAccessKey;

    // Disable Lambda Powertools features that might interfere
    process.env.POWERTOOLS_DEV = 'true';
    process.env.POWERTOOLS_LOG_LEVEL = 'WARN'; // Reduce noise

    console.log('');
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│  TEST ENVIRONMENT INITIALIZED                       │');
    console.log('│  Endpoint: ' + process.env.AWS_ENDPOINT_URL?.padEnd(40) + '│');
    console.log('│  Region:   ' + (process.env.AWS_REGION || 'not set').padEnd(40) + '│');
    console.log('│  Layer:    ' + (process.env.TEST_LAYER || 'unit').padEnd(40) + '│');
    console.log('└─────────────────────────────────────────────────────┘');
    console.log('');
});

afterAll(() => {
    // Cleanup after all tests
});

// =============================================================================
// Global Hooks
// =============================================================================

beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
});

afterEach(() => {
    // Reset any runtime state
    vi.restoreAllMocks();
});

// =============================================================================
// Global Utilities
// =============================================================================

/**
 * Custom matchers for testing
 */
declare global {
    namespace Vi {
        interface Assertion<T = unknown> {
            toBeValidUUID(): void;
            toBeISO8601Date(): void;
        }
    }
}

// Note: Custom matchers would be added here if needed
// For now, we rely on standard Vitest matchers
