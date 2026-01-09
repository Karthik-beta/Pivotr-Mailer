/**
 * LocalStack Global Setup for Vitest
 *
 * This file is used as globalSetup in vitest.config.integration.ts.
 * It runs once before all integration tests.
 */

import { spawn, type ChildProcess } from 'child_process';

let localstackProcess: ChildProcess | null = null;

/**
 * Check if LocalStack is already running
 */
async function isLocalStackRunning(): Promise<boolean> {
    try {
        const response = await fetch('http://localhost:4566/_localstack/health', {
            signal: AbortSignal.timeout(2000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Start LocalStack if not running
 */
async function startLocalStack(): Promise<void> {
    console.log('Checking if LocalStack is running...');

    if (await isLocalStackRunning()) {
        console.log('LocalStack is already running');
        return;
    }

    console.log('Starting LocalStack via docker compose...');

    localstackProcess = spawn(
        'docker',
        ['compose', '-f', 'tests/localstack/docker-compose.yml', 'up', '-d'],
        {
            cwd: process.cwd(),
            stdio: 'inherit',
        }
    );

    await new Promise<void>((resolve, reject) => {
        localstackProcess!.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`docker compose exited with code ${code}`));
            }
        });
        localstackProcess!.on('error', reject);
    });

    // Wait for LocalStack to be healthy
    console.log('Waiting for LocalStack to be healthy...');
    const startTime = Date.now();
    const timeout = 60000;

    while (Date.now() - startTime < timeout) {
        if (await isLocalStackRunning()) {
            console.log('LocalStack is healthy');
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('LocalStack failed to start within timeout');
}

/**
 * Global setup function (called by Vitest)
 */
export async function setup(): Promise<void> {
    await startLocalStack();
}

/**
 * Global teardown function (called by Vitest)
 */
export async function teardown(): Promise<void> {
    // Don't stop LocalStack - it may be used by other processes
    // User can stop it manually with: docker compose down
    console.log('Integration tests complete. LocalStack left running for reuse.');
}

/**
 * Default export for Vitest 4.x globalSetup
 * Must export a function that optionally returns a teardown function
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
    await startLocalStack();
    return teardown;
}
