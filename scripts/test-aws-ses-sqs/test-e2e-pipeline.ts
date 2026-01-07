/**
 * AWS SES → SNS → SQS End-to-End Pipeline Verification Test
 * 
 * This test verifies the FULL event pipeline:
 * 1. Send a real email via SES
 * 2. Wait for the event to flow through SNS to SQS
 * 3. Verify the event is received with matching message ID
 * 
 * Run: bun run test-e2e-pipeline.ts
 */

import {
    SESv2Client,
    SendEmailCommand,
} from '@aws-sdk/client-sesv2';
import {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { AWS_CONFIG, TEST_CONFIG, logConfig } from './config';

// --- Client Setup ---
const sesClient = new SESv2Client({
    region: AWS_CONFIG.ses.region,
    credentials: {
        accessKeyId: AWS_CONFIG.ses.accessKeyId,
        secretAccessKey: AWS_CONFIG.ses.secretAccessKey,
    },
});

const sqsClient = new SQSClient({
    region: AWS_CONFIG.sqs.region,
    credentials: {
        accessKeyId: AWS_CONFIG.ses.accessKeyId,
        secretAccessKey: AWS_CONFIG.ses.secretAccessKey,
    },
});

// --- Configuration ---
const E2E_CONFIG = {
    // Maximum time to wait for events (seconds)
    maxWaitTime: 60,
    // Polling interval (seconds)
    pollInterval: 3,
    // Number of messages to fetch per poll
    messagesPerPoll: 10,
};

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

function waiting(msg: string): void {
    console.log(`⏳ ${msg}`);
}

// --- Types ---
interface SESEvent {
    eventType: string;
    mail: {
        messageId: string;
        timestamp: string;
        source: string;
        destination: string[];
    };
    send?: Record<string, unknown>;
    delivery?: {
        timestamp: string;
        processingTimeMillis: number;
        recipients: string[];
        smtpResponse: string;
    };
    bounce?: {
        bounceType: string;
        bouncedRecipients: Array<{ emailAddress: string }>;
    };
    complaint?: {
        complainedRecipients: Array<{ emailAddress: string }>;
    };
}

interface PipelineResult {
    messageId: string;
    eventsReceived: string[];
    timeElapsed: number;
    success: boolean;
}

// --- E2E Test Functions ---

async function sendTestEmail(): Promise<string> {
    const uniqueId = Date.now().toString();

    const command = new SendEmailCommand({
        FromEmailAddress: TEST_CONFIG.fromEmail,
        Destination: {
            ToAddresses: [TEST_CONFIG.toEmail],
        },
        Content: {
            Simple: {
                Subject: {
                    Data: `[E2E Pipeline Test] ${uniqueId}`,
                    Charset: 'UTF-8',
                },
                Body: {
                    Html: {
                        Data: `
                            <html>
                            <body style="font-family: Arial, sans-serif; padding: 20px;">
                                <h1 style="color: #4F46E5;">🔄 E2E Pipeline Test</h1>
                                <p>This email is sent to verify the SES → SNS → SQS pipeline.</p>
                                <p><strong>Test ID:</strong> ${uniqueId}</p>
                                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                                <hr>
                                <p><small>This is an automated test. Please ignore.</small></p>
                            </body>
                            </html>
                        `,
                        Charset: 'UTF-8',
                    },
                },
            },
        },
        // Add configuration set if configured
        ...(AWS_CONFIG.ses.configurationSet && {
            ConfigurationSetName: AWS_CONFIG.ses.configurationSet,
        }),
    });

    const response = await sesClient.send(command);
    return response.MessageId || '';
}

async function pollForEvents(targetMessageId: string): Promise<PipelineResult> {
    const startTime = Date.now();
    const eventsReceived: string[] = [];
    let foundEvent = false;

    while ((Date.now() - startTime) / 1000 < E2E_CONFIG.maxWaitTime) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        waiting(`Polling SQS... (${elapsed}s elapsed)`);

        try {
            const command = new ReceiveMessageCommand({
                QueueUrl: AWS_CONFIG.sqs.queueUrl,
                MaxNumberOfMessages: E2E_CONFIG.messagesPerPoll,
                WaitTimeSeconds: E2E_CONFIG.pollInterval,
                MessageAttributeNames: ['All'],
            });

            const response = await sqsClient.send(command);
            const messages = response.Messages || [];

            for (const message of messages) {
                try {
                    let body = JSON.parse(message.Body || '{}');

                    // Parse SNS wrapper if present
                    if (body.Type === 'Notification' && body.Message) {
                        body = JSON.parse(body.Message);
                    }

                    const sesEvent = body as SESEvent;
                    const eventMessageId = sesEvent.mail?.messageId;

                    // Check if this is our target message
                    if (eventMessageId === targetMessageId) {
                        foundEvent = true;
                        eventsReceived.push(sesEvent.eventType);

                        console.log(`\n   📧 Received: ${sesEvent.eventType}`);
                        console.log(`      Message ID: ${eventMessageId}`);
                        console.log(`      From: ${sesEvent.mail?.source}`);
                        console.log(`      To: ${sesEvent.mail?.destination?.join(', ')}`);

                        if (sesEvent.delivery) {
                            console.log(`      SMTP: ${sesEvent.delivery.smtpResponse}`);
                            console.log(`      Processing Time: ${sesEvent.delivery.processingTimeMillis}ms`);
                        }

                        // Delete the message after processing
                        if (message.ReceiptHandle) {
                            await sqsClient.send(new DeleteMessageCommand({
                                QueueUrl: AWS_CONFIG.sqs.queueUrl,
                                ReceiptHandle: message.ReceiptHandle,
                            }));
                            info(`   Message deleted from queue`);
                        }
                    }
                } catch {
                    // Skip unparseable messages
                }
            }

            // If we found Send and Delivery, we're done
            if (eventsReceived.includes('Send') && eventsReceived.includes('Delivery')) {
                break;
            }

            // If we only have Send and more time has passed, consider it success
            // (Delivery can take longer or might not come in sandbox mode)
            if (foundEvent && (Date.now() - startTime) / 1000 > 30) {
                break;
            }

        } catch (error) {
            console.error(`   Error polling: ${(error as Error).message}`);
        }
    }

    return {
        messageId: targetMessageId,
        eventsReceived,
        timeElapsed: (Date.now() - startTime) / 1000,
        success: foundEvent,
    };
}

async function runE2EPipelineTest(): Promise<boolean> {
    console.log('\n🔄 Running E2E Pipeline Verification Test');
    console.log('─'.repeat(50));
    console.log('   This test verifies: SES → SNS → SQS');
    console.log('─'.repeat(50));

    // Check prerequisites
    if (!AWS_CONFIG.sqs.queueUrl) {
        fail('SQS Queue URL not configured');
        info('   Set AWS_SQS_QUEUE_URL in your .env file');
        return false;
    }

    if (!AWS_CONFIG.ses.configurationSet) {
        console.log('\n⚠️  WARNING: No configuration set specified');
        console.log('   Events may not flow to SNS/SQS without a configuration set');
        console.log('   Set AWS_SES_CONFIGURATION_SET in your .env file\n');
    }

    // Step 1: Send email
    console.log('\n📤 Step 1: Sending test email via SES...');
    let messageId: string;

    try {
        messageId = await sendTestEmail();
        success(`Email sent!`);
        info(`   Message ID: ${messageId}`);
        info(`   From: ${TEST_CONFIG.fromEmail}`);
        info(`   To: ${TEST_CONFIG.toEmail}`);
    } catch (error) {
        fail(`Failed to send email: ${(error as Error).message}`);
        return false;
    }

    // Step 2: Poll SQS for the event
    console.log('\n📥 Step 2: Waiting for event in SQS...');
    console.log(`   (Max wait: ${E2E_CONFIG.maxWaitTime}s, polling every ${E2E_CONFIG.pollInterval}s)`);

    const result = await pollForEvents(messageId);

    // Step 3: Report results
    console.log('\n📊 Step 3: Pipeline Test Results');
    console.log('─'.repeat(50));

    if (result.success) {
        success(`Pipeline verified!`);
        info(`   Events received: ${result.eventsReceived.join(', ')}`);
        info(`   Time elapsed: ${result.timeElapsed.toFixed(1)}s`);

        if (result.eventsReceived.includes('Delivery')) {
            success('Full delivery confirmed: SES → SNS → SQS → Delivered');
        } else if (result.eventsReceived.includes('Send')) {
            success('Send event confirmed: SES → SNS → SQS');
            info('   (Delivery event may come later or be unavailable in sandbox)');
        }

        return true;
    } else {
        fail(`No events received for message ID: ${messageId}`);
        console.log('\n   Possible issues:');
        console.log('   1. Configuration Set not linked to SNS topic');
        console.log('   2. SNS topic not subscribed to SQS queue');
        console.log('   3. Event types not enabled in Configuration Set');
        console.log('   4. IAM permissions blocking the flow');
        return false;
    }
}

// --- Main Execution ---
async function main(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     AWS SES → SNS → SQS E2E Pipeline Test - Pivotr Mailer  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    logConfig();

    const startTime = Date.now();
    const success = await runE2EPipelineTest();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  E2E PIPELINE TEST SUMMARY                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`   Status:   ${success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Duration: ${duration}s`);
    console.log('─'.repeat(50));

    if (success) {
        console.log('\n🎉 E2E Pipeline verification complete!');
        console.log('   Your SES → SNS → SQS setup is working correctly.');
    } else {
        console.log('\n⚠️  E2E Pipeline verification failed.');
        console.log('   Check your AWS configuration and try again.');
        process.exit(1);
    }
}

main().catch(console.error);
