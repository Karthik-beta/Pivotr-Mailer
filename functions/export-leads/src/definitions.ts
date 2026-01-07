
export const DATABASE_ID = "pivotr_mailer";

export const CollectionId = {
    LEADS: "leads",
    CAMPAIGNS: "campaigns",
    LOGS: "logs",
    METRICS: "metrics",
    SETTINGS: "settings",
    STAGED_LEADS: "staged_leads",
} as const;

export interface ExportLeadsRequest {
    campaignId?: string;
    status?: string;
    format: "xlsx" | "csv" | "json";
    template?: boolean;
}
