/**
 * Gaussian Distribution Utilities
 *
 * Implements human-like email sending patterns using Gaussian (normal) distribution.
 * Two main behaviors:
 * 1. Time-of-Day Volume: More emails during peak hours, fewer at edges
 * 2. Inter-Email Delays: Variable gaps between emails following bell curve
 *
 * @see https://en.wikipedia.org/wiki/Normal_distribution
 * @see https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
 */

// =============================================================================
// Types
// =============================================================================

export interface TimeWindow {
	/** Start time in HH:MM format */
	start: string;
	/** End time in HH:MM format */
	end: string;
}

export interface GaussianConfig {
	/** Working hours window */
	workingHours: TimeWindow;
	/** Peak hours for maximum send volume */
	peakHours: TimeWindow;
	/** Timezone (IANA format) */
	timezone: string;
	/** Minimum delay between emails (ms) */
	minDelayMs: number;
	/** Maximum delay between emails (ms) */
	maxDelayMs: number;
	/** Custom mean for delay distribution (optional) */
	gaussianMean?: number;
	/** Custom standard deviation (optional) */
	gaussianStdDev?: number;
	/** Daily send limit */
	dailyLimit: number;
}

export interface SlotVolumeResult {
	/** Number of emails to send in this slot */
	volume: number;
	/** Whether we're in working hours */
	inWorkingHours: boolean;
	/** Whether we're in peak hours */
	inPeakHours: boolean;
	/** Current probability factor (0-1) */
	probability: number;
	/** Minutes until working hours start (0 if already in) */
	minutesUntilWorkStart: number;
}

// =============================================================================
// Core Gaussian Functions
// =============================================================================

/**
 * Box-Muller transform to generate normally distributed random numbers.
 * Generates a random number from standard normal distribution (mean=0, stdDev=1).
 *
 * @returns Random number from standard normal distribution
 * @see https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
 */
export function boxMullerRandom(): number {
	let u = 0;
	let v = 0;

	// Avoid log(0)
	while (u === 0) u = Math.random();
	while (v === 0) v = Math.random();

	// Box-Muller transform
	const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

	return z;
}

/**
 * Gaussian Probability Density Function (PDF).
 * Calculates the probability density at point x for a normal distribution.
 *
 * @param x - Point to evaluate
 * @param mean - Mean of the distribution
 * @param stdDev - Standard deviation
 * @returns Probability density at x
 */
export function gaussianPDF(x: number, mean: number = 0, stdDev: number = 1): number {
	const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
	const exponent = -0.5 * ((x - mean) / stdDev) ** 2;
	return coefficient * Math.exp(exponent);
}

/**
 * Generates a random delay following Gaussian distribution.
 * Uses Box-Muller transform to generate delays that cluster around the mean,
 * simulating human-like variable timing.
 *
 * @param minMs - Minimum delay in milliseconds
 * @param maxMs - Maximum delay in milliseconds
 * @param customMean - Optional custom mean (defaults to midpoint)
 * @param customStdDev - Optional custom standard deviation
 * @returns Delay in milliseconds following Gaussian distribution
 */
export function getGaussianDelay(
	minMs: number,
	maxMs: number,
	customMean?: number,
	customStdDev?: number
): number {
	// Calculate mean (center of range) and stdDev (spread)
	const mean = customMean ?? (minMs + maxMs) / 2;

	// Standard deviation: range covers ~99.7% of values (6 sigma)
	const stdDev = customStdDev ?? (maxMs - minMs) / 6;

	// Generate normally distributed random value
	const z = boxMullerRandom();

	// Transform to our range
	let delay = mean + z * stdDev;

	// Clamp to hard limits (safety)
	delay = Math.max(minMs, Math.min(maxMs, delay));

	return Math.round(delay);
}

/**
 * Generates multiple Gaussian delays for a batch of emails.
 * Ensures delays are ordered (earliest first) for queue scheduling.
 *
 * @param count - Number of delays to generate
 * @param minMs - Minimum delay
 * @param maxMs - Maximum delay
 * @param customMean - Optional custom mean
 * @param customStdDev - Optional custom standard deviation
 * @returns Array of delays in milliseconds, sorted ascending
 */
export function getGaussianDelayBatch(
	count: number,
	minMs: number,
	maxMs: number,
	customMean?: number,
	customStdDev?: number
): number[] {
	const delays: number[] = [];

	for (let i = 0; i < count; i++) {
		delays.push(getGaussianDelay(minMs, maxMs, customMean, customStdDev));
	}

	// Sort ascending for sequential scheduling
	return delays.sort((a, b) => a - b);
}

// =============================================================================
// Time Parsing Utilities
// =============================================================================

/**
 * Parses HH:MM time string to minutes since midnight.
 *
 * @param timeStr - Time in HH:MM format
 * @returns Minutes since midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
	const [hours, minutes] = timeStr.split(":").map(Number);
	return hours * 60 + minutes;
}

/**
 * Gets current time in specified timezone as minutes since midnight.
 *
 * @param timezone - IANA timezone (e.g., "Asia/Kolkata")
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Minutes since midnight in the specified timezone
 */
export function getCurrentMinutesInTimezone(timezone: string, referenceDate?: Date): number {
	const date = referenceDate ?? new Date();

	// Get time in target timezone
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	const parts = formatter.formatToParts(date);
	const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
	const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

	return hour * 60 + minute;
}

/**
 * Gets today's date in specified timezone as YYYY-MM-DD string.
 *
 * @param timezone - IANA timezone
 * @param referenceDate - Optional reference date
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayInTimezone(timezone: string, referenceDate?: Date): string {
	const date = referenceDate ?? new Date();

	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	return formatter.format(date);
}

// =============================================================================
// Time-of-Day Volume Calculation
// =============================================================================

/**
 * Calculates the send volume for the current time slot based on Gaussian distribution.
 * Creates a bell curve across the working hours with peak at peak hours.
 *
 * The algorithm:
 * 1. Maps current time to a position in the working window (0 to 1)
 * 2. Uses Gaussian PDF to calculate probability density
 * 3. Peak hours have probability = 1.0, edges taper off
 * 4. Returns volume = dailyLimit * probability * slotFraction
 *
 * @param config - Gaussian configuration
 * @param currentTime - Current time (defaults to now)
 * @param slotMinutes - Duration of the processing slot in minutes
 * @param remainingDailyQuota - Emails remaining for today
 * @returns Volume calculation result
 */
export function calculateSlotVolume(
	config: GaussianConfig,
	currentTime?: Date,
	slotMinutes: number = 5,
	remainingDailyQuota?: number
): SlotVolumeResult {
	const now = currentTime ?? new Date();
	const currentMinutes = getCurrentMinutesInTimezone(config.timezone, now);

	const workStart = parseTimeToMinutes(config.workingHours.start);
	const workEnd = parseTimeToMinutes(config.workingHours.end);
	const peakStart = parseTimeToMinutes(config.peakHours.start);
	const peakEnd = parseTimeToMinutes(config.peakHours.end);

	// Check if outside working hours
	if (currentMinutes < workStart || currentMinutes >= workEnd) {
		return {
			volume: 0,
			inWorkingHours: false,
			inPeakHours: false,
			probability: 0,
			minutesUntilWorkStart:
				currentMinutes < workStart
					? workStart - currentMinutes
					: 24 * 60 - currentMinutes + workStart,
		};
	}

	// Calculate position in working window (0 to 1)
	const workDuration = workEnd - workStart;
	const elapsed = currentMinutes - workStart;
	const progress = elapsed / workDuration;

	// Check if in peak hours
	const inPeakHours = currentMinutes >= peakStart && currentMinutes < peakEnd;

	// Calculate Gaussian probability
	// Map progress (0-1) to standard deviations (-3 to +3)
	// Peak should be at center (progress = 0.5 for peak center)
	const peakCenter = (peakStart + peakEnd) / 2;
	const peakCenterProgress = (peakCenter - workStart) / workDuration;

	// Distance from peak center in terms of working window
	const distanceFromPeak = Math.abs(progress - peakCenterProgress);

	// Map to sigma (0 at peak, ~3 at edges)
	const maxDistance = Math.max(peakCenterProgress, 1 - peakCenterProgress);
	const sigma = (distanceFromPeak / maxDistance) * 3;

	// Gaussian probability (1 at peak, ~0.01 at edges)
	const probability = Math.exp(-0.5 * sigma * sigma);

	// Calculate volume for this slot
	const remaining = remainingDailyQuota ?? config.dailyLimit;

	// Fraction of day this slot represents
	const slotsPerDay = workDuration / slotMinutes;
	const baseFraction = 1 / slotsPerDay;

	// Adjust by probability (peak slots get more, edge slots get less)
	// Use a scaling factor so total across day approximates dailyLimit
	const adjustedFraction = baseFraction * probability * 2; // *2 to compensate for reduced edge slots

	// Calculate volume, ensuring we don't exceed remaining quota
	let volume = Math.round(remaining * adjustedFraction);
	volume = Math.min(volume, remaining, config.dailyLimit);

	// Ensure at least 1 email during peak hours if quota allows
	if (inPeakHours && volume === 0 && remaining > 0) {
		volume = 1;
	}

	return {
		volume,
		inWorkingHours: true,
		inPeakHours,
		probability,
		minutesUntilWorkStart: 0,
	};
}

// =============================================================================
// Combined Human-Like Scheduling
// =============================================================================

export interface ScheduledEmail {
	/** Lead ID */
	leadId: string;
	/** Campaign ID */
	campaignId: string;
	/** Delay in seconds for SQS (0-900) */
	delaySeconds: number;
	/** Absolute scheduled time */
	scheduledAt: Date;
}

/**
 * Schedules a batch of emails with human-like Gaussian timing.
 * Combines time-of-day volume with inter-email delays.
 *
 * @param leadIds - Array of lead IDs to schedule
 * @param campaignId - Campaign ID
 * @param config - Gaussian configuration
 * @param startTime - When to start scheduling from
 * @returns Array of scheduled emails with delays
 */
export function scheduleEmailBatch(
	leadIds: string[],
	campaignId: string,
	config: GaussianConfig,
	startTime?: Date
): ScheduledEmail[] {
	const now = startTime ?? new Date();
	const scheduled: ScheduledEmail[] = [];

	// SQS DelaySeconds max is 900 (15 minutes)
	// For larger batches, consider smaller batch sizes or multi-stage scheduling
	const MAX_SQS_DELAY_SECONDS = 900;

	// Generate Gaussian delays for each email
	const delays = getGaussianDelayBatch(
		leadIds.length,
		config.minDelayMs,
		config.maxDelayMs,
		config.gaussianMean,
		config.gaussianStdDev
	);

	let cumulativeDelayMs = 0;

	for (let i = 0; i < leadIds.length; i++) {
		// Add the delay for this email
		cumulativeDelayMs += delays[i];

		// Calculate SQS delay (max 900 seconds = 15 minutes)
		// Note: If cumulative delay exceeds 15 min, we cap at 900.
		// To avoid bursting, batch size should be limited so cumulative
		// delay stays under 900 seconds.
		const delaySeconds = Math.min(Math.floor(cumulativeDelayMs / 1000), MAX_SQS_DELAY_SECONDS);

		// Calculate absolute scheduled time
		const scheduledAt = new Date(now.getTime() + cumulativeDelayMs);

		scheduled.push({
			leadId: leadIds[i],
			campaignId,
			delaySeconds,
			scheduledAt,
		});
	}

	return scheduled;
}

/**
 * Validates if a campaign should run on the given date.
 *
 * @param scheduledDates - Array of approved dates (YYYY-MM-DD)
 * @param timezone - Campaign timezone
 * @param referenceDate - Date to check (defaults to now)
 * @returns True if the campaign should run today
 */
export function isCampaignScheduledToday(
	scheduledDates: string[],
	timezone: string,
	referenceDate?: Date
): boolean {
	const today = getTodayInTimezone(timezone, referenceDate);
	return scheduledDates.includes(today);
}

// =============================================================================
// Statistics Helpers
// =============================================================================

/**
 * Calculates statistics for an array of delays (for debugging/monitoring).
 *
 * @param delays - Array of delays in milliseconds
 * @returns Statistics object
 */
export function calculateDelayStats(delays: number[]): {
	count: number;
	mean: number;
	stdDev: number;
	min: number;
	max: number;
	median: number;
} {
	if (delays.length === 0) {
		return { count: 0, mean: 0, stdDev: 0, min: 0, max: 0, median: 0 };
	}

	const sorted = [...delays].sort((a, b) => a - b);
	const count = delays.length;
	const sum = delays.reduce((a, b) => a + b, 0);
	const mean = sum / count;

	const squaredDiffs = delays.map((d) => (d - mean) ** 2);
	const variance = squaredDiffs.reduce((a, b) => a + b, 0) / count;
	const stdDev = Math.sqrt(variance);

	const min = sorted[0];
	const max = sorted[count - 1];
	const median =
		count % 2 === 0
			? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
			: sorted[Math.floor(count / 2)];

	return { count, mean, stdDev, min, max, median };
}