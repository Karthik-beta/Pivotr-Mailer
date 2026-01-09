/**
 * Test Fixtures and Factories
 *
 * Provides factory functions for creating test data.
 * All fixtures are designed to be realistic and match production schemas.
 */

import { randomUUID } from 'crypto';

// =============================================================================
// Lead Fixtures
// =============================================================================

export type LeadStatus =
    | 'PENDING_IMPORT'
    | 'QUEUED'
    | 'VERIFIED'
    | 'SENT'
    | 'DELIVERED'
    | 'BOUNCED'
    | 'COMPLAINED'
    | 'SKIPPED'
    | 'SKIPPED_DAILY_CAP'
    | 'FAILED';

export type LeadType = 'HARDWARE' | 'SOFTWARE' | 'BOTH';

export interface Lead {
    id: string;
    fullName: string;
    email: string;
    companyName: string;
    phoneNumber?: string;
    leadType?: LeadType;
    status: LeadStatus;
    campaignId?: string;
    createdAt: string;
    updatedAt: string;
    // Email tracking fields
    lastMessageId?: string;
    sentAt?: string;
    deliveredAt?: string;
    bounceType?: string;
    bounceSubType?: string;
    complaintFeedbackType?: string;
    isUnsubscribed?: boolean;
    unsubscribedAt?: string;
    error?: string;
}

export interface CreateLeadOptions {
    id?: string;
    fullName?: string;
    email?: string;
    companyName?: string;
    phoneNumber?: string;
    leadType?: LeadType;
    status?: LeadStatus;
    campaignId?: string;
}

/**
 * Create a lead fixture with optional overrides
 */
export function createLead(options: CreateLeadOptions = {}): Lead {
    const now = new Date().toISOString();
    const id = options.id || randomUUID();

    return {
        id,
        fullName: options.fullName || 'John Doe',
        email: options.email || `john.doe.${id.slice(0, 8)}@example.com`,
        companyName: options.companyName || 'Acme Corp',
        phoneNumber: options.phoneNumber,
        leadType: options.leadType || 'SOFTWARE',
        status: options.status || 'PENDING_IMPORT',
        campaignId: options.campaignId,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Create multiple leads
 */
export function createLeads(count: number, options: CreateLeadOptions = {}): Lead[] {
    return Array.from({ length: count }, (_, i) =>
        createLead({
            ...options,
            fullName: options.fullName || `Test User ${i + 1}`,
            email: options.email || `user${i + 1}@example.com`,
        })
    );
}

// =============================================================================
// Campaign Fixtures
// =============================================================================

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'PAUSED_REPUTATION_RISK';

export interface Campaign {
    id: string;
    name: string;
    subject: string;
    bodyTemplate: string;
    status: CampaignStatus;
    scheduledAt?: string;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
    // Stats
    totalLeads?: number;
    sentCount?: number;
    deliveredCount?: number;
    bouncedCount?: number;
    complainedCount?: number;
}

export interface CreateCampaignOptions {
    id?: string;
    name?: string;
    subject?: string;
    bodyTemplate?: string;
    status?: CampaignStatus;
}

/**
 * Create a campaign fixture with optional overrides
 */
export function createCampaign(options: CreateCampaignOptions = {}): Campaign {
    const now = new Date().toISOString();
    const id = options.id || randomUUID();

    return {
        id,
        name: options.name || `Test Campaign ${id.slice(0, 8)}`,
        subject: options.subject || 'Hello {firstName}!',
        bodyTemplate: options.bodyTemplate || '<p>Hi {firstName}, this is a test email.</p>',
        status: options.status || 'DRAFT',
        createdAt: now,
        updatedAt: now,
    };
}

// =============================================================================
// SQS Message Fixtures
// =============================================================================

export interface SendEmailMessage {
    leadId: string;
    campaignId: string;
    subjectTemplate: string;
    bodyTemplate: string;
}

/**
 * Create an SQS send email message
 */
export function createSendEmailMessage(
    leadId: string,
    campaignId: string,
    options: Partial<Omit<SendEmailMessage, 'leadId' | 'campaignId'>> = {}
): SendEmailMessage {
    return {
        leadId,
        campaignId,
        subjectTemplate: options.subjectTemplate || 'Hello {firstName}!',
        bodyTemplate: options.bodyTemplate || '<p>Hi {firstName}, this is a test email.</p>',
    };
}

// =============================================================================
// SES Notification Fixtures
// =============================================================================

export interface SESBounceNotification {
    notificationType: 'Bounce';
    mail: {
        messageId: string;
        destination: string[];
        timestamp: string;
    };
    bounce: {
        bounceType: string;
        bounceSubType: string;
        bouncedRecipients: Array<{ emailAddress: string }>;
    };
}

export interface SESComplaintNotification {
    notificationType: 'Complaint';
    mail: {
        messageId: string;
        destination: string[];
        timestamp: string;
    };
    complaint: {
        complainedRecipients: Array<{ emailAddress: string }>;
        complaintFeedbackType?: string;
    };
}

export interface SESDeliveryNotification {
    notificationType: 'Delivery';
    mail: {
        messageId: string;
        destination: string[];
        timestamp: string;
    };
    delivery: {
        recipients: string[];
        timestamp: string;
    };
}

/**
 * Create an SES bounce notification
 */
export function createBounceNotification(
    email: string,
    messageId: string = randomUUID(),
    bounceType: string = 'Permanent',
    bounceSubType: string = 'General'
): SESBounceNotification {
    return {
        notificationType: 'Bounce',
        mail: {
            messageId,
            destination: [email],
            timestamp: new Date().toISOString(),
        },
        bounce: {
            bounceType,
            bounceSubType,
            bouncedRecipients: [{ emailAddress: email }],
        },
    };
}

/**
 * Create an SES complaint notification
 */
export function createComplaintNotification(
    email: string,
    messageId: string = randomUUID(),
    feedbackType: string = 'abuse'
): SESComplaintNotification {
    return {
        notificationType: 'Complaint',
        mail: {
            messageId,
            destination: [email],
            timestamp: new Date().toISOString(),
        },
        complaint: {
            complainedRecipients: [{ emailAddress: email }],
            complaintFeedbackType: feedbackType,
        },
    };
}

/**
 * Create an SES delivery notification
 */
export function createDeliveryNotification(
    email: string,
    messageId: string = randomUUID()
): SESDeliveryNotification {
    return {
        notificationType: 'Delivery',
        mail: {
            messageId,
            destination: [email],
            timestamp: new Date().toISOString(),
        },
        delivery: {
            recipients: [email],
            timestamp: new Date().toISOString(),
        },
    };
}

/**
 * Wrap SES notification as SNS message (as received via SQS)
 */
export function wrapAsSNSMessage(notification: object): object {
    return {
        Type: 'Notification',
        MessageId: randomUUID(),
        TopicArn: 'arn:aws:sns:us-east-1:000000000000:pivotr-ses-feedback',
        Subject: 'Amazon SES Email Event Notification',
        Message: JSON.stringify(notification),
        Timestamp: new Date().toISOString(),
    };
}

// =============================================================================
// Lambda Event Fixtures
// =============================================================================

/**
 * Create an SQS event record
 */
export function createSQSRecord(body: object, messageId: string = randomUUID()) {
    return {
        messageId,
        receiptHandle: `receipt-${messageId}`,
        body: JSON.stringify(body),
        attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: String(Date.now()),
            SenderId: 'AIDATEST',
            ApproximateFirstReceiveTimestamp: String(Date.now()),
        },
        messageAttributes: {},
        md5OfBody: 'test',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:test-queue',
        awsRegion: 'us-east-1',
    };
}

/**
 * Create an SQS Lambda event
 */
export function createSQSEvent(records: ReturnType<typeof createSQSRecord>[]) {
    return {
        Records: records,
    };
}

/**
 * Create an API Gateway event
 */
export function createAPIGatewayEvent(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: {
        pathParameters?: Record<string, string>;
        queryStringParameters?: Record<string, string>;
        body?: object | null;
        headers?: Record<string, string>;
    } = {}
) {
    return {
        httpMethod: method,
        path,
        pathParameters: options.pathParameters || null,
        queryStringParameters: options.queryStringParameters || null,
        body: options.body ? JSON.stringify(options.body) : null,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        multiValueHeaders: {},
        isBase64Encoded: false,
        requestContext: {
            accountId: '000000000000',
            apiId: 'test',
            authorizer: {},
            httpMethod: method,
            identity: {
                sourceIp: '127.0.0.1',
                userAgent: 'test',
            },
            path,
            protocol: 'HTTP/1.1',
            requestId: randomUUID(),
            requestTimeEpoch: Date.now(),
            resourceId: 'test',
            resourcePath: path,
            stage: 'test',
        },
        resource: path,
        stageVariables: null,
    };
}
