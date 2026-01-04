/**
 * Email Verifier Module
 *
 * Re-exports all public APIs from the MyEmailVerifier client.
 */

export {
    // Main functions
    verifyEmail,
    getCredits,
    // Types
    type VerifierApiResponse,
    type CreditsApiResponse,
    type VerificationResponse,
    type VerifierConfig,
    // Testing utilities
    resetCircuitBreaker,
    resetRateLimiter,
    getRateLimiterState,
} from './client';
