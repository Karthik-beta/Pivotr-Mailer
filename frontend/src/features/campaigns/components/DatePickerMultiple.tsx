/**
 * DatePickerMultiple Component
 *
 * Multi-date picker using react-day-picker for scheduled campaign dates.
 */

import { format, isBefore, startOfDay } from "date-fns";
import { Calendar, X } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DatePickerMultipleProps {
	selectedDates: Date[];
	onDatesChange: (dates: Date[]) => void;
	minDate?: Date;
	maxDates?: number;
	className?: string;
}

export function DatePickerMultiple({
	selectedDates,
	onDatesChange,
	minDate = new Date(),
	maxDates = 30,
	className,
}: DatePickerMultipleProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleSelect = (dates: Date[] | undefined) => {
		if (!dates) {
			onDatesChange([]);
			return;
		}
		// Limit to maxDates
		const limitedDates = dates.slice(0, maxDates);
		onDatesChange(limitedDates);
	};

	const handleRemoveDate = (dateToRemove: Date) => {
		onDatesChange(
			selectedDates.filter(
				(date) => format(date, "yyyy-MM-dd") !== format(dateToRemove, "yyyy-MM-dd")
			)
		);
	};

	const disabledDays = (date: Date) => {
		return isBefore(startOfDay(date), startOfDay(minDate));
	};

	return (
		<div className={cn("space-y-3", className)}>
			{/* Selected dates display */}
			{selectedDates.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{selectedDates
						.sort((a, b) => a.getTime() - b.getTime())
						.map((date) => (
							<Badge
								key={format(date, "yyyy-MM-dd")}
								variant="secondary"
								className="font-mono text-xs flex items-center gap-1"
							>
								{format(date, "MMM d, yyyy")}
								<button
									type="button"
									onClick={() => handleRemoveDate(date)}
									className="ml-1 hover:text-destructive transition-colors"
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						))}
				</div>
			)}

			{/* Toggle button */}
			<Button
				type="button"
				variant="outline"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full justify-start"
			>
				<Calendar className="mr-2 h-4 w-4" />
				{selectedDates.length === 0
					? "Select dates"
					: `${selectedDates.length} date${selectedDates.length > 1 ? "s" : ""} selected`}
			</Button>

			{/* Calendar */}
			{isOpen && (
				<Card className="p-4 w-fit">
					<DayPicker
						mode="multiple"
						selected={selectedDates}
						onSelect={handleSelect}
						disabled={disabledDays}
						numberOfMonths={2}
						showOutsideDays={false}
						classNames={{
							months: "flex flex-col sm:flex-row gap-4",
							month: "space-y-4",
							caption: "flex justify-center pt-1 relative items-center",
							caption_label: "text-sm font-medium",
							nav: "space-x-1 flex items-center",
							nav_button:
								"h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input",
							nav_button_previous: "absolute left-1",
							nav_button_next: "absolute right-1",
							table: "w-full border-collapse space-y-1",
							head_row: "flex",
							head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
							row: "flex w-full mt-2",
							cell: "h-9 w-9 text-center text-sm p-0 relative",
							day: "h-9 w-9 p-0 font-normal rounded-md hover:bg-accent hover:text-accent-foreground transition-colors inline-flex items-center justify-center",
							day_selected:
								"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
							day_today: "bg-accent text-accent-foreground",
							day_outside: "opacity-50",
							day_disabled: "opacity-50 cursor-not-allowed",
							day_hidden: "invisible",
						}}
					/>
					<div className="mt-4 flex justify-between items-center border-t pt-4">
						<p className="text-xs text-muted-foreground">
							{selectedDates.length} / {maxDates} dates selected
						</p>
						<Button size="sm" variant="outline" onClick={() => setIsOpen(false)}>
							Done
						</Button>
					</div>
				</Card>
			)}
		</div>
	);
}
