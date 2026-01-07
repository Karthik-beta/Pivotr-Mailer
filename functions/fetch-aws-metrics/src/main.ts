/**
 * Fetch AWS Metrics Function — Main Entry Point
 * 
 * This Appwrite Function fetches SES and CloudWatch metrics from AWS
 * and stores them in the database for dashboard display.
 * 
 * Metrics fetched:
 * - SES Account quotas and limits
 * - Send statistics (deliveries, bounces, complaints)
 * - Reputation metrics
 * - Suppression list counts
 * 
 * Run: Scheduled every 5 minutes or on-demand
 */

import { Client, Databases, ID, Query } from 'node-appwrite';
import {
    SESv2Client,
    GetAccountCommand,
    ListSuppressedDestinationsCommand,
} from '@aws-sdk/client-sesv2';


// --- Types ---

interface AppwriteContext {
    req: {
        body: string;
        headers: Record<string, string>;
        method: string;
    };
    res: {
        json: (data: unknown, statusCode?: number) => unknown;
        text: (data: string, statusCode?: number) => unknown;
    };
    log: (message: string) => void;
    error: (message: string) => void;
}

interface AwsMetrics {
    // Account quotas
    sendQuotaMax24Hour: number;
    sendQuotaSentLast24Hours: number;
    sendQuotaMaxPerSecond: number;

    // Account status
    productionAccess: boolean;
    enforcementStatus: string;

    // Reputation (if available)
    reputationScore?: number;

    // Suppression list
    suppressionListCount: number;

    // Send statistics (last 24 hours)
    deliveryAttempts: number;
    bounces: number;
    complaints: number;
    rejects: number;

    // Calculated rates
    bounceRate: number;
    complaintRate: number;

    // Timestamp
    fetchedAt: string;
}

// --- Constants ---

const DATABASE_ID = 'pivotr_mailer';
const COLLECTION_ID_AWS_METRICS = 'aws_metrics';

// --- Main Function ---

export default async function main(context: AppwriteContext): Promise<unknown> {
    const { res, log, error: logErr } = context;

    // Appwrite endpoint for Docker
    let endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || '';
    if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
        endpoint = endpoint.replace('localhost', 'appwrite').replace('127.0.0.1', 'appwrite');
    }

    // Initialize Appwrite client
    const appwriteClient = new Client()
        .setEndpoint(endpoint)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
        .setKey(process.env.APPWRITE_API_KEY || '')
        .setSelfSigned(true);

    const databases = new Databases(appwriteClient);

    // Get AWS credentials from settings
    let awsConfig: {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
    };

    try {
        const settings = await databases.listDocuments(DATABASE_ID, 'settings', [
            Query.equal('category', 'aws'),
            Query.limit(10),
        ]);

        const getSetting = (key: string): string => {
            const doc = settings.documents.find(d => d.key === key);
            return (doc?.value as string) || '';
        };

        awsConfig = {
            accessKeyId: getSetting('ses_access_key_id'),
            secretAccessKey: getSetting('ses_secret_access_key'),
            region: getSetting('ses_region') || 'ap-south-1',
        };

        if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey) {
            throw new Error('AWS credentials not configured in database settings');
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`Failed to get AWS configuration: ${message}`);
        return res.json({ success: false, error: message }, 500);
    }

    log('Fetching AWS SES metrics...');

    try {
        const metrics = await fetchAwsMetrics(awsConfig, log);

        // Store metrics in database
        await storeMetrics(databases, metrics);

        log(`Metrics fetched and stored successfully`);

        return res.json({
            success: true,
            message: 'AWS metrics fetched successfully',
            data: metrics,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`Failed to fetch AWS metrics: ${message}`);
        return res.json({ success: false, error: message }, 500);
    }
}

// --- Helper Functions ---

async function fetchAwsMetrics(
    awsConfig: { accessKeyId: string; secretAccessKey: string; region: string },
    log: (msg: string) => void
): Promise<AwsMetrics> {
    const sesClient = new SESv2Client({
        region: awsConfig.region,
        credentials: {
            accessKeyId: awsConfig.accessKeyId,
            secretAccessKey: awsConfig.secretAccessKey,
        },
    });

    // Fetch account details
    log('Fetching SES account details...');
    const accountResponse = await sesClient.send(new GetAccountCommand({}));

    const sendQuota = accountResponse.SendQuota || {};
    const productionAccess = accountResponse.ProductionAccessEnabled || false;
    const enforcementStatus = accountResponse.EnforcementStatus || 'UNKNOWN';

    // SESv2 doesn't have GetSendStatistics - use quota data for send counts
    // Bounce/complaint details come from SQS events, not this API
    log('Using quota data for send statistics...');
    const deliveryAttempts = sendQuota.SentLast24Hours || 0;

    // Bounce/complaint rates are tracked separately via SQS events
    // These are just placeholders - actual values are in the metrics collection
    const bounces = 0;
    const complaints = 0;
    const rejects = 0;

    // Fetch suppression list count
    log('Fetching suppression list count...');
    let suppressionListCount = 0;
    try {
        const suppressionResponse = await sesClient.send(
            new ListSuppressedDestinationsCommand({ PageSize: 1 })
        );
        // Note: AWS doesn't provide a total count, only pagination
        // This is just a basic check if the list has any entries
        suppressionListCount = suppressionResponse.SuppressedDestinationSummaries?.length || 0;
    } catch {
        log('Note: Suppression list access not available');
    }

    // Calculate rates
    const total = deliveryAttempts || sendQuota.SentLast24Hours || 1;
    const bounceRate = (bounces / total) * 100;
    const complaintRate = (complaints / total) * 100;

    return {
        // Quotas
        sendQuotaMax24Hour: sendQuota.Max24HourSend || 0,
        sendQuotaSentLast24Hours: sendQuota.SentLast24Hours || 0,
        sendQuotaMaxPerSecond: sendQuota.MaxSendRate || 0,

        // Status
        productionAccess,
        enforcementStatus,

        // Suppression
        suppressionListCount,

        // Statistics
        deliveryAttempts,
        bounces,
        complaints,
        rejects,

        // Rates
        bounceRate: Math.round(bounceRate * 100) / 100,
        complaintRate: Math.round(complaintRate * 100) / 100,

        // Timestamp
        fetchedAt: new Date().toISOString(),
    };
}

async function storeMetrics(databases: Databases, metrics: AwsMetrics): Promise<void> {
    // Try to update existing metrics document, or create new one
    try {
        const existing = await databases.listDocuments(DATABASE_ID, COLLECTION_ID_AWS_METRICS, [
            Query.orderDesc('$createdAt'),
            Query.limit(1),
        ]);

        if (existing.documents.length > 0) {
            // Update existing document
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTION_ID_AWS_METRICS,
                existing.documents[0].$id,
                metrics
            );
        } else {
            // Create new document
            await databases.createDocument(
                DATABASE_ID,
                COLLECTION_ID_AWS_METRICS,
                ID.unique(),
                metrics
            );
        }
    } catch {
        // Collection might not exist, try to create document
        await databases.createDocument(
            DATABASE_ID,
            COLLECTION_ID_AWS_METRICS,
            ID.unique(),
            metrics
        );
    }
}
