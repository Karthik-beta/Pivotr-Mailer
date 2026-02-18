/**
 * Lead Form Schema
 *
 * Zod schema for validating lead form data.
 * Used by LeadFormDialog for both add and edit operations.
 */

import { z } from "zod";

export const leadFormSchema = z.object({
	fullName: z
		.string()
		.min(2, "Name must be at least 2 characters")
		.max(100, "Name must be less than 100 characters"),
	email: z
		.string()
		.email("Invalid email address")
		.max(255, "Email must be less than 255 characters"),
	companyName: z
		.string()
		.min(2, "Company name must be at least 2 characters")
		.max(100, "Company name must be less than 100 characters"),
	phoneNumber: z
		.string()
		.optional()
		.refine((val) => !val || val.length >= 7, "Phone number must be at least 7 characters"),
	leadType: z.enum(["HARDWARE", "SOFTWARE", "BOTH"]).optional().nullable(),
});

export type LeadFormData = z.infer<typeof leadFormSchema>;
