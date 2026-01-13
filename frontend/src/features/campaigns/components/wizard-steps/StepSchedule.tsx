/**
 * StepSchedule Component
 *
 * Step 3 of the campaign wizard - Schedule configuration.
 * Uses TanStack Form for declarative field binding.
 */

import { useStore } from "@tanstack/react-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { StepProps } from "../../types/formTypes";
import { DatePickerMultiple } from "../DatePickerMultiple";

// Generate time options in 30-minute increments
function generateTimeOptions(): string[] {
	const options: string[] = [];
	for (let hour = 0; hour < 24; hour++) {
		for (let minute = 0; minute < 60; minute += 30) {
			const h = hour.toString().padStart(2, "0");
			const m = minute.toString().padStart(2, "0");
			options.push(`${h}:${m}`);
		}
	}
	return options;
}

const TIME_OPTIONS = generateTimeOptions();

const TIMEZONE_OPTIONS = [
	{ value: "Asia/Kolkata", label: "India (IST)" },
	{ value: "America/New_York", label: "Eastern Time (ET)" },
	{ value: "America/Chicago", label: "Central Time (CT)" },
	{ value: "America/Denver", label: "Mountain Time (MT)" },
	{ value: "America/Los_Angeles", label: "Pacific Time (PT)" },
	{ value: "Europe/London", label: "London (GMT)" },
	{ value: "Europe/Paris", label: "Paris (CET)" },
	{ value: "Asia/Dubai", label: "Dubai (GST)" },
	{ value: "Asia/Singapore", label: "Singapore (SGT)" },
	{ value: "Australia/Sydney", label: "Sydney (AEST)" },
];

// Convert hour:minute to time string
const getTimeString = (hour: number, minute: number): string => {
	return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

// Parse time string to hour/minute
const parseTimeString = (time: string): { hour: number; minute: number } => {
	const [h, m] = time.split(":").map(Number);
	return { hour: h, minute: m };
};

export function StepSchedule({ form }: StepProps) {
	// Subscribe to schedule values for display
	const scheduleValues = useStore(form.store, (state) => state.values.schedule);

	return (
		<div className="space-y-6">
			{/* Working Hours */}
			<div className="space-y-3">
				<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
					Working Hours
				</Label>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="workingStart" className="text-sm">
							Start Time
						</Label>
						<Select
							value={getTimeString(
								scheduleValues.workingHours.startHour,
								scheduleValues.workingHours.startMinute
							)}
							onValueChange={(value) => {
								const { hour, minute } = parseTimeString(value);
								form.setFieldValue("schedule.workingHours.startHour", hour);
								form.setFieldValue("schedule.workingHours.startMinute", minute);
							}}
						>
							<SelectTrigger id="workingStart">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIME_OPTIONS.map((time) => (
									<SelectItem key={time} value={time}>
										{time}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="workingEnd" className="text-sm">
							End Time
						</Label>
						<Select
							value={getTimeString(
								scheduleValues.workingHours.endHour,
								scheduleValues.workingHours.endMinute
							)}
							onValueChange={(value) => {
								const { hour, minute } = parseTimeString(value);
								form.setFieldValue("schedule.workingHours.endHour", hour);
								form.setFieldValue("schedule.workingHours.endMinute", minute);
							}}
						>
							<SelectTrigger id="workingEnd">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIME_OPTIONS.map((time) => (
									<SelectItem key={time} value={time}>
										{time}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<p className="text-xs text-muted-foreground">
					Emails will only be sent during these hours.
				</p>
			</div>

			{/* Peak Hours */}
			<div className="space-y-3">
				<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
					Peak Hours (Higher Send Rate)
				</Label>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="peakStart" className="text-sm">
							Start Hour
						</Label>
						<form.Field name="schedule.peakHours.startHour">
							{(field) => (
								<Select
									value={field.state.value.toString()}
									onValueChange={(value) => field.handleChange(parseInt(value, 10))}
								>
									<SelectTrigger id="peakStart">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Array.from({ length: 24 }, (_, i) => (
											<SelectItem key={i} value={i.toString()}>
												{i.toString().padStart(2, "0")}:00
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</form.Field>
					</div>
					<div className="space-y-2">
						<Label htmlFor="peakEnd" className="text-sm">
							End Hour
						</Label>
						<form.Field name="schedule.peakHours.endHour">
							{(field) => (
								<Select
									value={field.state.value.toString()}
									onValueChange={(value) => field.handleChange(parseInt(value, 10))}
								>
									<SelectTrigger id="peakEnd">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Array.from({ length: 24 }, (_, i) => (
											<SelectItem key={i} value={i.toString()}>
												{i.toString().padStart(2, "0")}:00
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</form.Field>
					</div>
				</div>
				<p className="text-xs text-muted-foreground">
					During peak hours, emails are sent at a higher rate.
				</p>
			</div>

			{/* Timezone */}
			<div className="space-y-2">
				<form.Field name="schedule.timezone">
					{(field) => (
						<>
							<Label
								htmlFor={field.name}
								className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
							>
								Timezone
							</Label>
							<Select value={field.state.value} onValueChange={field.handleChange}>
								<SelectTrigger id={field.name}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TIMEZONE_OPTIONS.map((tz) => (
										<SelectItem key={tz.value} value={tz.value}>
											{tz.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</>
					)}
				</form.Field>
			</div>

			{/* Scheduled Dates */}
			<div className="space-y-2">
				<form.Field name="schedule.scheduledDates">
					{(field) => (
						<>
							<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
								Scheduled Dates *
							</Label>
							<DatePickerMultiple
								selectedDates={field.state.value}
								onDatesChange={field.handleChange}
								minDate={new Date()}
								maxDates={30}
							/>
							{field.state.meta.errors.length > 0 && (
								<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
							)}
							<p className="text-xs text-muted-foreground">
								Select the dates when the campaign should run. Business days recommended.
							</p>
						</>
					)}
				</form.Field>
			</div>

			{/* Volume Controls */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<form.Field name="schedule.dailyLimit">
						{(field) => (
							<>
								<Label
									htmlFor={field.name}
									className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
								>
									Daily Limit
								</Label>
								<Input
									id={field.name}
									type="number"
									min={1}
									max={10000}
									value={field.state.value}
									onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 500)}
									onBlur={field.handleBlur}
								/>
								<p className="text-xs text-muted-foreground">Max emails per day</p>
							</>
						)}
					</form.Field>
				</div>
				<div className="space-y-2">
					<form.Field name="schedule.batchSize">
						{(field) => (
							<>
								<Label
									htmlFor={field.name}
									className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
								>
									Batch Size
								</Label>
								<Input
									id={field.name}
									type="number"
									min={1}
									max={100}
									value={field.state.value}
									onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 50)}
									onBlur={field.handleBlur}
								/>
								<p className="text-xs text-muted-foreground">Emails per processing cycle</p>
							</>
						)}
					</form.Field>
				</div>
			</div>
		</div>
	);
}
