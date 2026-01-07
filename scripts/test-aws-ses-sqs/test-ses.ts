/**
 * AWS SES Test Script
 * Tests sending emails and verifies SES configuration
 * 
 * Run: bun run test-ses.ts
 */

import {
    SESv2Client,
    SendEmailCommand,
    GetAccountCommand,
    ListEmailIdentitiesCommand,
} from '@aws-sdk/client-sesv2';
import { AWS_CONFIG, TEST_CONFIG, logConfig } from './config';

// --- SES Client Setup ---
const sesClient = new SESv2Client({
    region: AWS_CONFIG.ses.region,
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

// --- Test Functions ---

async function testAccountAccess(): Promise<boolean> {
    console.log('\n🔐 Testing SES Account Access...');

    try {
        const command = new GetAccountCommand({});
        const response = await sesClient.send(command);

        success('SES account access confirmed');

        if (response.SendQuota) {
            info(`   Daily Quota: ${response.SendQuota.Max24HourSend}`);
            info(`   Sent Today:  ${response.SendQuota.SentLast24Hours}`);
            info(`   Max Rate:    ${response.SendQuota.MaxSendRate}/sec`);
        }

        if (response.EnforcementStatus) {
            info(`   Enforcement: ${response.EnforcementStatus}`);
        }

        // Check if in sandbox mode
        if (response.ProductionAccessEnabled === false) {
            console.log('\n⚠️  WARNING: SES is in SANDBOX mode!');
            console.log('   - You can only send to verified email addresses');
            console.log('   - Request production access for full sending capabilities');
        } else {
            success('Production access enabled');
        }

        return true;
    } catch (error) {
        fail(`Account access failed: ${(error as Error).message}`);
        return false;
    }
}

async function testListIdentities(): Promise<string[]> {
    console.log('\n📧 Listing Verified Identities...');

    try {
        const command = new ListEmailIdentitiesCommand({});
        const response = await sesClient.send(command);

        const identities = response.EmailIdentities || [];

        if (identities.length === 0) {
            fail('No verified identities found');
            info('   You need to verify at least one email address or domain');
            return [];
        }

        success(`Found ${identities.length} identities:`);
        for (const identity of identities) {
            const status = identity.SendingEnabled ? '🟢' : '🔴';
            console.log(`   ${status} ${identity.IdentityName} (${identity.IdentityType})`);
        }

        return identities.map(i => i.IdentityName || '');
    } catch (error) {
        fail(`List identities failed: ${(error as Error).message}`);
        return [];
    }
}

async function testSendSimpleEmail(): Promise<boolean> {
    console.log('\n📤 Testing Simple Email Send...');

    try {
        const command = new SendEmailCommand({
            FromEmailAddress: TEST_CONFIG.fromEmail,
            Destination: {
                ToAddresses: [TEST_CONFIG.toEmail],
            },
            Content: {
                Simple: {
                    Subject: {
                        Data: `[Pivotr Mailer Test] Simple Email - ${new Date().toISOString()}`,
                        Charset: 'UTF-8',
                    },
                    Body: {
                        Text: {
                            Data: `This is a simple text email sent from the Pivotr Mailer SES test script.\n\nTimestamp: ${new Date().toISOString()}\nRegion: ${AWS_CONFIG.ses.region}`,
                            Charset: 'UTF-8',
                        },
                        Html: {
                            Data: `
                                <html>
                                <body style="font-family: Arial, sans-serif; padding: 20px;">
                                    <h1 style="color: #4F46E5;">✅ Pivotr Mailer - SES Test</h1>
                                    <p>This is a <strong>simple email</strong> sent from the test script.</p>
                                    <hr>
                                    <p><small>Timestamp: ${new Date().toISOString()}</small></p>
                                    <p><small>Region: ${AWS_CONFIG.ses.region}</small></p>
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

        success(`Email sent successfully!`);
        info(`   Message ID: ${response.MessageId}`);

        return true;
    } catch (error) {
        fail(`Send email failed: ${(error as Error).message}`);
        return false;
    }
}

async function testSendEmailWithTracking(): Promise<boolean> {
    console.log('\n📤 Testing Email with Open/Click Tracking...');

    try {
        const trackingLink = 'https://pivotr.in/?utm_source=ses_test&utm_medium=email';

        const command = new SendEmailCommand({
            FromEmailAddress: TEST_CONFIG.fromEmail,
            Destination: {
                ToAddresses: [TEST_CONFIG.toEmail],
            },
            Content: {
                Simple: {
                    Subject: {
                        Data: `[Pivotr Mailer Test] Email with Tracking - ${new Date().toISOString()}`,
                        Charset: 'UTF-8',
                    },
                    Body: {
                        Html: {
                            Data: `
                                <html>
                                <body style="font-family: Arial, sans-serif; padding: 20px;">
                                    <h1 style="color: #4F46E5;">📊 Tracking Test Email</h1>
                                    <p>This email tests open and click tracking.</p>
                                    <p>
                                        <a href="${trackingLink}" style="
                                            display: inline-block;
                                            padding: 12px 24px;
                                            background-color: #4F46E5;
                                            color: white;
                                            text-decoration: none;
                                            border-radius: 6px;
                                        ">Click Here to Test Click Tracking</a>
                                    </p>
                                    <hr>
                                    <p><small>If SES tracking is configured, opens and clicks will be recorded.</small></p>
                                    <p><small>Timestamp: ${new Date().toISOString()}</small></p>
                                </body>
                                </html>
                            `,
                            Charset: 'UTF-8',
                        },
                    },
                },
            },
            // Configuration set for tracking
            ...(AWS_CONFIG.ses.configurationSet && {
                ConfigurationSetName: AWS_CONFIG.ses.configurationSet,
            }),
        });

        const response = await sesClient.send(command);

        success(`Tracking email sent successfully!`);
        info(`   Message ID: ${response.MessageId}`);
        info(`   Note: Actual tracking requires a Configuration Set`);

        return true;
    } catch (error) {
        fail(`Send tracking email failed: ${(error as Error).message}`);
        return false;
    }
}

async function testSendBulkEmails(): Promise<boolean> {
    console.log('\n📤 Testing Bulk Email (to single recipient for testing)...');

    try {
        // In production, you'd use SendBulkEmailCommand for multiple recipients
        // For testing, we simulate with a single templated email
        const command = new SendEmailCommand({
            FromEmailAddress: TEST_CONFIG.fromEmail,
            Destination: {
                ToAddresses: [TEST_CONFIG.toEmail],
            },
            Content: {
                Simple: {
                    Subject: {
                        Data: `[Pivotr Mailer Test] Bulk Email Simulation - ${new Date().toISOString()}`,
                        Charset: 'UTF-8',
                    },
                    Body: {
                        Html: {
                            Data: `
                                <html>
                                <body style="font-family: Arial, sans-serif; padding: 20px;">
                                    <h1 style="color: #4F46E5;">📬 Bulk Email Test</h1>
                                    <p>This simulates a bulk email send.</p>
                                    <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
                                        <tr style="background: #f3f4f6;">
                                            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Field</th>
                                            <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Value</th>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px; border: 1px solid #e5e7eb;">Recipient</td>
                                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${TEST_CONFIG.toEmail}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px; border: 1px solid #e5e7eb;">Timestamp</td>
                                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date().toISOString()}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px; border: 1px solid #e5e7eb;">Region</td>
                                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${AWS_CONFIG.ses.region}</td>
                                        </tr>
                                    </table>
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

        success(`Bulk email test sent successfully!`);
        info(`   Message ID: ${response.MessageId}`);

        return true;
    } catch (error) {
        fail(`Bulk email test failed: ${(error as Error).message}`);
        return false;
    }
}

// --- Main Execution ---
async function main(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           AWS SES Test Suite - Pivotr Mailer               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    logConfig();

    const results: Record<string, boolean> = {};

    // Run tests
    results['Account Access'] = await testAccountAccess();
    await testListIdentities();
    results['Send Simple Email'] = await testSendSimpleEmail();
    results['Send Email with Tracking'] = await testSendEmailWithTracking();
    results['Send Bulk Email'] = await testSendBulkEmails();

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
        console.log('\n🎉 All SES tests passed!');
    }
}

main().catch(console.error);
