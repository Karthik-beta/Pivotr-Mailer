/**
 * LocalStack SES Email Viewer
 *
 * Fetches and displays emails captured by LocalStack SES in a formatted view.
 * Use this to inspect emails during local development.
 *
 * Usage:
 *   bun run tests/localstack/email-viewer.ts         # List all emails
 *   bun run tests/localstack/email-viewer.ts --watch # Watch for new emails
 *   bun run tests/localstack/email-viewer.ts --clear # Clear all emails
 */

const LOCALSTACK_ENDPOINT = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";

interface SESMessage {
	Id: string;
	Region: string;
	Destination: {
		ToAddresses: string[];
		CcAddresses?: string[];
		BccAddresses?: string[];
	};
	Source: string;
	Subject: string;
	Body: {
		text_part?: string;
		html_part?: string;
	};
	Timestamp: string;
}

interface SESResponse {
	messages: SESMessage[];
}

async function fetchEmails(): Promise<SESMessage[]> {
	try {
		const response = await fetch(`${LOCALSTACK_ENDPOINT}/_aws/ses`);
		if (!response.ok) {
			throw new Error(`Failed to fetch: ${response.status}`);
		}
		const data = (await response.json()) as SESResponse;
		return data.messages || [];
	} catch (error) {
		console.error("Failed to connect to LocalStack:", error);
		console.error("Make sure LocalStack is running: bun run localstack:up");
		process.exit(1);
	}
}

async function clearEmails(): Promise<void> {
	// LocalStack doesn't have a direct API to clear emails
	// But emails are cleared on container restart
	console.log("To clear emails, restart LocalStack:");
	console.log("  bun run localstack:down && bun run localstack:up");
}

function formatEmail(email: SESMessage, index: number): string {
	const divider = "═".repeat(80);
	const thinDivider = "─".repeat(80);

	const to = email.Destination.ToAddresses.join(", ");
	const cc = email.Destination.CcAddresses?.join(", ") || "";
	const timestamp = new Date(email.Timestamp).toLocaleString();

	let output = `
${divider}
  EMAIL #${index + 1}
${divider}
  From:      ${email.Source}
  To:        ${to}${cc ? `\n  CC:        ${cc}` : ""}
  Subject:   ${email.Subject}
  Sent:      ${timestamp}
  ID:        ${email.Id}
${thinDivider}`;

	if (email.Body.text_part) {
		output += `
  TEXT BODY:
${thinDivider}
${email.Body.text_part
	.split("\n")
	.map((line) => `  ${line}`)
	.join("\n")}
${thinDivider}`;
	}

	if (email.Body.html_part) {
		// Simple HTML to text conversion for preview
		const plainText = email.Body.html_part
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/p>/gi, "\n\n")
			.replace(/<[^>]+>/g, "")
			.replace(/&nbsp;/g, " ")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.trim();

		output += `
  HTML BODY (preview):
${thinDivider}
${plainText
	.split("\n")
	.map((line) => `  ${line}`)
	.join("\n")}
`;
	}

	return output;
}

async function displayEmails(): Promise<void> {
	const emails = await fetchEmails();

	console.clear();
	console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                    LOCALSTACK SES EMAIL VIEWER                               ║
║                                                                              ║
║  Endpoint: ${LOCALSTACK_ENDPOINT.padEnd(54)}         ║
║  Emails:   ${String(emails.length).padEnd(54)}         ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

	if (emails.length === 0) {
		console.log("\n  No emails captured yet.");
		console.log("  Send emails via your application and they will appear here.\n");
		return;
	}

	// Show most recent first
	const sortedEmails = [...emails].reverse();
	for (let i = 0; i < sortedEmails.length; i++) {
		console.log(formatEmail(sortedEmails[i], i));
	}
}

async function watchEmails(): Promise<void> {
	let lastCount = 0;

	console.log("Watching for new emails... (Ctrl+C to stop)\n");

	const poll = async () => {
		const emails = await fetchEmails();
		if (emails.length !== lastCount) {
			lastCount = emails.length;
			await displayEmails();
		}
	};

	// Initial display
	await displayEmails();

	// Poll every 2 seconds
	setInterval(poll, 2000);
}

// Main
const args = process.argv.slice(2);

if (args.includes("--clear")) {
	await clearEmails();
} else if (args.includes("--watch")) {
	await watchEmails();
} else {
	await displayEmails();
}
