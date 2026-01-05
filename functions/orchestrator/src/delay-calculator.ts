/**
 * Gaussian Delay Calculator
 *
 * Generates human-like timing delays between email sends using
 * the Box-Muller transform to produce normally distributed values.
 * 
 * Intent: We use a normal distribution rather than a flat range to 
 * simulate human variability, which helps maintain sender reputation 
 * with receiving ESPs that monitor for robotic timing patterns.
 */
/**
 * Configuration for Gaussian delay calculation
 */
export interface GaussianConfig {
	/** Minimum delay in milliseconds */
	minDelayMs: number;
	/** Maximum delay in milliseconds */
	maxDelayMs: number;
	/** Custom mean (default: midpoint between min and max) */
	mean?: number;
	/** Custom standard deviation (default: range / 6) */
	stdDev?: number;
}

/**
 * Calculate a Gaussian-distributed delay using the Box-Muller transform.
 *
 * The Box-Muller transform converts two independent uniform random
 * variables into two independent standard normal random variables.
 *
 * @param config - Delay configuration
 * @returns Delay in milliseconds, clamped to [minDelayMs, maxDelayMs]
 */
export function calculateGaussianDelay(config: GaussianConfig): number {
	const { minDelayMs, maxDelayMs } = config;

	// Calculate derived values
	const mean = config.mean ?? (minDelayMs + maxDelayMs) / 2;
	const stdDev = config.stdDev ?? (maxDelayMs - minDelayMs) / 6;

	// Generate two uniform random numbers in (0, 1)
	// Using crypto for better randomness
	const u1 = secureRandom();
	const u2 = secureRandom();

	// Box-Muller transform
	const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

	// Scale to our distribution
	const delay = mean + stdDev * z;

	// Clamp to valid range
	return Math.round(Math.max(minDelayMs, Math.min(maxDelayMs, delay)));
}

/**
 * Generate a cryptographically secure random number in (0, 1).
 * Excludes 0 to avoid Math.log(0) = -Infinity
 */
function secureRandom(): number {
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		const array = new Uint32Array(1);
		crypto.getRandomValues(array);
		// Ensure non-zero by adding 1 and dividing by max+1
		return (array[0] + 1) / (0xffffffff + 2);
	}

	// Fallback for environments without crypto
	let result = Math.random();
	while (result === 0) {
		result = Math.random();
	}
	return result;
}

/**
 * Sleep for a specified duration.
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sleep for a Gaussian-distributed duration.
 */
export async function gaussianSleep(config: GaussianConfig): Promise<number> {
	const delay = calculateGaussianDelay(config);
	await sleep(delay);
	return delay;
}

/**
 * Calculate statistics for a set of delays (for testing/validation).
 */
export function calculateDelayStatistics(
	config: GaussianConfig,
	sampleSize: number = 1000
): { mean: number; stdDev: number; min: number; max: number } {
	const samples: number[] = [];

	for (let i = 0; i < sampleSize; i++) {
		samples.push(calculateGaussianDelay(config));
	}

	const sum = samples.reduce((a, b) => a + b, 0);
	const mean = sum / samples.length;

	const squaredDiffs = samples.map((x) => (x - mean) ** 2);
	const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / samples.length;
	const stdDev = Math.sqrt(avgSquaredDiff);

	return {
		mean,
		stdDev,
		min: Math.min(...samples),
		max: Math.max(...samples),
	};
}
