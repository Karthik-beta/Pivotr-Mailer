/**
 * StepSchedule Component
 *
 * Step 3 of the campaign wizard - Schedule configuration.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { CampaignFormData } from "../CampaignWizard";
import { DatePickerMultiple } from "../DatePickerMultiple";

interface StepScheduleProps {
	data: CampaignFormData;
	onChange: (data: Partial<CampaignFormData>) => void;
	errors: Record<string, string>;
}

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

export function StepSchedule({ data, onChange, errors }: StepScheduleProps) {
	const updateSchedule = (field: string, value: unknown) => {
		onChange({
			schedule: {
				...data.schedule,
				[field]: value,
			},
		});
	};

	const updateWorkingHours = (
		field: "startHour" | "startMinute" | "endHour" | "endMinute",
		value: number
	) => {
		onChange({
			schedule: {
				...data.schedule,
				workingHours: {
					...data.schedule.workingHours,
					[field]: value,
				},
			},
		});
	};

	const updatePeakHours = (field: "startHour" | "endHour", value: number) => {
		onChange({
			schedule: {
				...data.schedule,
				peakHours: {
					...data.schedule.peakHours,
					[field]: value,
				},
			},
		});
	};

	// Convert hour:minute to time string
	const getTimeString = (hour: number, minute: number): string => {
		return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
	};

	// Parse time string to hour/minute
	const parseTimeString = (time: string): { hour: number; minute: number } => {
		const [h, m] = time.split(":").map(Number);
		return { hour: h, minute: m };
	};

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
								data.schedule.workingHours.startHour,
								data.schedule.workingHours.startMinute
							)}
							onValueChange={(value) => {
								const { hour, minute } = parseTimeString(value);
								updateWorkingHours("startHour", hour);
								updateWorkingHours("startMinute", minute);
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
								data.schedule.workingHours.endHour,
								data.schedule.workingHours.endMinute
							)}
							onValueChange={(value) => {
								const { hour, minute } = parseTimeString(value);
								updateWorkingHours("endHour", hour);
								updateWorkingHours("endMinute", minute);
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
						<Select
							value={data.schedule.peakHours.startHour.toString()}
							onValueChange={(value) => updatePeakHours("startHour", parseInt(value, 10))}
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
					</div>
					<div className="space-y-2">
						<Label htmlFor="peakEnd" className="text-sm">
							End Hour
						</Label>
						<Select
							value={data.schedule.peakHours.endHour.toString()}
							onValueChange={(value) => updatePeakHours("endHour", parseInt(value, 10))}
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
					</div>
				</div>
				<p className="text-xs text-muted-foreground">
					During peak hours, emails are sent at a higher rate.
				</p>
			</div>

			{/* Timezone */}
			<div className="space-y-2">
				<Label
					htmlFor="timezone"
					className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
				>
					Timezone
				</Label>
				<Select
					value={data.schedule.timezone}
					onValueChange={(value) => updateSchedule("timezone", value)}
				>
					<SelectTrigger id="timezone">
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
			</div>

			{/* Scheduled Dates */}
			<div className="space-y-2">
				<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
					Scheduled Dates *
				</Label>
				<DatePickerMultiple
					selectedDates={data.schedule.scheduledDates}
					onDatesChange={(dates) => updateSchedule("scheduledDates", dates)}
					minDate={new Date()}
					maxDates={30}
				/>
				{errors["schedule.scheduledDates"] && (
					<p className="text-sm text-destructive">{errors["schedule.scheduledDates"]}</p>
				)}
				<p className="text-xs text-muted-foreground">
					Select the dates when the campaign should run. Business days recommended.
				</p>
			</div>

			{/* Volume Controls */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label
						htmlFor="dailyLimit"
						className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
					>
						Daily Limit
					</Label>
					<Input
						id="dailyLimit"
						type="number"
						min={1}
						max={10000}
						value={data.schedule.dailyLimit}
						onChange={(e) => updateSchedule("dailyLimit", parseInt(e.target.value, 10) || 500)}
					/>
					<p className="text-xs text-muted-foreground">Max emails per day</p>
				</div>
				<div className="space-y-2">
					<Label
						htmlFor="batchSize"
						className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
					>
						Batch Size
					</Label>
					<Input
						id="batchSize"
						type="number"
						min={1}
						max={100}
						value={data.schedule.batchSize}
						onChange={(e) => updateSchedule("batchSize", parseInt(e.target.value, 10) || 50)}
					/>
					<p className="text-xs text-muted-foreground">Emails per processing cycle</p>
				</div>
			</div>
		</div>
	);
}
