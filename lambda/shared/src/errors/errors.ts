/**
 * Error Types
 * 
 * Custom error classes for different failure scenarios.
 * Helps distinguish retryable vs non-retryable errors.
 */

/**
 * Base error for Pivotr Mailer Lambda functions.
 */
export class PivotrMailerError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly retryable: boolean = false
    ) {
        super(message);
        this.name = 'PivotrMailerError';
    }
}

/**
 * Validation error - bad input, should NOT retry.
 */
export class ValidationError extends PivotrMailerError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR', false);
        this.name = 'ValidationError';
    }
}

/**
 * Not found error - resource doesn't exist, should NOT retry.
 */
export class NotFoundError extends PivotrMailerError {
    constructor(resource: string, id: string) {
        super(`${resource} not found: ${id}`, 'NOT_FOUND', false);
        this.name = 'NotFoundError';
    }
}

/**
 * External service error - external API failed, MAY retry.
 */
export class ExternalServiceError extends PivotrMailerError {
    constructor(service: string, message: string, retryable: boolean = true) {
        super(`${service} error: ${message}`, 'EXTERNAL_SERVICE_ERROR', retryable);
        this.name = 'ExternalServiceError';
    }
}

/**
 * Rate limit error - hit a rate limit, SHOULD retry with backoff.
 */
export class RateLimitError extends PivotrMailerError {
    constructor(service: string) {
        super(`Rate limit exceeded for ${service}`, 'RATE_LIMIT', true);
        this.name = 'RateLimitError';
    }
}

/**
 * Daily cap error - hit daily sending limit, should NOT retry today.
 */
export class DailyCapError extends PivotrMailerError {
    constructor(cap: number) {
        super(`Daily sending cap (${cap}) reached`, 'DAILY_CAP_REACHED', false);
        this.name = 'DailyCapError';
    }
}

/**
 * Reputation risk error - SES reputation at risk, should PAUSE campaign.
 */
export class ReputationRiskError extends PivotrMailerError {
    constructor(metric: string, value: number, threshold: number) {
        super(
            `SES reputation risk: ${metric} (${value}) exceeded threshold (${threshold})`,
            'REPUTATION_RISK',
            false
        );
        this.name = 'ReputationRiskError';
    }
}
