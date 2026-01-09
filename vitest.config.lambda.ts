import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

/**
 * Lambda Runtime Test Configuration
 *
 * Tests Lambda handlers via AWS SAM local invoke.
 * Validates handler wiring, environment variables, and event parsing.
 * Requires Docker and SAM CLI.
 *
 * Run with: bun test:lambda
 */
export default mergeConfig(baseConfig, defineConfig({
    test: {
        name: 'lambda',
        include: [
            'tests/lambda/**/*.test.ts',
            'tests/lambda/**/*.spec.ts',
        ],
        // SAM local invoke can be slow
        testTimeout: 120000,
        hookTimeout: 120000,
        // Retry once for container startup issues
        retry: 1,
        // Run tests sequentially - SAM containers can conflict (Vitest 4.x compatible)
        pool: 'forks',
        isolate: true,
        fileParallelism: false,
        // Setup file for Lambda tests
        setupFiles: ['./tests/setup/lambda.setup.ts'],
        // Environment
        env: {
            TEST_LAYER: 'lambda',
            SAM_CLI_TELEMETRY: '0',
        },
    },
}));
