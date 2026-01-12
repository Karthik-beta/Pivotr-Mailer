import { describe, it, expect, vi, beforeEach } from 'vitest';
// Remove aws-sdk-client-mock import
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
// Mock logger
vi.mock('@aws-lambda-powertools/logger', () => ({
    Logger: class {
        info() { }
        error() { }
        warn() { }
        debug() { }
    }
}));

// Create a mock send function
const mockSend = vi.fn();

// Mock DynamoDBDocumentClient
vi.mock('@aws-sdk/lib-dynamodb', async () => {
    const actual = await vi.importActual('@aws-sdk/lib-dynamodb');
    return {
        ...actual,
        DynamoDBDocumentClient: {
            from: () => ({
                send: mockSend
            })
        },
        BatchWriteCommand: class {
            params: any;
            constructor(params: any) {
                this.params = params;
            }
        }
    };
});

// Import handlers using dynamic import to ensure mocks are applied
const leadImportPath = '../../../lambda/lead-import/src/index';

describe('Bulk Safety Fixes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSend.mockReset();
        process.env.DYNAMODB_TABLE_LEADS = 'LeadsTable';
    });

    describe('Lead Import - UnprocessedItems Retry', () => {
        it('should retry UnprocessedItems and eventually succeed', async () => {
            const { saveLeads } = await import(leadImportPath);
            const leads = [{ id: '1', email: 'test@example.com' }];

            // Mock implementation for send
            // 1st call: returns UnprocessedItems
            // 2nd call: returns success
            let callCount = 0;
            mockSend.mockImplementation(async (command) => {
                callCount++;
                if (callCount === 1) {
                    return {
                        UnprocessedItems: {
                            'LeadsTable': [{ PutRequest: { Item: { id: '1' } } }]
                        }
                    };
                }
                return { UnprocessedItems: {} };
            });

            const result = await saveLeads(leads);

            expect(result.inserted).toBe(1);
            expect(result.errors).toHaveLength(0);
            expect(mockSend).toHaveBeenCalledTimes(2);
        });

        it('should give up after max retries and report errors', async () => {
            const { saveLeads } = await import(leadImportPath);
            const leads = [{ id: '1', email: 'test@example.com' }];

            // Always fail with UnprocessedItems
            mockSend.mockResolvedValue({
                UnprocessedItems: {
                    'LeadsTable': [{ PutRequest: { Item: { id: '1' } } }]
                }
            });

            const result = await saveLeads(leads);

            expect(result.inserted).toBe(0);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Failed to save');
            // Initial + 3 retries = 4 calls
            expect(mockSend).toHaveBeenCalledTimes(4);
        });
    });

    describe('Process Feedback - Reputation Check Batching', () => {
        const processFeedbackPath = '../../../lambda/process-feedback/src/index';

        it('should check reputation only once per batch of bounces', async () => {
            const { handler } = await import(processFeedbackPath);

            // Mock implementation based on command type
            mockSend.mockImplementation(async (command: any) => {
                // Check if it's a QueryCommand (used for finding lead)
                // Note: command object structure depends on the SDK, checking prototype name or params
                if (command.constructor.name === 'QueryCommand' || (command.input && command.input.IndexName === 'MessageIdIndex')) {
                    return { Items: [{ id: 'lead1' }] };
                }
                // Default for UpdateCommand/GetCommand
                return { Item: { sent: 100, bounces: 5 } };
            });

            const createRecord = (msgId: string) => ({
                body: JSON.stringify({
                    Message: JSON.stringify({
                        notificationType: 'Bounce',
                        mail: { messageId: msgId },
                        bounce: {
                            bounceType: 'Permanent',
                            bouncedRecipients: [{ emailAddress: 'fail@example.com' }]
                        }
                    })
                }),
                messageId: msgId
            });

            const event = {
                Records: [createRecord('msg1'), createRecord('msg2')]
            };

            await handler(event as any, {} as any, () => { });

            // Verify GetCommand was called exactly ONCE (for reputation check)
            // We need to inspect the calls to see which command type was used.
            // Since we mocked the client 'send', we can check arguments.

            // Filters calls that look like GetCommand (TableName contains Metrics or logic implies it)
            // Note: Since we didn't mock GetCommand class specifically in the test file imports to check instanceof,
            // we rely on the command handling in the lambda. The lambda uses GetCommand.

            // We can check total calls = 7.
            // 2 Query + 2 Update(Lead) + 2 Update(Metric) + 1 Get(Reputation)

            expect(mockSend).toHaveBeenCalledTimes(7);
        });
    });
});
