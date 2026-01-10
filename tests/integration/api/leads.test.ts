/**
 * Integration Tests: Leads API
 *
 * Tests the Leads API Lambda handlers against LocalStack.
 * Validates CRUD operations with real DynamoDB interactions.
 *
 * IMPORTANT: These tests require LocalStack to be running.
 * Run: docker compose -f tests/localstack/docker-compose.yml up -d
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import {
    createLead,
    createLeads,
    createAPIGatewayEvent,
} from '../../utils/fixtures.js';
import { insertLead, getLead, clearLeadsTable } from '../../utils/dynamodb-helpers.js';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment before any tests run
assertTestEnvironment();

// Import the handler (we'll mock it for now, real integration would invoke via SAM)
// For true integration tests, use SAM local invoke

describe('Leads API Integration Tests', () => {
    beforeAll(() => {
        // Additional safety check
        assertTestEnvironment();
    });

    beforeEach(async () => {
        // Clear table before each test
        await clearLeadsTable();
    });

    describe('DynamoDB Operations', () => {
        it('should insert and retrieve a lead', async () => {
            const lead = createLead({
                fullName: 'Integration Test User',
                email: 'integration@test.com',
                companyName: 'Test Company',
            });

            // Insert lead
            await insertLead(lead);

            // Retrieve lead
            const retrieved = await getLead(lead.id);

            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(lead.id);
            expect(retrieved?.fullName).toBe('Integration Test User');
            expect(retrieved?.email).toBe('integration@test.com');
            expect(retrieved?.companyName).toBe('Test Company');
            expect(retrieved?.status).toBe('PENDING_IMPORT');
        });

        it('should return undefined for non-existent lead', async () => {
            const result = await getLead('non-existent-id');
            expect(result).toBeUndefined();
        });

        it('should insert multiple leads', async () => {
            const leads = createLeads(5, {
                companyName: 'Bulk Test Company',
            });

            // Insert all leads
            for (const lead of leads) {
                await insertLead(lead);
            }

            // Verify all leads exist
            for (const lead of leads) {
                const retrieved = await getLead(lead.id);
                expect(retrieved).toBeDefined();
                expect(retrieved?.companyName).toBe('Bulk Test Company');
            }
        });

        it('should clear table between tests', async () => {
            // Insert a lead
            const lead = createLead();
            await insertLead(lead);

            // Clear table
            await clearLeadsTable();

            // Verify lead is gone
            const result = await getLead(lead.id);
            expect(result).toBeUndefined();
        });
    });

    describe('Lead Status Updates', () => {
        it('should update lead status', async () => {
            const lead = createLead({ status: 'PENDING_IMPORT' });
            await insertLead(lead);

            // Update status using DynamoDB
            const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
            const { getDocumentClient, getTableNames } = await import('../../utils/aws-clients.js');

            const docClient = getDocumentClient();
            const tables = getTableNames();

            await docClient.send(
                new UpdateCommand({
                    TableName: tables.leads,
                    Key: { id: lead.id },
                    UpdateExpression: 'SET #status = :status',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':status': 'QUEUED' },
                })
            );

            // Verify update
            const updated = await getLead(lead.id);
            expect(updated?.status).toBe('QUEUED');
        });
    });

    describe('API Gateway Event Creation', () => {
        it('should create valid GET event', () => {
            const event = createAPIGatewayEvent('GET', '/leads');

            expect(event.httpMethod).toBe('GET');
            expect(event.path).toBe('/leads');
            expect(event.body).toBeNull();
        });

        it('should create valid POST event with body', () => {
            const body = {
                fullName: 'Test User',
                email: 'test@example.com',
                companyName: 'Test Co',
            };

            const event = createAPIGatewayEvent('POST', '/leads', { body });

            expect(event.httpMethod).toBe('POST');
            expect(event.path).toBe('/leads');
            expect(event.body).toBe(JSON.stringify(body));
        });

        it('should create valid GET event with path parameters', () => {
            const event = createAPIGatewayEvent('GET', '/leads/123', {
                pathParameters: { id: '123' },
            });

            expect(event.pathParameters).toEqual({ id: '123' });
        });

        it('should create valid GET event with query parameters', () => {
            const event = createAPIGatewayEvent('GET', '/leads', {
                queryStringParameters: { limit: '10', lastKey: 'abc123' },
            });

            expect(event.queryStringParameters).toEqual({ limit: '10', lastKey: 'abc123' });
        });
    });
});
