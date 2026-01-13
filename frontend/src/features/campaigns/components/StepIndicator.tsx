/**
 * StepIndicator Component
 *
 * Horizontal wizard step indicator with completion states.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "current" | "completed";

interface Step {
	id: string;
	title: string;
}

interface StepIndicatorProps {
	steps: Step[];
	currentStep: number;
	className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
	const getStepStatus = (index: number): StepStatus => {
		if (index < currentStep) return "completed";
		if (index === currentStep) return "current";
		return "pending";
	};

	return (
		<div className={cn("flex items-center justify-between", className)}>
			{steps.map((step, index) => {
				const status = getStepStatus(index);
				const isLast = index === steps.length - 1;

				return (
					<div key={step.id} className="flex items-center flex-1">
						<div className="flex flex-col items-center">
							{/* Step circle */}
							<div
								className={cn(
									"flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-mono transition-colors",
									status === "completed" && "border-emerald-500 bg-emerald-500 text-white",
									status === "current" && "border-primary bg-primary text-primary-foreground",
									status === "pending" &&
										"border-muted-foreground/30 bg-muted text-muted-foreground"
								)}
							>
								{status === "completed" ? <Check className="h-4 w-4" /> : index + 1}
							</div>
							{/* Step title */}
							<span
								className={cn(
									"mt-2 text-xs font-medium text-center max-w-[80px] hidden sm:block",
									status === "current" && "text-foreground",
									status === "pending" && "text-muted-foreground",
									status === "completed" && "text-emerald-600 dark:text-emerald-400"
								)}
							>
								{step.title}
							</span>
						</div>
						{/* Connector line */}
						{!isLast && (
							<div
								className={cn(
									"flex-1 h-0.5 mx-2 transition-colors",
									index < currentStep ? "bg-emerald-500" : "bg-muted-foreground/30"
								)}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
