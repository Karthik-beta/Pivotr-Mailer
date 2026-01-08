/**
 * Safety Configuration for Lambda Functions
 * 
 * CRITICAL: These constants MUST be used when creating Lambda functions
 * in the CDK stack to prevent cost overruns and ensure reliability.
 * 
 * Reference: PRD Section 5.3 - AWS Safety Nets & Cost Controls
 */

/**
 * Lambda concurrency limits per function type.
 * These are HARD LIMITS that prevent runaway scaling.
 */
export const LAMBDA_CONCURRENCY = {
    /** Email sending - limited to prevent SES throttling */
    SEND_EMAIL: 5,
    /** Email verification - limited by MyEmailVerifier API rate */
    VERIFY_EMAIL: 3,
    /** SQS feedback processing - can handle bursts */
    PROCESS_FEEDBACK: 10,
    /** Bulk lead import - infrequent, resource-intensive */
    LEAD_IMPORT: 2,
    /** API Gateway handlers - shared pool */
    API_HANDLERS: 10,
} as const;

/**
 * Lambda timeout limits in seconds.
 * NEVER use default 15-minute timeout.
 */
export const LAMBDA_TIMEOUT_SECONDS = {
    SEND_EMAIL: 30,
    VERIFY_EMAIL: 15,
    PROCESS_FEEDBACK: 10,
    LEAD_IMPORT: 60,
    API_HANDLERS: 10,
} as const;

/**
 * Lambda memory allocation in MB.
 * Right-sized for cost optimization.
 */
export const LAMBDA_MEMORY_MB = {
    SEND_EMAIL: 256,
    VERIFY_EMAIL: 256,
    PROCESS_FEEDBACK: 128,
    LEAD_IMPORT: 512,
    API_HANDLERS: 256,
} as const;

/**
 * SQS retry limits before sending to DLQ.
 * Prevents infinite retry loops.
 */
export const SQS_MAX_RECEIVE_COUNT = {
    /** Email sending queue - 3 retries max */
    SENDING_QUEUE: 3,
    /** Feedback queue - 5 retries for resilience */
    FEEDBACK_QUEUE: 5,
    /** Verification queue - 2 retries (external API) */
    VERIFICATION_QUEUE: 2,
} as const;

/**
 * Daily sending cap - APPLICATION LEVEL safety net.
 * This is checked in Lambda code, not just AWS limits.
 */
export const DAILY_SENDING_CAP = 300;

/**
 * SES reputation thresholds for auto-pause.
 * If exceeded, campaigns should be automatically paused.
 */
export const SES_REPUTATION_THRESHOLDS = {
    /** Max bounce rate before auto-pause (5%) */
    MAX_BOUNCE_RATE: 0.05,
    /** Max complaint rate before auto-pause (0.1%) */
    MAX_COMPLAINT_RATE: 0.001,
} as const;
