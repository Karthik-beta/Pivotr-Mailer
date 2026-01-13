/**
 * CampaignWizard Component
 *
 * Multi-step wizard for creating and editing campaigns.
 * Uses TanStack Form for declarative form state and validation.
 * Uses TanStack Store for wizard step navigation.
 */

import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, RefreshCw, Save } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useCreateCampaign, usePreviewLeads, useUpdateCampaign } from "../hooks/useCampaigns";
import type { Campaign, CreateCampaignRequest } from "../types";
import {
	type CampaignFormData,
	getDefaultFormValues,
	stepSchemas,
} from "../schemas/campaignSchema";
import {
	WIZARD_STEPS,
	createWizardStore,
	wizardActions,
} from "../stores/wizardStore";
import { StepIndicator } from "./StepIndicator";
import { StepBasicInfo } from "./wizard-steps/StepBasicInfo";
import { StepDelay } from "./wizard-steps/StepDelay";
import { StepLeadSelection } from "./wizard-steps/StepLeadSelection";
import { StepReview } from "./wizard-steps/StepReview";
import { StepSchedule } from "./wizard-steps/StepSchedule";
import { StepTemplate } from "./wizard-steps/StepTemplate";

// Re-export types for backwards compatibility
export type { CampaignFormData } from "../schemas/campaignSchema";

// Helper to pad numbers
const pad = (num: number) => num.toString().padStart(2, "0");

// Convert Campaign to form data for editing
const campaignToFormData = (campaign: Campaign): CampaignFormData => ({
	name: campaign.name,
	description: campaign.description || "",
	template: {
		subject: campaign.template.subject,
		body: campaign.template.body,
		senderName: campaign.template.senderName,
		senderEmail: campaign.template.senderEmail,
		ccEmail: campaign.template.ccEmail || "",
		signOff: campaign.template.signOff || {
			enabled: false,
			content: "",
			media: [],
			socialLinks: [],
		},
	},
	schedule: {
		workingHours: {
			startHour: parseInt(campaign.schedule.workingHours.start.split(":")[0]),
			startMinute: parseInt(campaign.schedule.workingHours.start.split(":")[1]),
			endHour: parseInt(campaign.schedule.workingHours.end.split(":")[0]),
			endMinute: parseInt(campaign.schedule.workingHours.end.split(":")[1]),
		},
		peakHours: {
			startHour: parseInt(campaign.schedule.peakHours.start.split(":")[0]),
			endHour: parseInt(campaign.schedule.peakHours.end.split(":")[0]),
			peakMultiplier: 1.5,
		},
		timezone: campaign.schedule.timezone,
		scheduledDates: campaign.schedule.scheduledDates.map((d) => new Date(d)),
		dailyLimit: campaign.schedule.dailyLimit,
		batchSize: campaign.schedule.batchSize,
	},
	delayConfig: campaign.delayConfig,
	leadSelection: {
		...campaign.leadSelection,
		leadStatuses: campaign.leadSelection.leadStatuses,
	},
});

// Convert form data to API request
const formDataToRequest = (data: CampaignFormData): CreateCampaignRequest => ({
	name: data.name,
	description: data.description || undefined,
	template: {
		subject: data.template.subject,
		body: data.template.body,
		senderName: data.template.senderName,
		senderEmail: data.template.senderEmail,
		ccEmail: data.template.ccEmail || undefined,
		signOff: data.template.signOff?.enabled ? data.template.signOff : undefined,
	},
	schedule: {
		workingHours: {
			start: `${pad(data.schedule.workingHours.startHour)}:${pad(data.schedule.workingHours.startMinute)}`,
			end: `${pad(data.schedule.workingHours.endHour)}:${pad(data.schedule.workingHours.endMinute)}`,
		},
		peakHours: {
			start: `${pad(data.schedule.peakHours.startHour)}:00`,
			end: `${pad(data.schedule.peakHours.endHour)}:00`,
		},
		timezone: data.schedule.timezone,
		scheduledDates: data.schedule.scheduledDates.map((d) => d.toISOString().split("T")[0]),
		dailyLimit: data.schedule.dailyLimit,
		batchSize: data.schedule.batchSize,
	},
	delayConfig: data.delayConfig,
	leadSelection: {
		...data.leadSelection,
		leadStatuses: data.leadSelection.leadStatuses,
	},
});

// Step validation schemas mapped by index
const STEP_VALIDATORS = [
	stepSchemas.basic,
	stepSchemas.template,
	stepSchemas.schedule,
	stepSchemas.delayConfig,
	stepSchemas.leadSelection,
	null, // Review step has no validation
] as const;

interface CampaignWizardProps {
	campaign?: Campaign;
	mode: "create" | "edit";
}

export function CampaignWizard({ campaign, mode }: CampaignWizardProps) {
	const navigate = useNavigate();
	const createMutation = useCreateCampaign();
	const updateMutation = useUpdateCampaign();
	const previewMutation = usePreviewLeads();

	// Create wizard store for step navigation
	const wizardStore = useMemo(() => createWizardStore(), []);
	const currentStep = useStore(wizardStore, (state) => state.currentStep);
	const isSubmitting = useStore(wizardStore, (state) => state.isSubmitting);

	// Initialize TanStack Form
	const form = useForm({
		defaultValues: campaign ? campaignToFormData(campaign) : getDefaultFormValues(),
		onSubmit: async ({ value }) => {
			wizardActions.setSubmitting(wizardStore, true);
			try {
				const request = formDataToRequest(value);

				if (mode === "create") {
					const result = await createMutation.mutateAsync(request);
					toast.success("Campaign created successfully!");
					navigate({ to: "/campaigns/$id", params: { id: result.data.id } });
				} else if (campaign) {
					await updateMutation.mutateAsync({ id: campaign.id, data: request });
					toast.success("Campaign updated successfully!");
					navigate({ to: "/campaigns/$id", params: { id: campaign.id } });
				}
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to save campaign");
			} finally {
				wizardActions.setSubmitting(wizardStore, false);
			}
		},
	});

	// Validate current step before navigation
	const validateCurrentStep = async (): Promise<boolean> => {
		const schema = STEP_VALIDATORS[currentStep];
		if (!schema) return true; // Review step, no validation

		const formValues = form.state.values;

		// Get the relevant portion of form data for this step
		let dataToValidate: unknown;
		switch (currentStep) {
			case 0:
				dataToValidate = { name: formValues.name, description: formValues.description };
				break;
			case 1:
				dataToValidate = formValues.template;
				break;
			case 2:
				dataToValidate = formValues.schedule;
				break;
			case 3:
				dataToValidate = formValues.delayConfig;
				break;
			case 4:
				dataToValidate = formValues.leadSelection;
				break;
			default:
				return true;
		}

		const result = schema.safeParse(dataToValidate);
		if (!result.success) {
			// Set field errors on the form
			for (const issue of result.error.issues) {
				const path = issue.path.join(".");
				let fieldName: string;

				// Map the path to the full field name
				switch (currentStep) {
					case 0:
						fieldName = path;
						break;
					case 1:
						fieldName = path ? `template.${path}` : "template";
						break;
					case 2:
						fieldName = path ? `schedule.${path}` : "schedule";
						break;
					case 3:
						fieldName = path ? `delayConfig.${path}` : "delayConfig";
						break;
					case 4:
						fieldName = path ? `leadSelection.${path}` : "leadSelection";
						break;
					default:
						fieldName = path;
				}

				form.setFieldMeta(fieldName as keyof CampaignFormData, (prev) => ({
					...prev,
					errors: [...(prev.errors || []), issue.message],
					errorMap: { ...prev.errorMap, onChange: issue.message },
				}));
			}
			return false;
		}

		return true;
	};

	// Navigation handlers
	const handleNext = async () => {
		const isValid = await validateCurrentStep();
		if (isValid) {
			wizardActions.nextStep(wizardStore);
		}
	};

	const handleBack = () => {
		wizardActions.prevStep(wizardStore);
	};

	const handleSubmit = async () => {
		const isValid = await validateCurrentStep();
		if (isValid) {
			form.handleSubmit();
		}
	};

	// Get matching leads count for review step
	const matchingLeadsCount = previewMutation.data?.data?.count ?? 0;

	// Render current step content
	const renderStepContent = () => {
		switch (currentStep) {
			case 0:
				return <StepBasicInfo form={form} />;
			case 1:
				return <StepTemplate form={form} />;
			case 2:
				return <StepSchedule form={form} />;
			case 3:
				return <StepDelay form={form} />;
			case 4:
				return <StepLeadSelection form={form} />;
			case 5:
				return <StepReview form={form} matchingLeadsCount={matchingLeadsCount} />;
			default:
				return null;
		}
	};

	return (
		<div className="space-y-6">
			{/* Progress indicator */}
			<Card className="p-4">
				<StepIndicator steps={WIZARD_STEPS} currentStep={currentStep} />
			</Card>

			{/* Step content */}
			<Card>
				<CardHeader>
					<CardTitle>{WIZARD_STEPS[currentStep].title}</CardTitle>
					<CardDescription>
						Step {currentStep + 1} of {WIZARD_STEPS.length}
					</CardDescription>
				</CardHeader>
				<CardContent>{renderStepContent()}</CardContent>
				<CardFooter className="flex justify-between border-t pt-6">
					<Button
						variant="outline"
						onClick={handleBack}
						disabled={currentStep === 0 || isSubmitting}
					>
						<ChevronLeft className="mr-2 h-4 w-4" />
						Back
					</Button>
					<div className="flex gap-2">
						{currentStep === WIZARD_STEPS.length - 1 ? (
							<Button onClick={handleSubmit} disabled={isSubmitting}>
								{isSubmitting ? (
									<RefreshCw className="animate-spin mr-2 h-4 w-4" />
								) : (
									<Save className="mr-2 h-4 w-4" />
								)}
								{mode === "create" ? "Create Campaign" : "Save Changes"}
							</Button>
						) : (
							<Button onClick={handleNext} disabled={isSubmitting}>
								Next
								<ChevronRight className="ml-2 h-4 w-4" />
							</Button>
						)}
					</div>
				</CardFooter>
			</Card>
		</div>
	);
}
