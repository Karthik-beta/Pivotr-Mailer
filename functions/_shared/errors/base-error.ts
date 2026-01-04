/**
 * Custom Error Classes
 * 
 * Structured errors for consistent error handling across functions.
 */

/**
 * Base error class for Pivotr Mailer
 */
export class PivotrError extends Error {
    public readonly code: string;
    public readonly isRetryable: boolean;
    public readonly details?: Record<string, unknown>;

    constructor(
        message: string,
        code: string,
        isRetryable: boolean = false,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'PivotrError';
        this.code = code;
        this.isRetryable = isRetryable;
        this.details = details;

        // Maintains proper stack trace in V8
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PivotrError);
        }
    }
}

/**
 * Validation error - invalid input data
 */
export class ValidationError extends PivotrError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', false, details);
        this.name = 'ValidationError';
    }
}

/**
 * Configuration error - missing or invalid settings
 */
export class ConfigurationError extends PivotrError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'CONFIGURATION_ERROR', false, details);
        this.name = 'ConfigurationError';
    }
}

/**
 * External service error - API failures
 */
export class ExternalServiceError extends PivotrError {
    public readonly serviceName: string;

    constructor(
        serviceName: string,
        message: string,
        isRetryable: boolean = true,
        details?: Record<string, unknown>
    ) {
        super(message, 'EXTERNAL_SERVICE_ERROR', isRetryable, details);
        this.name = 'ExternalServiceError';
        this.serviceName = serviceName;
    }
}

/**
 * Database error - Appwrite database issues
 */
export class DatabaseError extends PivotrError {
    constructor(
        message: string,
        isRetryable: boolean = true,
        details?: Record<string, unknown>
    ) {
        super(message, 'DATABASE_ERROR', isRetryable, details);
        this.name = 'DatabaseError';
    }
}

/**
 * Lock error - campaign locking issues
 */
export class LockError extends PivotrError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'LOCK_ERROR', false, details);
        this.name = 'LockError';
    }
}

/**
 * Timeout error - operation exceeded time limit
 */
export class TimeoutError extends PivotrError {
    constructor(
        message: string,
        operationName: string,
        timeoutMs: number
    ) {
        super(message, 'TIMEOUT_ERROR', true, { operationName, timeoutMs });
        this.name = 'TimeoutError';
    }
}
