/**
 * Campaign Form Types
 *
 * Type definitions for TanStack Form integration.
 */

import type { FormAsyncValidateOrFn, FormValidateOrFn, useForm } from "@tanstack/react-form";
import type { CampaignFormData } from "../schemas/campaignSchema";

type CampaignSyncValidator = undefined | FormValidateOrFn<CampaignFormData>;
type CampaignAsyncValidator = undefined | FormAsyncValidateOrFn<CampaignFormData>;

// Type for the form instance passed to step components
export type CampaignForm = ReturnType<
	typeof useForm<
		CampaignFormData,
		CampaignSyncValidator,
		CampaignSyncValidator,
		CampaignAsyncValidator,
		CampaignSyncValidator,
		CampaignAsyncValidator,
		CampaignSyncValidator,
		CampaignAsyncValidator,
		CampaignSyncValidator,
		CampaignAsyncValidator,
		CampaignAsyncValidator,
		unknown
	>
>;

// Props interface for step components
export interface StepProps {
	form: CampaignForm;
}
