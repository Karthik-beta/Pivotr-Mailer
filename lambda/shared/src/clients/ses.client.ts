/**
 * SES Email Client
 * 
 * Centralized SES client for email sending.
 * Includes safety checks for daily sending cap.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DAILY_SENDING_CAP } from '../config/safety.config.js';
import { getSesConfig } from '../config/environment.config.js';

let sesClient: SESClient | null = null;

/**
 * Get or create the SES Client.
 */
export function getSesClient(): SESClient {
    if (!sesClient) {
        const config = getSesConfig();
        const endpoint = process.env.AWS_ENDPOINT_URL;
        sesClient = new SESClient({
            region: config.region,
            ...(endpoint && { endpoint }),
        });
    }
    return sesClient;
}

/**
 * Email send options.
 */
export interface SendEmailOptions {
    to: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    replyTo?: string;
}

/**
 * Email send result.
 */
export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Send an email via SES with safety checks.
 * 
 * @param options - Email options
 * @param todaySentCount - Number of emails already sent today
 * @returns Send result
 */
export async function sendEmail(
    options: SendEmailOptions,
    todaySentCount: number
): Promise<SendEmailResult> {
    // SAFETY: Check daily sending cap
    if (todaySentCount >= DAILY_SENDING_CAP) {
        return {
            success: false,
            error: `Daily sending cap (${DAILY_SENDING_CAP}) reached. Email not sent.`,
        };
    }

    const config = getSesConfig();
    const client = getSesClient();

    try {
        const command = new SendEmailCommand({
            Source: config.fromEmail,
            Destination: {
                ToAddresses: [options.to],
            },
            Message: {
                Subject: {
                    Data: options.subject,
                    Charset: 'UTF-8',
                },
                Body: {
                    Html: {
                        Data: options.htmlBody,
                        Charset: 'UTF-8',
                    },
                    ...(options.textBody && {
                        Text: {
                            Data: options.textBody,
                            Charset: 'UTF-8',
                        },
                    }),
                },
            },
            ConfigurationSetName: config.configurationSet,
            ...(options.replyTo && {
                ReplyToAddresses: [options.replyTo],
            }),
        });

        const response = await client.send(command);

        return {
            success: true,
            messageId: response.MessageId,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Reset the client (useful for testing).
 */
export function resetSesClient(): void {
    sesClient = null;
}
