/**
 * MyEmailVerifier API Client
 *
 * Official API Integration based on:
 * https://myemailverifier.com/real-time-email-verification
 *
 * Features:
 * - Single email verification
 * - Credits balance check
 * - Grey-listed handling with retry scheduling
 * - Rate limiting (30 req/min)
 * - Circuit breaker for fault tolerance
 */

// Inline type and constant to avoid cross-module path issues in Appwrite functions
type VerificationResultType = 'ok' | 'invalid' | 'catch_all' | 'unknown' | 'spamtrap' | 'disposable' | 'greylisted';

const VerificationResult = {
    OK: 'ok',
    INVALID: 'invalid',
    CATCH_ALL: 'catch_all',
    UNKNOWN: 'unknown',
    SPAMTRAP: 'spamtrap',
    DISPOSABLE: 'disposable',
    GREYLISTED: 'greylisted',
} as const;

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE_URL = 'https://client.myemailverifier.com/verifier';

/**
 * API Endpoints per official documentation
 */
const ENDPOINTS = {
    validateSingle: (email: string, apiKey: string) =>
        `${API_BASE_URL}/validate_single/${encodeURIComponent(email)}/${apiKey}`,
    getCredits: (apiKey: string) => `${API_BASE_URL}/getcredits/${apiKey}`,
};

// ============================================================================
// Types - Official API Response Structures
// ============================================================================

/**
 * MyEmailVerifier API response structure (per official docs)
 */
export interface VerifierApiResponse {
    /** The email address that was verified */
    Address: string;
    /** Status: Valid, Invalid, Unknown, Catch All, Grey-listed */
    Status: 'Valid' | 'Invalid' | 'Unknown' | 'Catch All' | 'Grey-listed';
    /** SMTP server status code for advanced users */
    StatusCode?: string;
    /** If the domain is disposable (temporary email service) */
    Disposable_Domain: string;
    /** If email is not a business address (free provider) */
    Free_Domain: string;
    /** Server won't respond properly on first attempt */
    Greylisted: string;
    /** If this is a role-based email (e.g., info@, support@) */
    Role_Based: string;
    /** Domain responds positively to all verifications */
    catch_all: string;
    /** Helpful information about the address */
    Diagnosis: string;
}

/**
 * Credits API response
 */
export interface CreditsApiResponse {
    Credits: string;
}

/**
 * Error response from API
 */
export interface ErrorApiResponse {
    status: boolean;
    message: string;
}

/**
 * Internal verification result
 */
export interface VerificationResponse {
    email: string;
    status: VerificationResultType;
    isValid: boolean;
    isRisky: boolean;
    isGreylisted: boolean;
    diagnosis: string;
    rawResponse: VerifierApiResponse;
    errorMessage?: string;
    /** For greylisted: when to retry (hours from now) */
    retryAfterHours?: number;
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

// ============================================================================
// Rate Limiting
// ============================================================================

const RATE_LIMIT = 30; // 30 requests per minute per API docs
const RATE_WINDOW_MS = 60000;

interface RateLimiterState {
    requestCount: number;
    windowStart: number;
}

let rateLimiter: RateLimiterState = {
    requestCount: 0,
    windowStart: Date.now(),
};

/**
 * Check if we can make a request within rate limits
 */
function checkRateLimit(): boolean {
    const now = Date.now();
    if (now - rateLimiter.windowStart > RATE_WINDOW_MS) {
        rateLimiter = { requestCount: 0, windowStart: now };
    }
    return rateLimiter.requestCount < RATE_LIMIT;
}

/**
 * Increment request count
 */
function incrementRateLimit(): void {
    rateLimiter.requestCount++;
}

/**
 * Get time to wait before next request is allowed
 */
function getRetryAfterMs(): number {
    const elapsed = Date.now() - rateLimiter.windowStart;
    return Math.max(0, RATE_WINDOW_MS - elapsed);
}

// ============================================================================
// Circuit Breaker
// ============================================================================

interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60000;

let circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
};

// ============================================================================
// Credits API
// ============================================================================

/**
 * Get available verification credits
 *
 * @param apiKey - MyEmailVerifier API key
 * @returns Number of available credits
 * @throws Error if API call fails
 */
export async function getCredits(apiKey: string): Promise<number> {
    const url = ENDPOINTS.getCredits(apiKey);

    const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`Credits API error: HTTP ${response.status}`);
    }

    const data = (await response.json()) as CreditsApiResponse | ErrorApiResponse;

    // Check for error response
    if ('status' in data && data.status === false) {
        throw new Error((data as ErrorApiResponse).message || 'Unknown error');
    }

    const credits = parseInt((data as CreditsApiResponse).Credits, 10);
    if (Number.isNaN(credits)) {
        throw new Error('Invalid credits response');
    }

    return credits;
}

// ============================================================================
// Email Verification API
// ============================================================================

/**
 * Verify an email address using MyEmailVerifier API.
 *
 * @param email - Email address to verify
 * @param config - Verifier configuration
 * @returns Verification result
 */
export async function verifyEmail(
    email: string,
    config: VerifierConfig
): Promise<VerificationResponse> {
    // Check rate limit
    if (!checkRateLimit()) {
        const retryAfterMs = getRetryAfterMs();
        return {
            email,
            status: VerificationResult.UNKNOWN,
            isValid: false,
            isRisky: true,
            isGreylisted: false,
            diagnosis: `Rate limited - retry after ${Math.ceil(retryAfterMs / 1000)}s`,
            rawResponse: {} as VerifierApiResponse,
            errorMessage: `Rate limit exceeded. Retry after ${retryAfterMs}ms`,
        };
    }

    // Check circuit breaker
    if (circuitBreaker.state === 'OPEN') {
        const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
        if (timeSinceLastFailure < CIRCUIT_BREAKER_RESET_MS) {
            return {
                email,
                status: VerificationResult.UNKNOWN,
                isValid: false,
                isRisky: true,
                isGreylisted: false,
                diagnosis: 'Circuit breaker open - service temporarily unavailable',
                rawResponse: {} as VerifierApiResponse,
                errorMessage: 'Circuit breaker open - verification service temporarily unavailable',
            };
        }
        circuitBreaker.state = 'HALF_OPEN';
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
        try {
            incrementRateLimit();

            const url = ENDPOINTS.validateSingle(email, config.apiKey);
            const response = await fetchWithTimeout(url, { method: 'GET' }, config.timeoutMs);

            if (!response.ok) {
                // Handle specific HTTP errors
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded by server');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as VerifierApiResponse | ErrorApiResponse;

            // Check for error response format
            if ('status' in data && (data as ErrorApiResponse).status === false) {
                throw new Error((data as ErrorApiResponse).message || 'API returned error');
            }

            // Reset circuit breaker on success
            circuitBreaker = { failures: 0, lastFailureTime: 0, state: 'CLOSED' };

            return mapVerifierResponse(email, data as VerifierApiResponse);
        } catch (error) {
            lastError = error as Error;

            // Increment circuit breaker failures
            circuitBreaker.failures++;
            circuitBreaker.lastFailureTime = Date.now();

            if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
                circuitBreaker.state = 'OPEN';
            }

            // Exponential backoff before retry
            if (attempt < config.maxRetries - 1) {
                const backoffMs = config.retryBackoffMs * 2 ** attempt;
                await sleep(backoffMs);
            }
        }
    }

    return {
        email,
        status: VerificationResult.UNKNOWN,
        isValid: false,
        isRisky: true,
        isGreylisted: false,
        diagnosis: 'Verification failed after retries',
        rawResponse: {} as VerifierApiResponse,
        errorMessage: lastError?.message || 'Verification failed after retries',
    };
}

// ============================================================================
// Response Mapping
// ============================================================================

/**
 * Map MyEmailVerifier API response to internal format
 */
function mapVerifierResponse(email: string, response: VerifierApiResponse): VerificationResponse {
    const status = response.Status;
    const isDisposable = response.Disposable_Domain?.toLowerCase() === 'true';
    const isRoleBased = response.Role_Based?.toLowerCase() === 'true';
    const isCatchAll = response.catch_all?.toLowerCase() === 'true';
    const isGreylistedFromFlag = response.Greylisted?.toLowerCase() === 'true';

    let verificationStatus: VerificationResultType;
    let isValid = false;
    let isRisky = false;
    let isGreylisted = isGreylistedFromFlag; // Initialize from flag
    let retryAfterHours: number | undefined;

    // Map API status to internal status
    switch (status) {
        case 'Valid':
            verificationStatus = VerificationResult.OK;
            isValid = true;
            // Check for risky indicators even on valid
            if (isRoleBased) {
                isRisky = true;
            }
            break;

        case 'Invalid':
            verificationStatus = VerificationResult.INVALID;
            break;

        case 'Catch All':
            verificationStatus = VerificationResult.CATCH_ALL;
            isRisky = true;
            break;

        case 'Grey-listed':
            verificationStatus = VerificationResult.GREYLISTED;
            isRisky = true;
            isGreylisted = true;
            retryAfterHours = 6; // Middle of 5-10 hour range per docs
            break;

        case 'Unknown':
        default:
            verificationStatus = VerificationResult.UNKNOWN;
            isRisky = true;
            break;
    }

    // Override for disposable domains
    if (isDisposable) {
        verificationStatus = VerificationResult.DISPOSABLE;
        isValid = false;
        isRisky = true;
    }

    // Set catch_all flag for risky
    if (isCatchAll && verificationStatus !== VerificationResult.INVALID) {
        isRisky = true;
    }

    return {
        email,
        status: verificationStatus,
        isValid,
        isRisky,
        isGreylisted,
        diagnosis: response.Diagnosis || '',
        rawResponse: response,
        retryAfterHours,
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

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

/**
 * Reset the rate limiter (for testing)
 */
export function resetRateLimiter(): void {
    rateLimiter = { requestCount: 0, windowStart: Date.now() };
}

/**
 * Get current rate limiter state (for monitoring)
 */
export function getRateLimiterState(): { requestsRemaining: number; resetInMs: number } {
    const now = Date.now();
    if (now - rateLimiter.windowStart > RATE_WINDOW_MS) {
        return { requestsRemaining: RATE_LIMIT, resetInMs: 0 };
    }
    return {
        requestsRemaining: Math.max(0, RATE_LIMIT - rateLimiter.requestCount),
        resetInMs: Math.max(0, RATE_WINDOW_MS - (now - rateLimiter.windowStart)),
    };
}
