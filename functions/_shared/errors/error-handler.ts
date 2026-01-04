/**
 * Error Handler
 *
 * Centralized error handling and logging for Appwrite Functions.
 */

import { PivotrError } from './base-error';

/**
 * Error log entry structure
 */
export interface ErrorLogEntry {
	code: string;
	message: string;
	stack?: string;
	isRetryable: boolean;
	details?: Record<string, unknown>;
	timestamp: string;
}

/**
 * Convert any error to a structured ErrorLogEntry.
 */
export function errorToLogEntry(error: unknown): ErrorLogEntry {
	const timestamp = new Date().toISOString();

	if (error instanceof PivotrError) {
		return {
			code: error.code,
			message: error.message,
			stack: error.stack,
			isRetryable: error.isRetryable,
			details: error.details,
			timestamp,
		};
	}

	if (error instanceof Error) {
		return {
			code: 'UNKNOWN_ERROR',
			message: error.message,
			stack: error.stack,
			isRetryable: false,
			timestamp,
		};
	}

	return {
		code: 'UNKNOWN_ERROR',
		message: String(error),
		isRetryable: false,
		timestamp,
	};
}

/**
 * Wrap an async function with error handling.
 */
export function withErrorHandling<T>(fn: () => Promise<T>, context: string): Promise<T> {
	return fn().catch((error) => {
		const logEntry = errorToLogEntry(error);
		console.error(`[${context}] Error:`, JSON.stringify(logEntry, null, 2));
		throw error;
	});
}

/**
 * Retry a function with exponential backoff.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: {
		maxRetries: number;
		baseDelayMs: number;
		maxDelayMs?: number;
		onRetry?: (attempt: number, error: unknown) => void;
	}
): Promise<T> {
	const { maxRetries, baseDelayMs, maxDelayMs = 300000, onRetry } = options;

	let lastError: unknown;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			// Check if error is retryable
			if (error instanceof PivotrError && !error.isRetryable) {
				throw error;
			}

			// Don't retry on last attempt
			if (attempt === maxRetries - 1) {
				break;
			}

			// Notify of retry
			if (onRetry) {
				onRetry(attempt + 1, error);
			}

			// Calculate delay with exponential backoff + jitter
			const delay = Math.min(baseDelayMs * 2 ** attempt + Math.random() * 1000, maxDelayMs);

			await sleep(delay);
		}
	}

	throw lastError;
}

/**
 * Execute with timeout.
 */
export async function withTimeout<T>(
	fn: () => Promise<T>,
	timeoutMs: number,
	operationName: string
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new Error(`Operation '${operationName}' timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		fn()
			.then((result) => {
				clearTimeout(timeoutId);
				resolve(result);
			})
			.catch((error) => {
				clearTimeout(timeoutId);
				reject(error);
			});
	});
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
