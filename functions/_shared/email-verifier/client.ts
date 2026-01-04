/**
 * MyEmailVerifier API Client
 * 
 * Just-In-Time email verification to conserve credits.
 * Each email is verified immediately before sending.
 */

import type { VerificationResultType } from '../../../../shared/constants/status.constants';
import { VerificationResult } from '../../../../shared/constants/status.constants';

/**
 * MyEmailVerifier API response structure
 */
export interface VerifierApiResponse {
    status_code: string;
    status_message: string;
    email: string;
    disposable: boolean;
    role_based: boolean;
    free_email: boolean;
    catchall: boolean;
    mx_records: boolean;
    smtp_check: boolean;
    reason: string;
}

/**
 * Internal verification result
 */
export interface VerificationResponse {
    email: string;
    status: VerificationResultType;
    isValid: boolean;
    isRisky: boolean;
    rawResponse: VerifierApiResponse;
    errorMessage?: string;
}

/**
 * Verifier client configuration
 */
export interface VerifierConfig {
    apiKey: string;
    timeoutMs: number;
    maxRetries: number;
    retryBackoffMs: number;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

// Global circuit breaker state
let circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
};

/**
 * MyEmailVerifier API endpoint
 */
const API_ENDPOINT = 'https://api.myemailverifier.com/verify/single/json';

/**
 * Verify an email address using MyEmailVerifier API.
 */
export async function verifyEmail(
    email: string,
    config: VerifierConfig
): Promise<VerificationResponse> {
    // Check circuit breaker
    if (circuitBreaker.state === 'OPEN') {
        const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
        if (timeSinceLastFailure < CIRCUIT_BREAKER_RESET_MS) {
            return {
                email,
                status: VerificationResult.UNKNOWN,
                isValid: false,
                isRisky: true,
                rawResponse: {} as VerifierApiResponse,
                errorMessage: 'Circuit breaker open - verification service temporarily unavailable',
            };
        }
        // Transition to half-open
        circuitBreaker.state = 'HALF_OPEN';
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
        try {
            const response = await fetchWithTimeout(
                API_ENDPOINT,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, key: config.apiKey }),
                },
                config.timeoutMs
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data: VerifierApiResponse = await response.json();

            // Reset circuit breaker on success
            circuitBreaker = { failures: 0, lastFailureTime: 0, state: 'CLOSED' };

            return mapVerifierResponse(email, data);

        } catch (error) {
            lastError = error as Error;

            // Increment circuit breaker
            circuitBreaker.failures++;
            circuitBreaker.lastFailureTime = Date.now();

            if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
                circuitBreaker.state = 'OPEN';
            }

            // Exponential backoff
            if (attempt < config.maxRetries - 1) {
                const backoffMs = config.retryBackoffMs * Math.pow(2, attempt);
                await sleep(backoffMs);
            }
        }
    }

    return {
        email,
        status: VerificationResult.UNKNOWN,
        isValid: false,
        isRisky: true,
        rawResponse: {} as VerifierApiResponse,
        errorMessage: lastError?.message || 'Verification failed after retries',
    };
}

/**
 * Map MyEmailVerifier response to internal format.
 */
function mapVerifierResponse(
    email: string,
    response: VerifierApiResponse
): VerificationResponse {
    const statusCode = response.status_code?.toLowerCase();

    let status: VerificationResultType;
    let isValid = false;
    let isRisky = false;

    switch (statusCode) {
        case 'ok':
        case 'valid':
            status = VerificationResult.OK;
            isValid = true;
            break;

        case 'catch_all':
        case 'catchall':
            status = VerificationResult.CATCH_ALL;
            isValid = false; // Treated as risky, not valid
            isRisky = true;
            break;

        case 'invalid':
        case 'bad':
        case 'undeliverable':
            status = VerificationResult.INVALID;
            break;

        case 'disposable':
            status = VerificationResult.DISPOSABLE;
            break;

        case 'spamtrap':
        case 'spam_trap':
            status = VerificationResult.SPAMTRAP;
            isRisky = true;
            break;

        case 'unknown':
        default:
            status = VerificationResult.UNKNOWN;
            isRisky = true;
            break;
    }

    return {
        email,
        status,
        isValid,
        isRisky,
        rawResponse: response,
    };
}

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reset the circuit breaker (for testing)
 */
export function resetCircuitBreaker(): void {
    circuitBreaker = { failures: 0, lastFailureTime: 0, state: 'CLOSED' };
}
