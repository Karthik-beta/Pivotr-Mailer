/**
 * Campaign Validation Utilities
 *
 * Extracted validation logic to reduce cognitive complexity in CampaignWizard.
 */

import type { CampaignFormData } from "../components/CampaignWizard";

interface ValidationRule {
	field: string;
	validate: (data: CampaignFormData) => boolean;
	message: string;
}

/**
 * Validation rules for each wizard step
 */
const STEP_VALIDATORS: Record<number, ValidationRule[]> = {
	// Step 0: Basic Info
	0: [
		{
			field: "name",
			validate: (d) => !!d.name.trim(),
			message: "Campaign name is required",
		},
	],

	// Step 1: Template
	1: [
		{
			field: "template.subject",
			validate: (d) => !!d.template.subject.trim(),
			message: "Subject is required",
		},
		{
			field: "template.body",
			validate: (d) => !!d.template.body.trim(),
			message: "Email body is required",
		},
		{
			field: "template.senderName",
			validate: (d) => !!d.template.senderName.trim(),
			message: "Sender name is required",
		},
		{
			field: "template.senderEmail",
			validate: (d) => !!d.template.senderEmail.trim(),
			message: "Sender email is required",
		},
		{
			field: "template.senderEmail",
			validate: (d) =>
				!d.template.senderEmail.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.template.senderEmail),
			message: "Invalid email address",
		},
	],

	// Step 2: Schedule
	2: [
		{
			field: "schedule.scheduledDates",
			validate: (d) => d.schedule.scheduledDates.length > 0,
			message: "Select at least one date",
		},
	],

	// Step 3: Delay
	3: [
		{
			field: "delayConfig.minDelayMs",
			validate: (d) => d.delayConfig.minDelayMs < d.delayConfig.maxDelayMs,
			message: "Min delay must be less than max delay",
		},
	],

	// Step 4: Lead Selection
	4: [
		{
			field: "leadSelection.leadTypes",
			validate: (d) => d.leadSelection.leadTypes.length > 0,
			message: "Select at least one lead type",
		},
		{
			field: "leadSelection.statuses",
			validate: (d) => d.leadSelection.statuses.length > 0,
			message: "Select at least one status",
		},
	],

	// Step 5: Review (no validation needed)
};

/**
 * Validate a specific wizard step
 * @param step - The step number to validate
 * @param data - The form data to validate
 * @returns Record of field names to error messages
 */
export function validateCampaignStep(step: number, data: CampaignFormData): Record<string, string> {
	const rules = STEP_VALIDATORS[step] ?? [];
	const errors: Record<string, string> = {};

	for (const rule of rules) {
		if (!rule.validate(data)) {
			errors[rule.field] = rule.message;
		}
	}

	return errors;
}
