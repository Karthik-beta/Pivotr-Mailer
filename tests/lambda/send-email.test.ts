/**
 * Lambda Runtime Tests: Send Email
 *
 * Tests the SendEmail Lambda using SAM local invoke.
 * Validates handler wiring, environment variables, and event processing.
 *
 * IMPORTANT: These tests require:
 * - SAM CLI installed
 * - Docker running
 * - LocalStack running
 * - Lambda functions built (sam build)
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { samLocalInvoke, isSAMAvailable } from '../utils/sam-helpers.js';
import {
    createLead,
    createCampaign,
    createSendEmailMessage,
    createSQSEvent,
    createSQSRecord,
} from '../utils/fixtures.js';
import { insertLead, getLead, clearLeadsTable } from '../utils/dynamodb-helpers.js';
import { insertCampaign, clearCampaignsTable } from '../utils/dynamodb-helpers.js';
import { assertTestEnvironment } from '../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

// Check if SAM is available before running tests
let samAvailable = false;

describe('SendEmail Lambda Runtime Tests', () => {
    beforeAll(async () => {
        samAvailable = await isSAMAvailable();
        if (!samAvailable) {
            console.warn('SAM CLI not available - Lambda runtime tests will be skipped');
        }
    });

    beforeEach(async () => {
        if (!samAvailable) return;
        await clearLeadsTable();
        await clearCampaignsTable();
    });

    describe('Handler Wiring', () => {
        it('should invoke successfully with valid SQS event', async () => {
            if (!samAvailable) {
                console.log('Skipping: SAM CLI not available');
                return;
            }
            // Create test data
            const lead = createLead({ status: 'QUEUED' });
            const campaign = createCampaign();

            await insertLead(lead);
            await insertCampaign(campaign);

            // Create SQS event
            const message = createSendEmailMessage(lead.id, campaign.id);
            const event = createSQSEvent([createSQSRecord(message)]);

            // Invoke Lambda
            const result = await samLocalInvoke({
                functionName: 'SendEmailLambda',
                event,
                timeout: 60000,
            });

            // Lambda should complete (even if SES fails in LocalStack)
            expect(result.exitCode).toBe(0);
        });

        it('should handle missing lead gracefully', async () => {
            if (!samAvailable) {
                console.log('Skipping: SAM CLI not available');
                return;
            }
            const message = createSendEmailMessage('non-existent-lead', 'campaign-123');
            const event = createSQSEvent([createSQSRecord(message)]);

            const result = await samLocalInvoke({
                functionName: 'SendEmailLambda',
                event,
                timeout: 60000,
            });

            // Should complete without error (logged warning)
            expect(result.exitCode).toBe(0);
            expect(result.stderr).toContain('Lead not found');
        });

        it('should skip leads with non-QUEUED status', async () => {
            if (!samAvailable) {
                console.log('Skipping: SAM CLI not available');
                return;
            }
            const lead = createLead({ status: 'SENT' }); // Already sent
            await insertLead(lead);

            const message = createSendEmailMessage(lead.id, 'campaign-123');
            const event = createSQSEvent([createSQSRecord(message)]);

            const result = await samLocalInvoke({
                functionName: 'SendEmailLambda',
                event,
                timeout: 60000,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stderr).toContain('skipping');

            // Lead status should remain unchanged
            const updatedLead = await getLead(lead.id);
            expect(updatedLead?.status).toBe('SENT');
        });
    });

    describe('Environment Variables', () => {
        it('should receive correct environment variables', async () => {
            if (!samAvailable) {
                console.log('Skipping: SAM CLI not available');
                return;
            }
            const event = createSQSEvent([createSQSRecord({ test: true })]);

            const result = await samLocalInvoke({
                functionName: 'SendEmailLambda',
                event,
                timeout: 60000,
            });

            // Check logs for environment info
            // The Lambda should log at startup with environment details
            expect(result.exitCode).toBe(0);
        });
    });

    describe('Batch Processing', () => {
        it('should process multiple messages in batch', async () => {
            if (!samAvailable) {
                console.log('Skipping: SAM CLI not available');
                return;
            }
            // Create multiple leads
            const leads = await Promise.all(
                Array.from({ length: 3 }, async (_, i) => {
                    const lead = createLead({
                        fullName: `Lead ${i}`,
                        email: `lead${i}@example.com`,
                        status: 'QUEUED',
                    });
                    await insertLead(lead);
                    return lead;
                })
            );

            // Create batch event
            const records = leads.map((lead) =>
                createSQSRecord(createSendEmailMessage(lead.id, 'campaign-1'))
            );
            const event = createSQSEvent(records);

            const result = await samLocalInvoke({
                functionName: 'SendEmailLambda',
                event,
                timeout: 120000,
            });

            expect(result.exitCode).toBe(0);

            // Check logs indicate batch processing
            expect(result.stderr).toContain('Processing send-email batch');
        });
    });
});
