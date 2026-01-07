import { LeadType } from "@shared/constants/status.constants";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { useCreateLead } from "../hooks/use-leads";

interface AddLeadDialogProps {
	trigger?: React.ReactNode;
	onSuccess?: () => void;
}

export function AddLeadDialog({ trigger, onSuccess }: AddLeadDialogProps) {
	const [open, setOpen] = useState(false);
	const createLead = useCreateLead();

	const [formData, setFormData] = useState({
		fullName: "",
		email: "",
		companyName: "",
		phoneNumber: "",
		leadType: "" as "" | "HARDWARE" | "SOFTWARE" | "BOTH",
	});

	const [errors, setErrors] = useState<Record<string, string>>({});

	const validateForm = () => {
		const newErrors: Record<string, string> = {};

		if (!formData.fullName.trim()) {
			newErrors.fullName = "Full name is required";
		}

		if (!formData.email.trim()) {
			newErrors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			newErrors.email = "Please enter a valid email";
		}

		if (!formData.companyName.trim()) {
			newErrors.companyName = "Company name is required";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) return;

		try {
			await createLead.mutateAsync({
				fullName: formData.fullName.trim(),
				email: formData.email.trim().toLowerCase(),
				companyName: formData.companyName.trim(),
				phoneNumber: formData.phoneNumber.trim() || null,
				leadType: formData.leadType || null,
			});

			// Reset form and close dialog
			setFormData({
				fullName: "",
				email: "",
				companyName: "",
				phoneNumber: "",
				leadType: "",
			});
			setErrors({});
			setOpen(false);
			onSuccess?.();
		} catch {
			// Error is handled by the mutation
		}
	};

	const handleClose = () => {
		setOpen(false);
		setFormData({
			fullName: "",
			email: "",
			companyName: "",
			phoneNumber: "",
			leadType: "",
		});
		setErrors({});
	};

	return (
		<Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
			<DialogTrigger asChild>
				{trigger || (
					<Button className="gap-2">
						<Plus className="h-4 w-4" />
						Add Lead
					</Button>
				)}
			</DialogTrigger>

			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<UserPlus className="h-5 w-5 text-primary" />
						Add New Lead
					</DialogTitle>
					<DialogDescription>
						Enter the lead details below. Required fields are marked with *.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="fullName">
							Full Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="fullName"
							placeholder="John Doe"
							value={formData.fullName}
							onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
							className={errors.fullName ? "border-destructive" : ""}
						/>
						{errors.fullName && (
							<p className="text-xs text-destructive">{errors.fullName}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="email">
							Email <span className="text-destructive">*</span>
						</Label>
						<Input
							id="email"
							type="email"
							placeholder="john@company.com"
							value={formData.email}
							onChange={(e) => setFormData({ ...formData, email: e.target.value })}
							className={errors.email ? "border-destructive" : ""}
						/>
						{errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
					</div>

					<div className="space-y-2">
						<Label htmlFor="companyName">
							Company Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="companyName"
							placeholder="Acme Inc."
							value={formData.companyName}
							onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
							className={errors.companyName ? "border-destructive" : ""}
						/>
						{errors.companyName && (
							<p className="text-xs text-destructive">{errors.companyName}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="phoneNumber">Phone Number</Label>
						<Input
							id="phoneNumber"
							type="tel"
							placeholder="+91 98765 43210"
							value={formData.phoneNumber}
							onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="leadType">Lead Type</Label>
						<Select
							value={formData.leadType}
							onValueChange={(value) =>
								setFormData({ ...formData, leadType: value as typeof formData.leadType })
							}
						>
							<SelectTrigger id="leadType">
								<SelectValue placeholder="Select type (optional)" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={LeadType.HARDWARE}>Hardware</SelectItem>
								<SelectItem value={LeadType.SOFTWARE}>Software</SelectItem>
								<SelectItem value={LeadType.BOTH}>Both</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<DialogFooter className="pt-4">
						<Button type="button" variant="outline" onClick={handleClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={createLead.isPending} className="gap-2">
							{createLead.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
							{createLead.isPending ? "Adding..." : "Add Lead"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
