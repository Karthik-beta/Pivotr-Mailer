/**
 * Orchestrator Function — Main Entry Point
 *
 * This is the main Appwrite Function that controls campaign execution.
 * It receives HTTP requests to start, pause, resume, or abort campaigns.
 *
 * API Endpoints:
 *   POST /start   - Start a campaign
 *   POST /pause   - Pause a running campaign
 *   POST /resume  - Resume a paused campaign
 *   POST /abort   - Abort a campaign
 */

import { Client } from 'node-appwrite';
import { EventType } from '../../../shared/constants/event.constants';
import { CampaignStatus } from '../../../shared/constants/status.constants';
// Shared modules
import {
	getCampaignById,
	getRunningCampaigns,
	updateCampaign,
} from '../../_shared/database/repositories/campaign.repository';
import { logError, logInfo } from '../../_shared/database/repositories/log.repository';
import { cleanupStaleLocks } from '../../_shared/locking/campaign-lock';
// Local modules
import { executeCampaign, type OrchestratorConfig } from './campaign-handler';

/**
 * Request body structure
 */
interface OrchestratorRequest {
	action: 'start' | 'pause' | 'resume' | 'abort' | 'recover';
	campaignId?: string;
}

// Response structure is inlined in res.json() calls

/**
 * Appwrite Function context
 */
interface AppwriteContext {
	req: {
		body: string;
		headers: Record<string, string>;
		method: string;
		path: string;
	};
	res: {
		json: (data: unknown, statusCode?: number) => unknown;
		text: (data: string, statusCode?: number) => unknown;
	};
	log: (message: string) => void;
	error: (message: string) => void;
}

/**
 * Main entry point for the Appwrite Function.
 */
export default async function main(context: AppwriteContext): Promise<unknown> {
	const { req, res, log, error: logErr } = context;

	// Initialize Appwrite client
	const client = new Client()
		.setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '')
		.setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
		.setKey(process.env.APPWRITE_API_KEY || '');

	const config: OrchestratorConfig = {
		appwriteClient: client,
		appwriteEndpoint: process.env.APPWRITE_FUNCTION_API_ENDPOINT || '',
		unsubscribeFunctionId: process.env.UNSUBSCRIBE_FUNCTION_ID || '',
	};

	try {
		// Parse request
		let request: OrchestratorRequest;
		try {
			request = JSON.parse(req.body || '{}');
		} catch {
			return res.json({ success: false, message: 'Invalid JSON body' }, 400);
		}

		const { action, campaignId } = request;

		log(`Received action: ${action} for campaign: ${campaignId || 'none'}`);

		// Route to appropriate handler
		switch (action) {
			case 'start':
				return await handleStart(client, config, campaignId, res);

			case 'pause':
				return await handlePause(client, campaignId, res);

			case 'resume':
				return await handleResume(client, config, campaignId, res);

			case 'abort':
				return await handleAbort(client, campaignId, res);

			case 'recover':
				return await handleRecover(client, config, res);

			default:
				return res.json(
					{
						success: false,
						message: `Unknown action: ${action}. Valid actions: start, pause, resume, abort, recover`,
					},
					400
				);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logErr(`Orchestrator error: ${message}`);

		await logError(client, EventType.SYSTEM_ERROR, `Orchestrator error: ${message}`, {});

		return res.json({ success: false, message }, 500);
	}
}

/**
 * Handle START action
 */
async function handleStart(
	client: Client,
	config: OrchestratorConfig,
	campaignId: string | undefined,
	res: AppwriteContext['res']
): Promise<unknown> {
	if (!campaignId) {
		return res.json({ success: false, message: 'campaignId is required' }, 400);
	}

	const campaign = await getCampaignById(client, campaignId);
	if (!campaign) {
		return res.json({ success: false, message: 'Campaign not found' }, 404);
	}

	if (campaign.status === CampaignStatus.RUNNING) {
		return res.json({ success: false, message: 'Campaign is already running' }, 400);
	}

	if (campaign.status === CampaignStatus.COMPLETED) {
		return res.json({ success: false, message: 'Campaign is already completed' }, 400);
	}

	// Execute campaign (this will run for a long time)
	const result = await executeCampaign(campaignId, config);

	return res.json({
		success: result.status === 'completed',
		message: result.message,
		data: {
			status: result.status,
			leadsProcessed: result.leadsProcessed,
			leadsSkipped: result.leadsSkipped,
			leadsErrored: result.leadsErrored,
		},
	});
}

/**
 * Handle PAUSE action
 */
async function handlePause(
	client: Client,
	campaignId: string | undefined,
	res: AppwriteContext['res']
): Promise<unknown> {
	if (!campaignId) {
		return res.json({ success: false, message: 'campaignId is required' }, 400);
	}

	const campaign = await getCampaignById(client, campaignId);
	if (!campaign) {
		return res.json({ success: false, message: 'Campaign not found' }, 404);
	}

	if (campaign.status !== CampaignStatus.RUNNING) {
		return res.json({ success: false, message: 'Campaign is not running' }, 400);
	}

	// Set status to PAUSED (the running loop will detect this)
	await updateCampaign(client, campaignId, {
		status: CampaignStatus.PAUSED,
		pausedAt: new Date().toISOString(),
	});

	await logInfo(client, EventType.CAMPAIGN_PAUSED, 'Campaign pause requested', { campaignId });

	return res.json({ success: true, message: 'Campaign pause requested' });
}

/**
 * Handle RESUME action
 */
async function handleResume(
	client: Client,
	config: OrchestratorConfig,
	campaignId: string | undefined,
	res: AppwriteContext['res']
): Promise<unknown> {
	if (!campaignId) {
		return res.json({ success: false, message: 'campaignId is required' }, 400);
	}

	const campaign = await getCampaignById(client, campaignId);
	if (!campaign) {
		return res.json({ success: false, message: 'Campaign not found' }, 404);
	}

	if (campaign.status !== CampaignStatus.PAUSED) {
		return res.json({ success: false, message: 'Campaign is not paused' }, 400);
	}

	await logInfo(client, EventType.CAMPAIGN_RESUMED, 'Campaign resumed', { campaignId });

	// Execute campaign (continues where it left off)
	const result = await executeCampaign(campaignId, config);

	return res.json({
		success: result.status === 'completed',
		message: result.message,
		data: {
			status: result.status,
			leadsProcessed: result.leadsProcessed,
			leadsSkipped: result.leadsSkipped,
			leadsErrored: result.leadsErrored,
		},
	});
}

/**
 * Handle ABORT action
 */
async function handleAbort(
	client: Client,
	campaignId: string | undefined,
	res: AppwriteContext['res']
): Promise<unknown> {
	if (!campaignId) {
		return res.json({ success: false, message: 'campaignId is required' }, 400);
	}

	const campaign = await getCampaignById(client, campaignId);
	if (!campaign) {
		return res.json({ success: false, message: 'Campaign not found' }, 404);
	}

	if (campaign.status === CampaignStatus.COMPLETED || campaign.status === CampaignStatus.ABORTED) {
		return res.json({ success: false, message: 'Campaign is already finished' }, 400);
	}

	// Set status to ABORTING (the running loop will detect this)
	await updateCampaign(client, campaignId, {
		status: CampaignStatus.ABORTING,
	});

	await logInfo(client, EventType.CAMPAIGN_ABORTING, 'Campaign abort requested', { campaignId });

	return res.json({ success: true, message: 'Campaign abort requested' });
}

/**
 * Handle RECOVER action (for system startup)
 */
async function handleRecover(
	client: Client,
	_config: OrchestratorConfig,
	res: AppwriteContext['res']
): Promise<unknown> {
	// Clean up stale locks
	const cleaned = await cleanupStaleLocks(client);

	// Find running campaigns
	const runningCampaigns = await getRunningCampaigns(client);

	await logInfo(
		client,
		EventType.SYSTEM_STARTUP,
		`System recovery: ${cleaned} stale locks cleaned, ${runningCampaigns.length} campaigns found`,
		{}
	);

	// Note: We don't auto-resume campaigns here. The frontend should
	// call resume for each campaign explicitly after recovery.

	return res.json({
		success: true,
		message: `Cleaned ${cleaned} stale locks, found ${runningCampaigns.length} campaigns`,
		data: {
			staleLocksCleaned: cleaned,
			runningCampaigns: runningCampaigns.map((c) => ({
				id: c.$id,
				name: c.name,
				status: c.status,
			})),
		},
	});
}
