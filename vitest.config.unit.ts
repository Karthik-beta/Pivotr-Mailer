import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

/**
 * Unit Test Configuration
 *
 * Fast, isolated tests for business logic.
 * No AWS services, no Docker, no external dependencies.
 *
 * Run with: bun test:unit
 */
export default mergeConfig(baseConfig, defineConfig({
    test: {
        name: 'unit',
        include: [
            'tests/unit/**/*.test.ts',
            'tests/unit/**/*.spec.ts',
            'lambda/**/tests/unit/**/*.test.ts',
            'shared/**/tests/unit/**/*.test.ts',
        ],
        exclude: [
            'tests/integration/**',
            'tests/lambda/**',
            'tests/e2e/**',
        ],
        // Unit tests should be fast
        testTimeout: 5000,
        hookTimeout: 5000,
        // No retry for unit tests - they should be deterministic
        retry: 0,
        // Setup file for unit tests
        setupFiles: ['./tests/setup/unit.setup.ts'],
        // Environment
        env: {
            TEST_LAYER: 'unit',
            // Mock AWS endpoints to ensure isolation
            AWS_ENDPOINT_URL: 'http://localhost:0', // Invalid endpoint to catch accidental calls
        },
    },
}));
