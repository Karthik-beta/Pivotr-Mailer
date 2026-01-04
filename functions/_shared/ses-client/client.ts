/**
 * AWS SES Client
 *
 * Sends emails using AWS Simple Email Service (SES) v2.
 * Handles throttling, retries, and proper error classification.
 */

import type { SendEmailCommandOutput } from '@aws-sdk/client-sesv2';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

/**
 * SES client configuration
 */
export interface SesConfig {
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	timeoutMs: number;
	maxRetries: number;
	retryBackoffMs: number;
}

/**
 * Email to send
 */
export interface EmailMessage {
	to: string;
	from: string;
	fromName: string;
	subject: string;
	bodyText: string;
	bodyHtml?: string;
	campaignId: string;
	leadId: string;
}

/**
 * Send result
 */
export interface SendResult {
	success: boolean;
	messageId?: string;
	errorCode?: string;
	errorMessage?: string;
	isRetryable: boolean;
	rawResponse?: SendEmailCommandOutput;
}

/**
 * SES client instance cache
 */
let sesClient: SESv2Client | null = null;

/**
 * Initialize or get the SES client.
 */
function getClient(config: SesConfig): SESv2Client {
	if (!sesClient) {
		sesClient = new SESv2Client({
			region: config.region,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
			requestHandler: {
				requestTimeout: config.timeoutMs,
			},
		});
	}
	return sesClient;
}

/**
 * Send an email via AWS SES.
 */
export async function sendEmail(message: EmailMessage, config: SesConfig): Promise<SendResult> {
	const client = getClient(config);

	let lastError: Error | null = null;

	for (let attempt = 0; attempt < config.maxRetries; attempt++) {
		try {
			const command = new SendEmailCommand({
				FromEmailAddress: `${message.fromName} <${message.from}>`,
				Destination: {
					ToAddresses: [message.to],
				},
				Content: {
					Simple: {
						Subject: {
							Data: message.subject,
							Charset: 'UTF-8',
						},
						Body: {
							Text: {
								Data: message.bodyText,
								Charset: 'UTF-8',
							},
							...(message.bodyHtml && {
								Html: {
									Data: message.bodyHtml,
									Charset: 'UTF-8',
								},
							}),
						},
					},
				},
				EmailTags: [
					{ Name: 'campaign_id', Value: message.campaignId },
					{ Name: 'lead_id', Value: message.leadId },
				],
			});

			const response = await client.send(command);

			return {
				success: true,
				messageId: response.MessageId,
				isRetryable: false,
				rawResponse: response,
			};
		} catch (error) {
			lastError = error as Error;
			const errorInfo = classifyError(error as Error);

			if (!errorInfo.isRetryable) {
				return {
					success: false,
					errorCode: errorInfo.code,
					errorMessage: errorInfo.message,
					isRetryable: false,
				};
			}

			// Exponential backoff for retryable errors
			if (attempt < config.maxRetries - 1) {
				const backoffMs = config.retryBackoffMs * 2 ** attempt;
				await sleep(backoffMs);
			}
		}
	}

	return {
		success: false,
		errorCode: 'MAX_RETRIES_EXCEEDED',
		errorMessage: lastError?.message || 'Failed after max retries',
		isRetryable: false,
	};
}

/**
 * Classify SES errors for retry logic.
 */
function classifyError(error: Error): { code: string; message: string; isRetryable: boolean } {
	const errorName = error.name || '';
	const errorMessage = error.message || '';

	// Throttling errors - retryable
	if (
		errorName === 'ThrottlingException' ||
		errorName === 'TooManyRequestsException' ||
		errorMessage.includes('Rate exceeded') ||
		errorMessage.includes('Throttling')
	) {
		return {
			code: 'THROTTLING',
			message: 'Rate limit exceeded',
			isRetryable: true,
		};
	}

	// Service unavailable - retryable
	if (errorName === 'ServiceUnavailable' || errorMessage.includes('Service Unavailable')) {
		return {
			code: 'SERVICE_UNAVAILABLE',
			message: 'SES service temporarily unavailable',
			isRetryable: true,
		};
	}

	// Account issues - not retryable
	if (errorName === 'AccountSuspendedException' || errorMessage.includes('Account suspended')) {
		return {
			code: 'ACCOUNT_SUSPENDED',
			message: 'AWS SES account is suspended',
			isRetryable: false,
		};
	}

	// Message rejected - not retryable
	if (errorName === 'MessageRejected' || errorMessage.includes('rejected')) {
		return {
			code: 'MESSAGE_REJECTED',
			message: errorMessage,
			isRetryable: false,
		};
	}

	// Invalid configuration - not retryable
	if (
		errorName === 'ConfigurationSetDoesNotExistException' ||
		errorName === 'MailFromDomainNotVerifiedException'
	) {
		return {
			code: 'CONFIGURATION_ERROR',
			message: errorMessage,
			isRetryable: false,
		};
	}

	// Network timeout - retryable
	if (errorName === 'TimeoutError' || errorMessage.includes('timeout')) {
		return {
			code: 'TIMEOUT',
			message: 'Request timed out',
			isRetryable: true,
		};
	}

	// Default: not retryable (be conservative)
	return {
		code: 'UNKNOWN_ERROR',
		message: errorMessage,
		isRetryable: false,
	};
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reset the SES client (for testing or config changes)
 */
export function resetSesClient(): void {
	if (sesClient) {
		sesClient.destroy();
		sesClient = null;
	}
}
