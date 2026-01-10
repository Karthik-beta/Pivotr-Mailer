import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest Configuration
 *
 * Supports multiple testing layers:
 * - unit: Fast, isolated business logic tests (no AWS services)
 * - integration: Tests against LocalStack (requires Docker)
 * - lambda: Tests Lambda handlers via SAM local invoke
 */
export default defineConfig({
    test: {
        // Global test settings
        globals: true,
        environment: 'node',

        // Test file patterns
        include: [
            'tests/**/*.test.ts',
            'tests/**/*.spec.ts',
            'lambda/**/tests/**/*.test.ts',
            'shared/**/tests/**/*.test.ts',
        ],

        // Exclude patterns
        exclude: [
            'node_modules',
            'dist',
            '**/node_modules/**',
            'frontend/**',
            'old_frontend/**',
        ],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage',
            include: [
                'lambda/**/src/**/*.ts',
                'shared/**/*.ts',
            ],
            exclude: [
                'node_modules/**',
                'tests/**',
                '**/*.test.ts',
                '**/*.spec.ts',
                '**/dist/**',
            ],
            thresholds: {
                statements: 70,
                branches: 60,
                functions: 70,
                lines: 70,
            },
        },

        // Timeout settings
        testTimeout: 30000,
        hookTimeout: 30000,

        // Reporter configuration
        reporters: ['verbose', 'json'],
        outputFile: {
            json: './test-results/results.json',
        },

        // Retry failed tests once (useful for flaky integration tests)
        retry: 0,

        // Pool configuration for parallel execution (Vitest 4.x compatible)
        pool: 'threads',
        isolate: true,
        fileParallelism: true,

        // Sequence for deterministic ordering
        sequence: {
            shuffle: false,
        },

        // Setup files
        setupFiles: ['./tests/setup/global.setup.ts'],

        // Environment variables for tests
        env: {
            NODE_ENV: 'test',
        },
    },

    // Path resolution matching tsconfig
    resolve: {
        alias: {
            '@shared': resolve(__dirname, './shared'),
            '@lambda': resolve(__dirname, './lambda'),
            '@tests': resolve(__dirname, './tests'),
        },
    },

    // ESBuild options for TypeScript
    esbuild: {
        target: 'node20',
    },
});
