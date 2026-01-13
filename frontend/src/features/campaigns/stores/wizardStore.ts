/**
 * Campaign Wizard Store
 *
 * TanStack Store for managing wizard step state.
 * Replaces useState for step navigation.
 */

import { Store } from "@tanstack/react-store";

// Wizard steps configuration
export const WIZARD_STEPS = [
	{ id: "basic", title: "Basic Info" },
	{ id: "template", title: "Template" },
	{ id: "schedule", title: "Schedule" },
	{ id: "delay", title: "Delay" },
	{ id: "leads", title: "Leads" },
	{ id: "review", title: "Review" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

interface WizardState {
	currentStep: number;
	visitedSteps: Set<number>;
	isSubmitting: boolean;
}

// Create the wizard store
export const createWizardStore = () => {
	return new Store<WizardState>({
		currentStep: 0,
		visitedSteps: new Set([0]),
		isSubmitting: false,
	});
};

// Helper functions for wizard navigation
export const wizardActions = {
	goToStep: (store: Store<WizardState>, step: number) => {
		if (step >= 0 && step < WIZARD_STEPS.length) {
			store.setState((state) => ({
				...state,
				currentStep: step,
				visitedSteps: new Set([...state.visitedSteps, step]),
			}));
		}
	},

	nextStep: (store: Store<WizardState>) => {
		store.setState((state) => {
			const nextStep = Math.min(state.currentStep + 1, WIZARD_STEPS.length - 1);
			return {
				...state,
				currentStep: nextStep,
				visitedSteps: new Set([...state.visitedSteps, nextStep]),
			};
		});
	},

	prevStep: (store: Store<WizardState>) => {
		store.setState((state) => ({
			...state,
			currentStep: Math.max(state.currentStep - 1, 0),
		}));
	},

	setSubmitting: (store: Store<WizardState>, isSubmitting: boolean) => {
		store.setState((state) => ({
			...state,
			isSubmitting,
		}));
	},

	reset: (store: Store<WizardState>) => {
		store.setState(() => ({
			currentStep: 0,
			visitedSteps: new Set([0]),
			isSubmitting: false,
		}));
	},
};
