/**
 * LeadFormDialog Component
 *
 * Unified dialog for adding and editing individual leads.
 * Uses controlled form state with Zod validation.
 */

import { Loader2, UserPlus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCreateLead, useUpdateLead } from "../hooks/useLeads";
import { type LeadFormData, leadFormSchema } from "../schemas/leadSchema";
import type { Lead, LeadType } from "../types";

interface LeadFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "add" | "edit";
	lead?: Lead | null;
	onSuccess?: () => void;
}

const LEAD_TYPES: { value: LeadType; label: string }[] = [
	{ value: "HARDWARE", label: "Hardware" },
	{ value: "SOFTWARE", label: "Software" },
	{ value: "BOTH", label: "Both" },
];

const isLeadType = (value: string): value is LeadType =>
	LEAD_TYPES.some((leadType) => leadType.value === value);

// Default form values
const getDefaultFormValues = (): LeadFormData => ({
	fullName: "",
	email: "",
	companyName: "",
	phoneNumber: "",
	leadType: undefined,
});

// Convert Lead to form data for editing
const leadToFormData = (lead: Lead): LeadFormData => ({
	fullName: lead.fullName,
	email: lead.email,
	companyName: lead.companyName,
	phoneNumber: lead.phoneNumber || "",
	leadType: lead.leadType || undefined,
});

const toLeadPayload = (formData: LeadFormData) => ({
	fullName: formData.fullName,
	email: formData.email,
	companyName: formData.companyName,
	phoneNumber: formData.phoneNumber || undefined,
	leadType: formData.leadType || undefined,
});

// Validation helper
const validateField = (
	schema:
		| typeof leadFormSchema.shape.fullName
		| typeof leadFormSchema.shape.email
		| typeof leadFormSchema.shape.companyName,
	value: string
): string | undefined => {
	const result = schema.safeParse(value);
	if (result.success) return undefined;
	return result.error.issues[0]?.message;
};

export function LeadFormDialog({ open, onOpenChange, mode, lead, onSuccess }: LeadFormDialogProps) {
	const createMutation = useCreateLead();
	const updateMutation = useUpdateLead();
	const formIdPrefix = useId();
	const fullNameId = `${formIdPrefix}-full-name`;
	const emailId = `${formIdPrefix}-email`;
	const companyNameId = `${formIdPrefix}-company-name`;
	const phoneNumberId = `${formIdPrefix}-phone-number`;
	const leadTypeId = `${formIdPrefix}-lead-type`;

	const isEditing = mode === "edit" && lead;
	const isPending = createMutation.isPending || updateMutation.isPending;

	// Form state
	const [formData, setFormData] = useState<LeadFormData>(getDefaultFormValues());
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Reset form when dialog opens/closes or lead changes
	useEffect(() => {
		if (open) {
			if (isEditing && lead) {
				setFormData(leadToFormData(lead));
			} else {
				setFormData(getDefaultFormValues());
			}
			setErrors({});
		}
	}, [open, isEditing, lead]);

	// Field change handler
	const updateField = (field: keyof LeadFormData, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear error when user types
		if (errors[field]) {
			setErrors((prev) => {
				const next = { ...prev };
				delete next[field];
				return next;
			});
		}
	};

	// Validate all fields
	const validateForm = (): boolean => {
		const newErrors: Record<string, string> = {};

		const fullNameError = validateField(leadFormSchema.shape.fullName, formData.fullName);
		if (fullNameError) newErrors.fullName = fullNameError;

		const emailError = validateField(leadFormSchema.shape.email, formData.email);
		if (emailError) newErrors.email = emailError;

		const companyError = validateField(leadFormSchema.shape.companyName, formData.companyName);
		if (companyError) newErrors.companyName = companyError;

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Form submission
	const submitLead = async (): Promise<"updated" | "added"> => {
		const payload = toLeadPayload(formData);

		if (isEditing && lead) {
			await updateMutation.mutateAsync({ id: lead.id, data: payload });
			return "updated";
		}

		await createMutation.mutateAsync(payload);
		return "added";
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) return;

		try {
			const action = await submitLead();
			toast.success(action === "updated" ? "Lead updated successfully" : "Lead added successfully");
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : `Failed to ${isEditing ? "update" : "add"} lead`
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<UserPlus className="h-5 w-5" />
						{isEditing ? "Edit Lead" : "Add New Lead"}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update the lead's information below."
							: "Enter the details for the new lead."}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Full Name Field */}
					<div className="space-y-2">
						<Label htmlFor={fullNameId}>
							Full Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id={fullNameId}
							placeholder="Rahul Sharma"
							value={formData.fullName}
							onChange={(e) => updateField("fullName", e.target.value)}
							className={errors.fullName ? "border-destructive" : ""}
						/>
						{errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
					</div>

					{/* Email Field */}
					<div className="space-y-2">
						<Label htmlFor={emailId}>
							Email <span className="text-destructive">*</span>
						</Label>
						<Input
							id={emailId}
							type="email"
							placeholder="rahul.sharma@example.in"
							value={formData.email}
							onChange={(e) => updateField("email", e.target.value)}
							className={errors.email ? "border-destructive" : ""}
						/>
						{errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
					</div>

					{/* Company Name Field */}
					<div className="space-y-2">
						<Label htmlFor={companyNameId}>
							Company Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id={companyNameId}
							placeholder="Tech India Pvt Ltd"
							value={formData.companyName}
							onChange={(e) => updateField("companyName", e.target.value)}
							className={errors.companyName ? "border-destructive" : ""}
						/>
						{errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
					</div>

					{/* Phone Number Field */}
					<div className="space-y-2">
						<Label htmlFor={phoneNumberId}>Phone Number</Label>
						<Input
							id={phoneNumberId}
							type="tel"
							placeholder="+91 98765 43210"
							value={formData.phoneNumber || ""}
							onChange={(e) => updateField("phoneNumber", e.target.value)}
						/>
					</div>

					{/* Lead Type Field */}
					<div className="space-y-2">
						<Label htmlFor={leadTypeId}>Lead Type</Label>
						<Select
							value={formData.leadType || ""}
							onValueChange={(value) => {
								if (isLeadType(value)) {
									updateField("leadType", value);
								}
							}}
						>
							<SelectTrigger id={leadTypeId}>
								<SelectValue placeholder="Select type..." />
							</SelectTrigger>
							<SelectContent>
								{LEAD_TYPES.map(({ value, label }) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<DialogFooter className="justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{isEditing ? "Save Changes" : "Add Lead"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
