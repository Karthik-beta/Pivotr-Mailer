/**
 * StepBasicInfo Component
 *
 * Step 1 of the campaign wizard - Basic campaign information.
 * Uses TanStack Form for declarative field binding.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StepProps } from "../../types/formTypes";

export function StepBasicInfo({ form }: StepProps) {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<form.Field name="name">
					{(field) => (
						<>
							<Label
								htmlFor={field.name}
								className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
							>
								Campaign Name *
							</Label>
							<Input
								id={field.name}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								placeholder="Q1 Hardware Outreach"
								className="font-medium"
							/>
							{field.state.meta.errors.length > 0 && (
								<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
							)}
						</>
					)}
				</form.Field>
			</div>

			<div className="space-y-2">
				<form.Field name="description">
					{(field) => (
						<>
							<Label
								htmlFor={field.name}
								className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
							>
								Description (Optional)
							</Label>
							<Textarea
								id={field.name}
								value={field.state.value ?? ""}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								placeholder="Campaign targeting hardware leads in Q1..."
								rows={3}
							/>
							{field.state.meta.errors.length > 0 && (
								<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
							)}
							<p className="text-xs text-muted-foreground">
								A brief description to help you identify this campaign later.
							</p>
						</>
					)}
				</form.Field>
			</div>
		</div>
	);
}
