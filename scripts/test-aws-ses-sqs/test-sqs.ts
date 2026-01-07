/**
 * AWS SQS Test Script
 * Tests receiving and processing SES notification events from SQS
 * 
 * Run: bun run test-sqs.ts
 */

import {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
    GetQueueAttributesCommand,
    SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { AWS_CONFIG, logConfig } from './config';

// --- SQS Client Setup ---
const sqsClient = new SQSClient({
    region: AWS_CONFIG.sqs.region,
    credentials: {
        accessKeyId: AWS_CONFIG.ses.accessKeyId,
        secretAccessKey: AWS_CONFIG.ses.secretAccessKey,
    },
});

// --- Helper Functions ---
function success(msg: string): void {
    console.log(`✅ ${msg}`);
}

function fail(msg: string): void {
    console.error(`❌ ${msg}`);
}

function info(msg: string): void {
    console.log(`ℹ️  ${msg}`);
}

/**
 * SES Event Types as shown in AWS Console:
 * - Send: Email accepted by SES
 * - Rendering Failure: Template rendering failed
 * - Reject: Email rejected (virus, spam)  
 * - Delivery: Successfully delivered to recipient's mail server
 * - Hard Bounce: Permanent delivery failure
 * - Complaint: Recipient marked as spam
 * - Delivery Delay: Temporary delivery issue
 * - Subscription: List-Unsubscribe clicked
 * - Open: Email opened (tracking pixel)
 * - Click: Link clicked in email
 */
type SESEventType =
    | 'Send'
    | 'Rendering Failure'
    | 'Reject'
    | 'Delivery'
    | 'Bounce'
    | 'Complaint'
    | 'DeliveryDelay'
    | 'Subscription'
    | 'Open'
    | 'Click';

// Mock SES notification payloads for each event type
const MOCK_SES_EVENTS: Record<SESEventType, object> = {
    'Send': {
        eventType: 'Send',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-001',
            destination: ['support@pivotr.in'],
        },
        send: {},
    },
    'Rendering Failure': {
        eventType: 'Rendering Failure',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-002',
        },
        failure: {
            errorMessage: 'Template variable {{name}} was not provided',
            templateName: 'WelcomeEmail',
        },
    },
    'Reject': {
        eventType: 'Reject',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-003',
            destination: ['suspicious@example.com'],
        },
        reject: {
            reason: 'VIRUS',
        },
    },
    'Delivery': {
        eventType: 'Delivery',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-004',
            destination: ['support@pivotr.in'],
        },
        delivery: {
            timestamp: new Date().toISOString(),
            processingTimeMillis: 234,
            recipients: ['support@pivotr.in'],
            smtpResponse: '250 2.0.0 OK',
            remoteMtaIp: '192.0.2.1',
        },
    },
    'Bounce': {
        eventType: 'Bounce',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-005',
            destination: ['invalid@nowhere.invalid'],
        },
        bounce: {
            bounceType: 'Permanent',
            bounceSubType: 'NoEmail',
            bouncedRecipients: [
                {
                    emailAddress: 'invalid@nowhere.invalid',
                    action: 'failed',
                    status: '5.1.1',
                    diagnosticCode: 'smtp; 550 5.1.1 User Unknown',
                },
            ],
            timestamp: new Date().toISOString(),
            feedbackId: 'test-feedback-id-001',
        },
    },
    'Complaint': {
        eventType: 'Complaint',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-006',
            destination: ['complainer@example.com'],
        },
        complaint: {
            complainedRecipients: [
                { emailAddress: 'complainer@example.com' },
            ],
            timestamp: new Date().toISOString(),
            feedbackId: 'test-feedback-id-002',
            complaintFeedbackType: 'abuse',
        },
    },
    'DeliveryDelay': {
        eventType: 'DeliveryDelay',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-007',
            destination: ['slow@example.com'],
        },
        deliveryDelay: {
            timestamp: new Date().toISOString(),
            delayType: 'InternalFailure',
            expirationTime: new Date(Date.now() + 3600000).toISOString(),
            delayedRecipients: [
                {
                    emailAddress: 'slow@example.com',
                    status: '4.4.1',
                    diagnosticCode: 'Connection timed out',
                },
            ],
        },
    },
    'Subscription': {
        eventType: 'Subscription',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-008',
            destination: ['unsubscriber@example.com'],
        },
        subscription: {
            contactList: 'marketing-list',
            timestamp: new Date().toISOString(),
            source: 'ListUnsubscribe',
            newTopicPreferences: {
                unsubscribeAll: true,
            },
            oldTopicPreferences: {
                unsubscribeAll: false,
            },
        },
    },
    'Open': {
        eventType: 'Open',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-009',
            destination: ['reader@example.com'],
        },
        open: {
            timestamp: new Date().toISOString(),
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ipAddress: '203.0.113.1',
        },
    },
    'Click': {
        eventType: 'Click',
        mail: {
            timestamp: new Date().toISOString(),
            source: 'noreply@pivotr.in',
            messageId: 'test-message-id-010',
            destination: ['clicker@example.com'],
        },
        click: {
            timestamp: new Date().toISOString(),
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ipAddress: '203.0.113.2',
            link: 'https://pivotr.in/promo?utm_source=email',
        },
    },
};

// --- Test Functions ---

async function testQueueAccess(): Promise<boolean> {
    console.log('\n🔐 Testing SQS Queue Access...');

    if (!AWS_CONFIG.sqs.queueUrl) {
        fail('SQS Queue URL not configured');
        info('   Set AWS_SQS_QUEUE_URL in your .env file');
        return false;
    }

    try {
        const command = new GetQueueAttributesCommand({
            QueueUrl: AWS_CONFIG.sqs.queueUrl,
            AttributeNames: ['All'],
        });

        const response = await sqsClient.send(command);
        const attrs = response.Attributes || {};

        success('SQS queue access confirmed');
        info(`   Queue ARN:            ${attrs.QueueArn || 'N/A'}`);
        info(`   Messages Available:   ${attrs.ApproximateNumberOfMessages || 0}`);
        info(`   Messages In Flight:   ${attrs.ApproximateNumberOfMessagesNotVisible || 0}`);
        info(`   Created:              ${attrs.CreatedTimestamp ? new Date(parseInt(attrs.CreatedTimestamp) * 1000).toISOString() : 'N/A'}`);

        return true;
    } catch (error) {
        fail(`Queue access failed: ${(error as Error).message}`);
        return false;
    }
}

async function testSendMockEvents(): Promise<boolean> {
    console.log('\n📤 Sending Mock SES Events to SQS...');

    if (!AWS_CONFIG.sqs.queueUrl) {
        fail('SQS Queue URL not configured');
        return false;
    }

    const eventTypes = Object.keys(MOCK_SES_EVENTS) as SESEventType[];
    let sentCount = 0;

    for (const eventType of eventTypes) {
        try {
            // Wrap in SNS notification format (how SES events arrive via SNS → SQS)
            const snsMessage = {
                Type: 'Notification',
                MessageId: `sns-${Date.now()}-${eventType.replace(/\s/g, '')}`,
                TopicArn: 'arn:aws:sns:ap-south-1:123456789012:ses-notifications',
                Message: JSON.stringify(MOCK_SES_EVENTS[eventType]),
                Timestamp: new Date().toISOString(),
            };

            const command = new SendMessageCommand({
                QueueUrl: AWS_CONFIG.sqs.queueUrl,
                MessageBody: JSON.stringify(snsMessage),
                MessageAttributes: {
                    'EventType': {
                        DataType: 'String',
                        StringValue: eventType,
                    },
                },
            });

            await sqsClient.send(command);
            console.log(`   ✓ Sent: ${eventType}`);
            sentCount++;
        } catch (error) {
            console.log(`   ✗ Failed: ${eventType} - ${(error as Error).message}`);
        }
    }

    success(`Sent ${sentCount}/${eventTypes.length} mock events`);
    return sentCount === eventTypes.length;
}

async function testReceiveMessages(): Promise<boolean> {
    console.log('\n📥 Receiving Messages from SQS...');

    if (!AWS_CONFIG.sqs.queueUrl) {
        fail('SQS Queue URL not configured');
        return false;
    }

    try {
        const command = new ReceiveMessageCommand({
            QueueUrl: AWS_CONFIG.sqs.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 5,
            MessageAttributeNames: ['All'],
        });

        const response = await sqsClient.send(command);
        const messages = response.Messages || [];

        if (messages.length === 0) {
            info('No messages in queue');
            return true;
        }

        success(`Received ${messages.length} messages:`);

        for (const message of messages) {
            try {
                const body = JSON.parse(message.Body || '{}');

                // Parse SNS wrapper if present
                let sesEvent = body;
                if (body.Type === 'Notification' && body.Message) {
                    sesEvent = JSON.parse(body.Message);
                }

                const eventType = sesEvent.eventType || 'Unknown';
                const messageId = sesEvent.mail?.messageId || 'N/A';

                console.log(`\n   📧 Event: ${eventType}`);
                console.log(`      Message ID: ${messageId}`);
                console.log(`      SQS Receipt: ${message.ReceiptHandle?.slice(0, 50)}...`);

                // Log specific event details
                switch (eventType) {
                    case 'Bounce':
                        console.log(`      Bounce Type: ${sesEvent.bounce?.bounceType || 'N/A'}`);
                        console.log(`      Recipients: ${sesEvent.bounce?.bouncedRecipients?.map((r: { emailAddress: string }) => r.emailAddress).join(', ')}`);
                        break;
                    case 'Complaint':
                        console.log(`      Complaint Type: ${sesEvent.complaint?.complaintFeedbackType || 'N/A'}`);
                        break;
                    case 'Delivery':
                        console.log(`      SMTP Response: ${sesEvent.delivery?.smtpResponse || 'N/A'}`);
                        break;
                    case 'Open':
                        console.log(`      IP: ${sesEvent.open?.ipAddress || 'N/A'}`);
                        break;
                    case 'Click':
                        console.log(`      Link: ${sesEvent.click?.link || 'N/A'}`);
                        break;
                }
            } catch {
                console.log(`   ⚠️ Could not parse message: ${message.Body?.slice(0, 100)}...`);
            }
        }

        return true;
    } catch (error) {
        fail(`Receive messages failed: ${(error as Error).message}`);
        return false;
    }
}

async function testEventHandler(): Promise<void> {
    console.log('\n🎯 Simulating Event Handler Processing...');

    // This demonstrates how your application should handle each event type
    for (const [eventType, payload] of Object.entries(MOCK_SES_EVENTS)) {
        console.log(`\n   Processing: ${eventType}`);

        switch (eventType) {
            case 'Send':
                console.log(`      → Log: Email accepted for delivery`);
                break;
            case 'Rendering Failure':
                console.log(`      → Action: Alert developer, log template error`);
                break;
            case 'Reject':
                console.log(`      → Action: Log rejection, flag sender if repeated`);
                break;
            case 'Delivery':
                console.log(`      → Update: Mark email as delivered in database`);
                break;
            case 'Bounce':
                console.log(`      → Action: Remove email from list, mark as invalid`);
                console.log(`      → Database: UPDATE leads SET email_status='invalid' WHERE email=?`);
                break;
            case 'Complaint':
                console.log(`      → Action: Unsubscribe user, add to suppression list`);
                console.log(`      → Database: UPDATE leads SET unsubscribed=true WHERE email=?`);
                break;
            case 'DeliveryDelay':
                console.log(`      → Log: Monitor for persistent delays`);
                break;
            case 'Subscription':
                console.log(`      → Action: Update subscription preferences`);
                break;
            case 'Open':
                console.log(`      → Analytics: Track email open rate`);
                break;
            case 'Click':
                console.log(`      → Analytics: Track click-through rate`);
                break;
        }
    }

    success('Event handler simulation complete');
}

// --- Main Execution ---
async function main(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           AWS SQS Test Suite - Pivotr Mailer               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    logConfig();

    const results: Record<string, boolean> = {};

    // Check if queue is configured
    if (!AWS_CONFIG.sqs.queueUrl) {
        console.log('\n⚠️  SQS Queue URL not configured.');
        console.log('   Set AWS_SQS_QUEUE_URL in your .env file to enable SQS tests.');
        console.log('\n   Running event handler simulation only...');
        await testEventHandler();
        return;
    }

    // Run tests
    results['Queue Access'] = await testQueueAccess();
    results['Send Mock Events'] = await testSendMockEvents();
    results['Receive Messages'] = await testReceiveMessages();
    await testEventHandler();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                       TEST SUMMARY                         ║');
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
    console.log(`   Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('─'.repeat(50));

    if (failed > 0) {
        console.log('\n⚠️  Some tests failed. Check the errors above.');
        process.exit(1);
    } else {
        console.log('\n🎉 All SQS tests passed!');
    }
}

main().catch(console.error);
