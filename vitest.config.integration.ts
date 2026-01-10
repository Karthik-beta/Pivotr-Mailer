import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

/**
 * Integration Test Configuration
 *
 * Tests Lambda handlers against LocalStack services.
 * Requires Docker and LocalStack running.
 *
 * Run with: bun test:integration
 */
export default mergeConfig(baseConfig, defineConfig({
    test: {
        name: 'integration',
        include: [
            'tests/integration/**/*.test.ts',
            'tests/integration/**/*.spec.ts',
        ],
        // Integration tests need more time
        testTimeout: 60000,
        hookTimeout: 60000,
        // Retry once for transient failures
        retry: 1,
        // Run tests sequentially to avoid resource conflicts (Vitest 4.x compatible)
        pool: 'forks',
        isolate: true,
        fileParallelism: false,
        // Setup file for integration tests
        setupFiles: ['./tests/setup/integration.setup.ts'],
        // Global setup/teardown for LocalStack
        globalSetup: './tests/setup/localstack.global.ts',
        // Environment
        env: {
            TEST_LAYER: 'integration',
            AWS_ENDPOINT_URL: 'http://localhost:4566',
            AWS_REGION: 'us-east-1',
            AWS_ACCESS_KEY_ID: 'test',
            AWS_SECRET_ACCESS_KEY: 'test',
        },
    },
}));
