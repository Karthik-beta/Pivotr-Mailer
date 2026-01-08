/**
 * Logger Utility
 * 
 * Wraps @aws-lambda-powertools/logger for structured JSON logging.
 * All Lambda functions MUST use this instead of console.log.
 * 
 * Reference: https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/
 */

import { Logger } from '@aws-lambda-powertools/logger';
import type { LogLevel } from '@aws-lambda-powertools/logger/types';

/**
 * Create a configured logger instance for a Lambda function.
 * 
 * @param serviceName - Name of the Lambda function (e.g., 'send-email')
 */
export function createLogger(serviceName: string): Logger {
    return new Logger({
        serviceName,
        logLevel: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
        persistentLogAttributes: {
            environment: process.env.ENVIRONMENT || 'dev',
        },
    });
}

/**
 * Log a structured error with stack trace.
 */
export function logError(logger: Logger, message: string, error: unknown): void {
    const errorDetails = error instanceof Error
        ? {
            errorMessage: error.message,
            errorName: error.name,
            stackTrace: error.stack
        }
        : { errorMessage: String(error) };

    logger.error(message, errorDetails);
}

/**
 * Log a business event for audit purposes.
 */
export function logBusinessEvent(
    logger: Logger,
    eventType: string,
    details: Record<string, unknown>
): void {
    logger.info('Business event', {
        eventType,
        ...details,
    });
}
