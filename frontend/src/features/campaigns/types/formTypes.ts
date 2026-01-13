/**
 * Campaign Form Types
 *
 * Type definitions for TanStack Form integration.
 */

import type { FormApi } from "@tanstack/react-form";
import type { CampaignFormData } from "../schemas/campaignSchema";

// Type for the form instance passed to step components
export type CampaignForm = FormApi<CampaignFormData, undefined>;

// Props interface for step components
export interface StepProps {
	form: CampaignForm;
}
