/**
 * Unit Tests: Daily Sending Cap and Safety Controls
 *
 * Tests the business logic for daily caps and reputation protection.
 * These are critical safety features that prevent account suspension.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Safety Constants (from shared config)
// =============================================================================

const DAILY_SENDING_CAP = 500;
const MAX_BOUNCE_RATE = 0.05; // 5%
const MAX_COMPLAINT_RATE = 0.001; // 0.1%

// =============================================================================
// Daily Cap Logic
// =============================================================================

interface DailyMetrics {
    sentCount: number;
    bounces: number;
    complaints: number;
    deliveries: number;
}

/**
 * Check if daily sending cap allows more sends
 */
function isUnderDailyCap(metrics: DailyMetrics): boolean {
    return metrics.sentCount < DAILY_SENDING_CAP;
}

/**
 * Check if sending should be blocked due to reputation risk
 */
function shouldBlockForReputation(metrics: DailyMetrics): {
    blocked: boolean;
    reason?: string;
} {
    if (metrics.sentCount === 0) {
        return { blocked: false };
    }

    const bounceRate = metrics.bounces / metrics.sentCount;
    const complaintRate = metrics.complaints / metrics.sentCount;

    if (bounceRate > MAX_BOUNCE_RATE) {
        return {
            blocked: true,
            reason: `Bounce rate ${(bounceRate * 100).toFixed(2)}% exceeds ${MAX_BOUNCE_RATE * 100}% threshold`,
        };
    }

    if (complaintRate > MAX_COMPLAINT_RATE) {
        return {
            blocked: true,
            reason: `Complaint rate ${(complaintRate * 100).toFixed(3)}% exceeds ${MAX_COMPLAINT_RATE * 100}% threshold`,
        };
    }

    return { blocked: false };
}

/**
 * Determine if a lead should be sent to
 */
function canSendToLead(
    leadStatus: string,
    metrics: DailyMetrics
): { allowed: boolean; reason?: string } {
    // Check status
    if (leadStatus !== 'QUEUED' && leadStatus !== 'PENDING_IMPORT') {
        return { allowed: false, reason: `Invalid status: ${leadStatus}` };
    }

    // Check daily cap
    if (!isUnderDailyCap(metrics)) {
        return { allowed: false, reason: 'Daily sending cap reached' };
    }

    // Check reputation
    const reputationCheck = shouldBlockForReputation(metrics);
    if (reputationCheck.blocked) {
        return { allowed: false, reason: reputationCheck.reason };
    }

    return { allowed: true };
}

// =============================================================================
// Tests
// =============================================================================

describe('Daily Sending Cap', () => {
    describe('isUnderDailyCap', () => {
        it('should allow sending when under cap', () => {
            const metrics: DailyMetrics = {
                sentCount: 100,
                bounces: 0,
                complaints: 0,
                deliveries: 100,
            };

            expect(isUnderDailyCap(metrics)).toBe(true);
        });

        it('should block sending when at cap', () => {
            const metrics: DailyMetrics = {
                sentCount: DAILY_SENDING_CAP,
                bounces: 0,
                complaints: 0,
                deliveries: DAILY_SENDING_CAP,
            };

            expect(isUnderDailyCap(metrics)).toBe(false);
        });

        it('should block sending when over cap', () => {
            const metrics: DailyMetrics = {
                sentCount: DAILY_SENDING_CAP + 10,
                bounces: 0,
                complaints: 0,
                deliveries: DAILY_SENDING_CAP,
            };

            expect(isUnderDailyCap(metrics)).toBe(false);
        });

        it('should allow sending at zero', () => {
            const metrics: DailyMetrics = {
                sentCount: 0,
                bounces: 0,
                complaints: 0,
                deliveries: 0,
            };

            expect(isUnderDailyCap(metrics)).toBe(true);
        });

        it('should allow sending at cap minus one', () => {
            const metrics: DailyMetrics = {
                sentCount: DAILY_SENDING_CAP - 1,
                bounces: 0,
                complaints: 0,
                deliveries: DAILY_SENDING_CAP - 1,
            };

            expect(isUnderDailyCap(metrics)).toBe(true);
        });
    });
});

describe('Reputation Risk Detection', () => {
    describe('shouldBlockForReputation', () => {
        it('should not block with good metrics', () => {
            const metrics: DailyMetrics = {
                sentCount: 1000,
                bounces: 10, // 1% bounce rate
                complaints: 0,
                deliveries: 990,
            };

            const result = shouldBlockForReputation(metrics);
            expect(result.blocked).toBe(false);
        });

        it('should block when bounce rate exceeds 5%', () => {
            const metrics: DailyMetrics = {
                sentCount: 1000,
                bounces: 60, // 6% bounce rate
                complaints: 0,
                deliveries: 940,
            };

            const result = shouldBlockForReputation(metrics);
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('Bounce rate');
            expect(result.reason).toContain('exceeds');
        });

        it('should block when complaint rate exceeds 0.1%', () => {
            const metrics: DailyMetrics = {
                sentCount: 1000,
                bounces: 10,
                complaints: 2, // 0.2% complaint rate
                deliveries: 988,
            };

            const result = shouldBlockForReputation(metrics);
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('Complaint rate');
        });

        it('should not block at exactly 5% bounce rate', () => {
            const metrics: DailyMetrics = {
                sentCount: 1000,
                bounces: 50, // exactly 5%
                complaints: 0,
                deliveries: 950,
            };

            const result = shouldBlockForReputation(metrics);
            expect(result.blocked).toBe(false);
        });

        it('should not block at exactly 0.1% complaint rate', () => {
            const metrics: DailyMetrics = {
                sentCount: 1000,
                bounces: 0,
                complaints: 1, // exactly 0.1%
                deliveries: 999,
            };

            const result = shouldBlockForReputation(metrics);
            expect(result.blocked).toBe(false);
        });

        it('should not block with zero sends', () => {
            const metrics: DailyMetrics = {
                sentCount: 0,
                bounces: 0,
                complaints: 0,
                deliveries: 0,
            };

            const result = shouldBlockForReputation(metrics);
            expect(result.blocked).toBe(false);
        });

        it('should prioritize bounce rate over complaint rate in message', () => {
            const metrics: DailyMetrics = {
                sentCount: 100,
                bounces: 10, // 10% bounce
                complaints: 1, // 1% complaint
                deliveries: 89,
            };

            const result = shouldBlockForReputation(metrics);
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('Bounce rate');
        });
    });
});

describe('Lead Sending Decision', () => {
    describe('canSendToLead', () => {
        const goodMetrics: DailyMetrics = {
            sentCount: 100,
            bounces: 1,
            complaints: 0,
            deliveries: 99,
        };

        it('should allow QUEUED leads with good metrics', () => {
            const result = canSendToLead('QUEUED', goodMetrics);
            expect(result.allowed).toBe(true);
        });

        it('should allow PENDING_IMPORT leads with good metrics', () => {
            const result = canSendToLead('PENDING_IMPORT', goodMetrics);
            expect(result.allowed).toBe(true);
        });

        it('should reject SENT leads', () => {
            const result = canSendToLead('SENT', goodMetrics);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Invalid status');
        });

        it('should reject DELIVERED leads', () => {
            const result = canSendToLead('DELIVERED', goodMetrics);
            expect(result.allowed).toBe(false);
        });

        it('should reject BOUNCED leads', () => {
            const result = canSendToLead('BOUNCED', goodMetrics);
            expect(result.allowed).toBe(false);
        });

        it('should reject COMPLAINED leads', () => {
            const result = canSendToLead('COMPLAINED', goodMetrics);
            expect(result.allowed).toBe(false);
        });

        it('should reject when daily cap reached', () => {
            const atCapMetrics: DailyMetrics = {
                sentCount: DAILY_SENDING_CAP,
                bounces: 0,
                complaints: 0,
                deliveries: DAILY_SENDING_CAP,
            };

            const result = canSendToLead('QUEUED', atCapMetrics);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Daily sending cap');
        });

        it('should reject when reputation is at risk', () => {
            const badReputationMetrics: DailyMetrics = {
                sentCount: 100,
                bounces: 10, // 10% bounce rate
                complaints: 0,
                deliveries: 90,
            };

            const result = canSendToLead('QUEUED', badReputationMetrics);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Bounce rate');
        });
    });
});

describe('Metrics Tracking', () => {
    describe('Rate Calculations', () => {
        it('should calculate bounce rate correctly', () => {
            const metrics: DailyMetrics = {
                sentCount: 1000,
                bounces: 25,
                complaints: 0,
                deliveries: 975,
            };

            const bounceRate = metrics.bounces / metrics.sentCount;
            expect(bounceRate).toBe(0.025); // 2.5%
        });

        it('should calculate complaint rate correctly', () => {
            const metrics: DailyMetrics = {
                sentCount: 10000,
                bounces: 0,
                complaints: 5,
                deliveries: 9995,
            };

            const complaintRate = metrics.complaints / metrics.sentCount;
            expect(complaintRate).toBe(0.0005); // 0.05%
        });

        it('should calculate delivery rate correctly', () => {
            const metrics: DailyMetrics = {
                sentCount: 1000,
                bounces: 20,
                complaints: 2,
                deliveries: 978,
            };

            const deliveryRate = metrics.deliveries / metrics.sentCount;
            expect(deliveryRate).toBe(0.978); // 97.8%
        });
    });

    describe('Threshold Edge Cases', () => {
        it('should handle very small send volumes', () => {
            // 1 bounce out of 10 sends = 10% bounce rate
            const metrics: DailyMetrics = {
                sentCount: 10,
                bounces: 1,
                complaints: 0,
                deliveries: 9,
            };

            const result = shouldBlockForReputation(metrics);
            expect(result.blocked).toBe(true);
        });

        it('should handle single complaint in small volume', () => {
            // 1 complaint out of 100 sends = 1% complaint rate
            const metrics: DailyMetrics = {
                sentCount: 100,
                bounces: 0,
                complaints: 1,
                deliveries: 99,
            };

            const result = shouldBlockForReputation(metrics);
            expect(result.blocked).toBe(true); // 1% > 0.1% threshold
        });
    });
});
