/**
 * AWS SES + SQS Full Test Suite
 * Runs all SES and SQS tests in sequence
 * 
 * Run: bun run test-all.ts
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function runScript(name: string, description: string): boolean {
    console.log('\n');
    console.log('═'.repeat(60));
    console.log(`  ${description}`);
    console.log('═'.repeat(60));

    const result = spawnSync('bun', ['run', name], {
        cwd: scriptDir,
        stdio: 'inherit',
    });

    return result.status === 0;
}

async function main(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║        AWS SES + SQS Full Test Suite - Pivotr Mailer       ║');
    console.log('║                                                            ║');
    console.log('║  This script runs all AWS integration tests:               ║');
    console.log('║  1. SES Tests (account access, identities, sending)        ║');
    console.log('║  2. SQS Tests (queue access, event processing)             ║');
    console.log('║  3. E2E Pipeline (SES → SNS → SQS verification)            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const startTime = Date.now();
    const results: Record<string, boolean> = {};

    // Run SES tests
    results['SES Tests'] = runScript('test-ses.ts', '📧 Running SES Tests...');

    // Run SQS tests
    results['SQS Tests'] = runScript('test-sqs.ts', '📨 Running SQS Tests...');

    // Run E2E Pipeline test
    results['E2E Pipeline'] = runScript('test-e2e-pipeline.ts', '🔄 Running E2E Pipeline Test...');

    // Final Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    FULL TEST SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    let passed = 0;
    let failed = 0;

    for (const [test, result] of Object.entries(results)) {
        const status = result ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${status}  ${test}`);
        if (result) passed++;
        else failed++;
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`   Duration: ${duration}s`);
    console.log(`   Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('─'.repeat(50));

    if (failed > 0) {
        console.log('\n⚠️  Some test suites failed. Review the output above.');
        process.exit(1);
    } else {
        console.log('\n🎉 All AWS integration tests passed!');
    }
}

main().catch(console.error);
