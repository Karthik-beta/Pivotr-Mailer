/**
 * Migration 001: Initial Setup (Consolidated)
 *
 * Sets up the entire database schema:
 * 1. Database
 * 2. Collections & Attributes
 * 3. Indexes
 * 4. Initial Seed Data
 */
import { type Client, Databases, IndexType } from "node-appwrite";
import {
    CollectionId,
    DATABASE_ID,
    GLOBAL_METRICS_ID,
    SETTINGS_DOCUMENT_ID,
} from "../shared/constants/collection.constants";
import {
    CampaignStatus,
    LeadStatus,
    LeadType,
    LogSeverity,
    MetricsScope,
} from "../shared/constants/status.constants";
import { EventType } from "../shared/constants/event.constants";
import { DEFAULT_SETTINGS } from "../shared/types/settings.types";

export async function createInitialSchema(client: Client): Promise<void> {
    const databases = new Databases(client);

    console.log("╔═══════════════════════════════════════════════════════════════╗");
    console.log("║           PIVOTR MAILER - INITIAL SETUP                       ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");

    // 1. Create Database
    try {
        await databases.get(DATABASE_ID);
        console.log(`Database '${DATABASE_ID}' already exists.`);
    } catch {
        await databases.create(DATABASE_ID, "Pivotr Mailer", true);
        console.log(`Database '${DATABASE_ID}' created.`);
    }

    // 2. Create Collections & Attributes
    await setupLeadsCollection(databases);
    await setupCampaignsCollection(databases);
    await setupLogsCollection(databases);
    await setupMetricsCollection(databases);
    await setupSettingsCollection(databases);
    await setupLocksCollection(databases);
    await setupStagedLeadsCollection(databases);

    // 3. Wait for attributes to propagate
    console.log("Waiting for attributes to be available (5s)...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 4. Create Indexes
    await setupIndexes(databases);

    // 5. Seed Data
    await seedInitialData(databases);

    console.log("✓ Initial setup complete.");
}

async function setupLeadsCollection(databases: Databases) {
    const cid = CollectionId.LEADS;
    try {
        await databases.getCollection(DATABASE_ID, cid);
        console.log(`Collection '${cid}' exists.`);
    } catch {
        await databases.createCollection(DATABASE_ID, cid, "Leads", undefined, true, true);
        console.log(`Collection '${cid}' created.`);

        // Attributes
        await databases.createStringAttribute(DATABASE_ID, cid, "fullName", 255, true);
        await databases.createStringAttribute(DATABASE_ID, cid, "parsedFirstName", 100, false);
        await databases.createEmailAttribute(DATABASE_ID, cid, "email", true);
        await databases.createStringAttribute(DATABASE_ID, cid, "companyName", 255, true);
        await databases.createStringAttribute(DATABASE_ID, cid, "phoneNumber", 20, false);

        await databases.createEnumAttribute(DATABASE_ID, cid, "leadType", Object.values(LeadType), false);
        await databases.createEnumAttribute(DATABASE_ID, cid, "status", Object.values(LeadStatus), false, LeadStatus.PENDING_IMPORT);

        await databases.createStringAttribute(DATABASE_ID, cid, "verificationResult", 50, false);
        await databases.createDatetimeAttribute(DATABASE_ID, cid, "verificationTimestamp", false);

        await databases.createStringAttribute(DATABASE_ID, cid, "sesMessageId", 100, false);
        await databases.createStringAttribute(DATABASE_ID, cid, "bounceType", 50, false);
        await databases.createStringAttribute(DATABASE_ID, cid, "bounceSubType", 50, false);
        await databases.createStringAttribute(DATABASE_ID, cid, "complaintFeedbackType", 50, false);

        await databases.createStringAttribute(DATABASE_ID, cid, "campaignId", 36, false);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "queuePosition", false);

        await databases.createDatetimeAttribute(DATABASE_ID, cid, "processingStartedAt", false);
        await databases.createDatetimeAttribute(DATABASE_ID, cid, "processedAt", false);

        await databases.createStringAttribute(DATABASE_ID, cid, "errorMessage", 1000, false);

        await databases.createBooleanAttribute(DATABASE_ID, cid, "isUnsubscribed", false, false);
        await databases.createDatetimeAttribute(DATABASE_ID, cid, "unsubscribedAt", false);

        await databases.createStringAttribute(DATABASE_ID, cid, "metadata", 10000, false);
    }
}

async function setupCampaignsCollection(databases: Databases) {
    const cid = CollectionId.CAMPAIGNS;
    try {
        await databases.getCollection(DATABASE_ID, cid);
        console.log(`Collection '${cid}' exists.`);
    } catch {
        await databases.createCollection(DATABASE_ID, cid, "Campaigns", undefined, true, true);
        console.log(`Collection '${cid}' created.`);

        await databases.createStringAttribute(DATABASE_ID, cid, "name", 255, true);
        await databases.createEnumAttribute(DATABASE_ID, cid, "status", Object.values(CampaignStatus), false, CampaignStatus.DRAFT);

        await databases.createStringAttribute(DATABASE_ID, cid, "subjectTemplate", 998, true);
        await databases.createStringAttribute(DATABASE_ID, cid, "bodyTemplate", 100000, true);

        await databases.createEmailAttribute(DATABASE_ID, cid, "senderEmail", true);
        await databases.createStringAttribute(DATABASE_ID, cid, "senderName", 255, true);

        await databases.createIntegerAttribute(DATABASE_ID, cid, "totalLeads", false, 0);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "processedCount", false, 0);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "skippedCount", false, 0);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "errorCount", false, 0);

        await databases.createDatetimeAttribute(DATABASE_ID, cid, "pausedAt", false);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "resumePosition", false);

        await databases.createIntegerAttribute(DATABASE_ID, cid, "minDelayMs", false, 60000);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "maxDelayMs", false, 180000);
        await databases.createFloatAttribute(DATABASE_ID, cid, "gaussianMean", false);
        await databases.createFloatAttribute(DATABASE_ID, cid, "gaussianStdDev", false);

        await databases.createBooleanAttribute(DATABASE_ID, cid, "allowCatchAll", false, false);

        await databases.createDatetimeAttribute(DATABASE_ID, cid, "lastActivityAt", false);
        await databases.createDatetimeAttribute(DATABASE_ID, cid, "completedAt", false);
    }
}

async function setupLogsCollection(databases: Databases) {
    const cid = CollectionId.LOGS;
    try {
        await databases.getCollection(DATABASE_ID, cid);
        console.log(`Collection '${cid}' exists.`);
    } catch {
        await databases.createCollection(DATABASE_ID, cid, "Logs", undefined, true, true);
        console.log(`Collection '${cid}' created.`);

        await databases.createEnumAttribute(DATABASE_ID, cid, "eventType", Object.values(EventType), true);
        await databases.createStringAttribute(DATABASE_ID, cid, "leadId", 36, false);
        await databases.createStringAttribute(DATABASE_ID, cid, "campaignId", 36, false);
        await databases.createEnumAttribute(DATABASE_ID, cid, "severity", Object.values(LogSeverity), false, LogSeverity.INFO);
        await databases.createStringAttribute(DATABASE_ID, cid, "message", 1000, true);

        await databases.createStringAttribute(DATABASE_ID, cid, "resolvedSubject", 998, false);
        await databases.createStringAttribute(DATABASE_ID, cid, "resolvedBody", 100000, false);
        await databases.createStringAttribute(DATABASE_ID, cid, "templateVariables", 4000, false);

        await databases.createStringAttribute(DATABASE_ID, cid, "verifierResponse", 1000, false);
        await databases.createStringAttribute(DATABASE_ID, cid, "sesResponse", 1000, false);
        await databases.createStringAttribute(DATABASE_ID, cid, "sqsMessage", 100000, false);

        await databases.createIntegerAttribute(DATABASE_ID, cid, "processingTimeMs", false);
        await databases.createStringAttribute(DATABASE_ID, cid, "errorDetails", 2000, false);
        await databases.createStringAttribute(DATABASE_ID, cid, "metadata", 2000, false);
    }
}

async function setupMetricsCollection(databases: Databases) {
    const cid = CollectionId.METRICS;
    try {
        await databases.getCollection(DATABASE_ID, cid);
        console.log(`Collection '${cid}' exists.`);
    } catch {
        await databases.createCollection(DATABASE_ID, cid, "Metrics", undefined, true, true);
        console.log(`Collection '${cid}' created.`);

        await databases.createEnumAttribute(DATABASE_ID, cid, "scope", Object.values(MetricsScope), true);
        await databases.createStringAttribute(DATABASE_ID, cid, "scopeId", 36, false);

        const counters = [
            "totalLeadsImported", "totalEmailsSent", "totalBounces", "totalHardBounces", "totalSoftBounces",
            "totalComplaints", "totalVerificationPassed", "totalVerificationFailed", "totalSkipped", "totalErrors",
            "verifierCreditsUsed", "totalDelivered", "totalOpens", "totalClicks", "totalRejected", "totalDelayed"
        ];

        for (const cnt of counters) {
            await databases.createIntegerAttribute(DATABASE_ID, cid, cnt, false, 0);
        }

        await databases.createDatetimeAttribute(DATABASE_ID, cid, "lastUpdatedAt", true);
    }
}

async function setupSettingsCollection(databases: Databases) {
    const cid = CollectionId.SETTINGS;
    try {
        await databases.getCollection(DATABASE_ID, cid);
        console.log(`Collection '${cid}' exists.`);
    } catch {
        await databases.createCollection(DATABASE_ID, cid, "Settings", undefined, true, true);
        console.log(`Collection '${cid}' created.`);

        await databases.createStringAttribute(DATABASE_ID, cid, "awsSesRegion", 50, true);
        await databases.createStringAttribute(DATABASE_ID, cid, "awsSesAccessKeyId", 100, true);
        await databases.createStringAttribute(DATABASE_ID, cid, "awsSesSecretAccessKey", 200, true);

        await databases.createStringAttribute(DATABASE_ID, cid, "awsSqsQueueUrl", 500, true);
        await databases.createStringAttribute(DATABASE_ID, cid, "awsSqsRegion", 50, true);

        await databases.createStringAttribute(DATABASE_ID, cid, "myEmailVerifierApiKey", 200, true);

        await databases.createIntegerAttribute(DATABASE_ID, cid, "defaultMinDelayMs", false, 60000);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "defaultMaxDelayMs", false, 180000);

        await databases.createIntegerAttribute(DATABASE_ID, cid, "sqsPollingIntervalMs", false, 60000);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "verifierTimeoutMs", false, 10000);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "sesTimeoutMs", false, 30000);

        await databases.createIntegerAttribute(DATABASE_ID, cid, "maxRetries", false, 3);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "retryBackoffMs", false, 1000);

        await databases.createStringAttribute(DATABASE_ID, cid, "unsubscribeTokenSecret", 256, true);
    }
}

async function setupLocksCollection(databases: Databases) {
    const cid = "locks";
    try {
        await databases.getCollection(DATABASE_ID, cid);
        console.log(`Collection '${cid}' exists.`);
    } catch {
        await databases.createCollection(DATABASE_ID, cid, "Locks", undefined, true, true);
        console.log(`Collection '${cid}' created.`);

        await databases.createStringAttribute(DATABASE_ID, cid, "campaignId", 36, true);
        await databases.createStringAttribute(DATABASE_ID, cid, "instanceId", 50, true);
        await databases.createDatetimeAttribute(DATABASE_ID, cid, "acquiredAt", true);
        await databases.createDatetimeAttribute(DATABASE_ID, cid, "expiresAt", true);
    }
}

async function setupStagedLeadsCollection(databases: Databases) {
    const cid = CollectionId.STAGED_LEADS;
    try {
        await databases.getCollection(DATABASE_ID, cid);
        console.log(`Collection '${cid}' exists.`);
    } catch {
        await databases.createCollection(DATABASE_ID, cid, "Staged Leads", undefined, true, true);
        console.log(`Collection '${cid}' created.`);

        await databases.createStringAttribute(DATABASE_ID, cid, "batchId", 36, true);
        await databases.createIntegerAttribute(DATABASE_ID, cid, "rowNumber", true);

        await databases.createStringAttribute(DATABASE_ID, cid, "fullName", 255, true);
        await databases.createStringAttribute(DATABASE_ID, cid, "email", 255, true);
        await databases.createStringAttribute(DATABASE_ID, cid, "companyName", 255, true);

        await databases.createStringAttribute(DATABASE_ID, cid, "phoneNumber", 20, false);
        await databases.createEnumAttribute(DATABASE_ID, cid, "leadType", Object.values(LeadType), false);

        await databases.createStringAttribute(DATABASE_ID, cid, "validationErrors", 5000, false);
        await databases.createBooleanAttribute(DATABASE_ID, cid, "isValid", true);

        await databases.createDatetimeAttribute(DATABASE_ID, cid, "importedAt", true);
        await databases.createStringAttribute(DATABASE_ID, cid, "importedBy", 36, false);

        await databases.createStringAttribute(DATABASE_ID, cid, "metadata", 4000, false);
    }
}

async function setupIndexes(databases: Databases) {
    console.log("Creating indexes...");

    const safelyCreateIndex = async (cid: string, key: string, type: IndexType, attr: string[]) => {
        try {
            await databases.createIndex(DATABASE_ID, cid, key, type, attr);
            console.log(`Index ${cid}.${key} created.`);
        } catch {
            console.log(`Index ${cid}.${key} skipped.`);
        }
    };

    // Leads
    await safelyCreateIndex(CollectionId.LEADS, "status_idx", IndexType.Key, ["status"]);
    await safelyCreateIndex(CollectionId.LEADS, "email_unique_idx", IndexType.Unique, ["email"]);
    await safelyCreateIndex(CollectionId.LEADS, "unsubscribed_idx", IndexType.Key, ["isUnsubscribed"]);
    await safelyCreateIndex(CollectionId.LEADS, "campaign_queue_idx", IndexType.Key, ["campaignId", "status", "queuePosition"]);
    await safelyCreateIndex(CollectionId.LEADS, "ses_message_idx", IndexType.Key, ["sesMessageId"]);

    // Campaigns
    await safelyCreateIndex(CollectionId.CAMPAIGNS, "status_idx", IndexType.Key, ["status"]);

    // Logs
    await safelyCreateIndex(CollectionId.LOGS, "event_type_idx", IndexType.Key, ["eventType"]);
    await safelyCreateIndex(CollectionId.LOGS, "lead_idx", IndexType.Key, ["leadId"]);
    await safelyCreateIndex(CollectionId.LOGS, "campaign_idx", IndexType.Key, ["campaignId"]);
    await safelyCreateIndex(CollectionId.LOGS, "severity_idx", IndexType.Key, ["severity"]);

    // Metrics
    await safelyCreateIndex(CollectionId.METRICS, "scope_idx", IndexType.Key, ["scope"]);
    await safelyCreateIndex(CollectionId.METRICS, "scope_id_idx", IndexType.Key, ["scopeId"]);

    // Locks
    await safelyCreateIndex("locks", "campaign_idx", IndexType.Key, ["campaignId"]);
    await safelyCreateIndex("locks", "expires_idx", IndexType.Key, ["expiresAt"]);

    // Staged Leads
    await safelyCreateIndex(CollectionId.STAGED_LEADS, "batch_id_idx", IndexType.Key, ["batchId"]);
    await safelyCreateIndex(CollectionId.STAGED_LEADS, "is_valid_idx", IndexType.Key, ["isValid"]);
}

async function seedInitialData(databases: Databases) {
    console.log("Seeding data...");

    // Settings
    try {
        await databases.createDocument(DATABASE_ID, CollectionId.SETTINGS, SETTINGS_DOCUMENT_ID, {
            ...DEFAULT_SETTINGS,
            unsubscribeTokenSecret: generateSecureToken(64),
        });
        console.log("Settings created.");
    } catch { console.log("Settings exist."); }

    // Metrics
    try {
        await databases.createDocument(DATABASE_ID, CollectionId.METRICS, GLOBAL_METRICS_ID, {
            scope: MetricsScope.GLOBAL,
            scopeId: null,
            totalLeadsImported: 0,
            totalEmailsSent: 0,
            totalBounces: 0,
            totalHardBounces: 0,
            totalSoftBounces: 0,
            totalComplaints: 0,
            totalVerificationPassed: 0,
            totalVerificationFailed: 0,
            totalSkipped: 0,
            totalErrors: 0,
            verifierCreditsUsed: 0,
            totalDelivered: 0,
            totalOpens: 0,
            totalClicks: 0,
            totalRejected: 0,
            totalDelayed: 0,
            lastUpdatedAt: new Date().toISOString(),
        });
        console.log("Global metrics created.");
    } catch { console.log("Global metrics exist."); }
}

function generateSecureToken(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
    }
    return result;
}
