/**
 * Event Constants
 *
 * Defines event types for the immutable Event Log (Audit Trail).
 * These events act as a system-wide history of significant actions.
 */

export const EventType = {
    // Campaign Events
    CAMPAIGN_CREATED: 'campaign.created',
    CAMPAIGN_STARTED: 'campaign.started',
    CAMPAIGN_PAUSED: 'campaign.paused',
    CAMPAIGN_RESUMED: 'campaign.resumed',
    CAMPAIGN_ABORTING: 'campaign.aborting',
    CAMPAIGN_ABORTED: 'campaign.aborted',
    CAMPAIGN_COMPLETED: 'campaign.completed',
    CAMPAIGN_ERROR: 'campaign.error',

    // Lead Events
    LEAD_IMPORTED: 'lead.imported',
    LEAD_UPDATED: 'lead.updated',
    LEAD_DELETED: 'lead.deleted',
    LEAD_UNSUBSCRIBED: 'lead.unsubscribed',

    // Email Pipeline Events
    VERIFICATION_PASSED: 'email.verification.passed',
    VERIFICATION_FAILED: 'email.verification.failed',
    VERIFICATION_RISKY: 'email.verification.risky',
    EMAIL_SENDING: 'email.sending',
    EMAIL_SENT: 'email.sent',
    EMAIL_FAILED: 'email.failed',

    // Post-Send Events
    BOUNCE_RECEIVED: 'email.bounce',
    COMPLAINT_RECEIVED: 'email.complaint',
    UNSUBSCRIBED: 'email.unsubscribed',

    // System Events
    SYSTEM_STARTUP: 'system.startup',
    SYSTEM_SHUTDOWN: 'system.shutdown',
    SYSTEM_ERROR: 'system.error',
    SYSTEM_RECOVERY: 'system.recovery',
} as const;

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];
