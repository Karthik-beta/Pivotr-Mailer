/**
 * CampaignWizard Component
 *
 * Multi-step wizard for creating and editing campaigns.
 * Reused for both /campaigns/new and /campaigns/$id/edit routes.
 */

import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, RefreshCw, Save } from "lucide-react";
import { useCallback, useState } from "react";
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
import type { Campaign, CreateCampaignRequest, LeadType, SignOffMedia } from "../types";
import { StepIndicator } from "./StepIndicator";
import { StepBasicInfo } from "./wizard-steps/StepBasicInfo";
import { StepDelay } from "./wizard-steps/StepDelay";
import { StepLeadSelection } from "./wizard-steps/StepLeadSelection";
import { StepReview } from "./wizard-steps/StepReview";
import { StepSchedule } from "./wizard-steps/StepSchedule";
import { StepTemplate } from "./wizard-steps/StepTemplate";

// Wizard steps configuration
const WIZARD_STEPS = [
	{ id: "basic", title: "Basic Info" },
	{ id: "template", title: "Template" },
	{ id: "schedule", title: "Schedule" },
	{ id: "delay", title: "Delay" },
	{ id: "leads", title: "Leads" },
	{ id: "review", title: "Review" },
];

// Social link type
interface SocialLink {
	platform: "linkedin" | "twitter" | "website" | "email" | "phone";
	url: string;
	label?: string;
}

// Form data interface
export interface CampaignFormData {
	name: string;
	description: string;
	template: {
		subject: string;
		body: string;
		senderName: string;
		senderEmail: string;
		ccEmail?: string;
		signOff?: {
			enabled: boolean;
			content: string;
			media?: SignOffMedia[];
			socialLinks?: SocialLink[];
		};
	};
	schedule: {
		workingHours: {
			startHour: number;
			startMinute: number;
			endHour: number;
			endMinute: number;
		};
		peakHours: {
			startHour: number;
			endHour: number;
			peakMultiplier: number;
		};
		timezone: string;
		scheduledDates: Date[];
		dailyLimit: number;
		batchSize: number;
	};
	delayConfig: {
		minDelayMs: number;
		maxDelayMs: number;
		gaussianEnabled: boolean;
	};
	leadSelection: {
		leadTypes: LeadType[];
		statuses: string[];
		maxLeads?: number;
	};
}

// Default form values
const getDefaultFormData = (): CampaignFormData => ({
	name: "",
	description: "",
	template: {
		subject: "",
		body: "",
		senderName: "",
		senderEmail: "",
		ccEmail: "",
		signOff: {
			enabled: false,
			content: "",
			media: [],
			socialLinks: [],
		},
	},
	schedule: {
		workingHours: {
			startHour: 9,
			startMinute: 0,
			endHour: 18,
			endMinute: 0,
		},
		peakHours: {
			startHour: 10,
			endHour: 14,
			peakMultiplier: 1.5,
		},
		timezone: "Asia/Kolkata",
		scheduledDates: [],
		dailyLimit: 500,
		batchSize: 50,
	},
	delayConfig: {
		minDelayMs: 30000,
		maxDelayMs: 180000,
		gaussianEnabled: true,
	},
	leadSelection: {
		leadTypes: [],
		statuses: [],
	},
});

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
		workingHours: campaign.schedule.workingHours,
		peakHours: campaign.schedule.peakHours,
		timezone: campaign.schedule.timezone,
		scheduledDates: campaign.schedule.scheduledDates.map((d) => new Date(d)),
		dailyLimit: campaign.schedule.dailyLimit,
		batchSize: campaign.schedule.batchSize,
	},
	delayConfig: campaign.delayConfig,
	leadSelection: campaign.leadSelection,
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
		workingHours: data.schedule.workingHours,
		peakHours: data.schedule.peakHours,
		timezone: data.schedule.timezone,
		scheduledDates: data.schedule.scheduledDates.map((d) => d.toISOString().split("T")[0]),
		dailyLimit: data.schedule.dailyLimit,
		batchSize: data.schedule.batchSize,
	},
	delayConfig: data.delayConfig,
	leadSelection: data.leadSelection,
});

interface CampaignWizardProps {
	campaign?: Campaign;
	mode: "create" | "edit";
}

export function CampaignWizard({ campaign, mode }: CampaignWizardProps) {
	const navigate = useNavigate();
	const createMutation = useCreateCampaign();
	const updateMutation = useUpdateCampaign();
	const previewMutation = usePreviewLeads();

	const [currentStep, setCurrentStep] = useState(0);
	const [formData, setFormData] = useState<CampaignFormData>(
		campaign ? campaignToFormData(campaign) : getDefaultFormData()
	);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Update form data
	const handleChange = useCallback((data: Partial<CampaignFormData>) => {
		setFormData((prev) => ({
			...prev,
			...data,
		}));
		// Clear errors for changed fields
		const errorKeys = Object.keys(data);
		setErrors((prev) => {
			const newErrors = { ...prev };
			errorKeys.forEach((key) => {
				delete newErrors[key];
			});
			return newErrors;
		});
	}, []);

	// Validate current step
	const validateStep = useCallback(
		(step: number): boolean => {
			const newErrors: Record<string, string> = {};

			switch (step) {
				case 0: // Basic Info
					if (!formData.name.trim()) {
						newErrors.name = "Campaign name is required";
					}
					break;
				case 1: // Template
					if (!formData.template.subject.trim()) {
						newErrors["template.subject"] = "Subject is required";
					}
					if (!formData.template.body.trim()) {
						newErrors["template.body"] = "Email body is required";
					}
					if (!formData.template.senderName.trim()) {
						newErrors["template.senderName"] = "Sender name is required";
					}
					if (!formData.template.senderEmail.trim()) {
						newErrors["template.senderEmail"] = "Sender email is required";
					} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.template.senderEmail)) {
						newErrors["template.senderEmail"] = "Invalid email address";
					}
					break;
				case 2: // Schedule
					if (formData.schedule.scheduledDates.length === 0) {
						newErrors["schedule.scheduledDates"] = "Select at least one date";
					}
					break;
				case 3: // Delay
					if (formData.delayConfig.minDelayMs >= formData.delayConfig.maxDelayMs) {
						newErrors["delayConfig.minDelayMs"] = "Min delay must be less than max delay";
					}
					break;
				case 4: // Lead Selection
					if (formData.leadSelection.leadTypes.length === 0) {
						newErrors["leadSelection.leadTypes"] = "Select at least one lead type";
					}
					if (formData.leadSelection.statuses.length === 0) {
						newErrors["leadSelection.statuses"] = "Select at least one status";
					}
					break;
			}

			setErrors(newErrors);
			return Object.keys(newErrors).length === 0;
		},
		[formData]
	);

	// Navigation handlers
	const handleNext = () => {
		if (validateStep(currentStep)) {
			setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
		}
	};

	const handleBack = () => {
		setCurrentStep((prev) => Math.max(prev - 1, 0));
	};

	// Submit handler
	const handleSubmit = async () => {
		if (!validateStep(currentStep)) {
			return;
		}

		try {
			const request = formDataToRequest(formData);

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
		}
	};

	// Get matching leads count for review step
	const matchingLeadsCount = previewMutation.data?.data?.count ?? 0;

	const isSubmitting = createMutation.isPending || updateMutation.isPending;

	// Render current step content
	const renderStepContent = () => {
		switch (currentStep) {
			case 0:
				return <StepBasicInfo data={formData} onChange={handleChange} errors={errors} />;
			case 1:
				return <StepTemplate data={formData} onChange={handleChange} errors={errors} />;
			case 2:
				return <StepSchedule data={formData} onChange={handleChange} errors={errors} />;
			case 3:
				return <StepDelay data={formData} onChange={handleChange} errors={errors} />;
			case 4:
				return <StepLeadSelection data={formData} onChange={handleChange} errors={errors} />;
			case 5:
				return <StepReview data={formData} matchingLeadsCount={matchingLeadsCount} />;
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
