/**
 * Unsubscribe Lead Function — Main Entry Point
 *
 * This Appwrite Function handles unsubscribe link clicks.
 * When a user clicks the unsubscribe link in an email, this function:
 * 1. Validates the HMAC token
 * 2. Marks the lead as unsubscribed
 * 3. Returns a confirmation page
 *
 * URL Format:
 *   GET /v1/functions/{functionId}/executions?leadId={id}&token={hmac}
 */

import { Client } from 'node-appwrite';
import { EventType } from '../../../shared/constants/event.constants';
import { LeadStatus } from '../../../shared/constants/status.constants';

// Shared modules
import { getLeadById, updateLead } from '../../_shared/database/repositories/lead.repository';
import { logInfo, logWarn } from '../../_shared/database/repositories/log.repository';
import { getSettings } from '../../_shared/database/repositories/settings.repository';
import { verifyUnsubscribeToken } from '../../_shared/spintax/variable-injector';

/**
 * Appwrite Function context
 */
interface AppwriteContext {
	req: {
		query: Record<string, string>;
		headers: Record<string, string>;
		method: string;
	};
	res: {
		send: (data: string, statusCode?: number, headers?: Record<string, string>) => unknown;
		json: (data: unknown, statusCode?: number) => unknown;
	};
	log: (message: string) => void;
	error: (message: string) => void;
}

/**
 * Main entry point for the Unsubscribe Function.
 */
export default async function main(context: AppwriteContext): Promise<unknown> {
	const { req, res, log, error: logErr } = context;

	// Initialize Appwrite client
	const client = new Client()
		.setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '')
		.setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
		.setKey(process.env.APPWRITE_API_KEY || '');

	try {
		// Extract query parameters
		const leadId = req.query.leadId;
		const token = req.query.token;

		// Validate parameters
		if (!leadId || !token) {
			return res.send(generateErrorPage('Missing required parameters'), 400, {
				'Content-Type': 'text/html',
			});
		}

		// Get settings for token verification
		const settings = await getSettings(client);
		if (!settings) {
			logErr('Settings not found');
			return res.send(generateErrorPage('Service configuration error'), 500, {
				'Content-Type': 'text/html',
			});
		}

		// Verify token
		const isValid = verifyUnsubscribeToken(leadId, token, settings.unsubscribeTokenSecret);
		if (!isValid) {
			await logWarn(
				client,
				EventType.SYSTEM_ERROR,
				`Invalid unsubscribe token for lead ${leadId}`,
				{ leadId }
			);
			return res.send(generateErrorPage('Invalid or expired unsubscribe link'), 403, {
				'Content-Type': 'text/html',
			});
		}

		// Get lead
		const lead = await getLeadById(client, leadId);
		if (!lead) {
			return res.send(generateErrorPage('Lead not found'), 404, {
				'Content-Type': 'text/html',
			});
		}

		// Check if already unsubscribed
		if (lead.isUnsubscribed) {
			log(`Lead ${leadId} is already unsubscribed`);
			return res.send(generateSuccessPage(true), 200, {
				'Content-Type': 'text/html',
			});
		}

		// Mark as unsubscribed
		await updateLead(client, leadId, {
			isUnsubscribed: true,
			unsubscribedAt: new Date().toISOString(),
			status: LeadStatus.UNSUBSCRIBED,
		});

		await logInfo(client, EventType.LEAD_UNSUBSCRIBED, `Lead ${lead.email} unsubscribed`, {
			leadId,
			campaignId: lead.campaignId || undefined,
		});

		log(`Lead ${leadId} successfully unsubscribed`);

		return res.send(generateSuccessPage(false), 200, {
			'Content-Type': 'text/html',
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logErr(`Unsubscribe error: ${message}`);

		return res.send(generateErrorPage('An error occurred. Please try again later.'), 500, {
			'Content-Type': 'text/html',
		});
	}
}

/**
 * Generate a success confirmation page.
 */
function generateSuccessPage(alreadyUnsubscribed: boolean): string {
	const message = alreadyUnsubscribed
		? 'You have already been unsubscribed from our mailing list.'
		: 'You have been successfully unsubscribed from our mailing list.';

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: #333;
      margin: 0 0 1rem;
      font-size: 1.5rem;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✓</div>
    <h1>Unsubscribed</h1>
    <p>${message}</p>
    <p>You will no longer receive emails from us.</p>
  </div>
</body>
</html>`;
}

/**
 * Generate an error page.
 */
function generateErrorPage(message: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    .container {
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: #333;
      margin: 0 0 1rem;
      font-size: 1.5rem;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>Oops!</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
