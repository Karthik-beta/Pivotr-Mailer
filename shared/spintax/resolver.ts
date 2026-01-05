/**
 * Spintax Resolver
 *
 * Resolves Spintax (Spin Syntax) in email templates to generate
 * unique variants for each email.
 *
 * Syntax:
 * - Standard: {option1|option2|option3}
 * - Nested: {Hi|Hello {there|friend}|Hey}
 * - Escaped pipes: {Option with \| pipe}
 *
 * @example
 * resolveSpintax("{Hi|Hello|Hey} {{FirstName}}!")
 * // Returns one of: "Hi {{FirstName}}!", "Hello {{FirstName}}!", "Hey {{FirstName}}!"
 */

/**
 * Maximum iterations to prevent infinite loops from malformed Spintax
 */
const MAX_ITERATIONS = 10;

/**
 * Regex to match Spintax groups (innermost first)
 */
const SPINTAX_REGEX = /\{([^{}]*)\}/g;

/**
 * Resolve all Spintax in a template string.
 * Uses cryptographically secure random selection.
 */
export function resolveSpintax(template: string): string {
	if (!template) return "";

	let resolved = template;
	let iterations = 0;

	// We use a greedy innermost-first matching strategy to resolve nested Spintax.
	// MAX_ITERATIONS prevents infinite loops from malformed inputs (e.g., mismatched braces)
	// while allowing for reasonable nesting depth.
	while (SPINTAX_REGEX.test(resolved) && iterations < MAX_ITERATIONS) {
		SPINTAX_REGEX.lastIndex = 0;

		resolved = resolved.replace(SPINTAX_REGEX, (_match, content: string) => {
			const options = splitSpintaxOptions(content);
			if (options.length === 0) return "";
			if (options.length === 1) return options[0];

			const randomIndex = secureRandomInt(0, options.length - 1);
			return options[randomIndex];
		});

		iterations++;
	}

	resolved = resolved.replace(/\\\|/g, "|");

	return resolved;
}

/**
 * Split Spintax content by pipe, respecting nesting and escapes.
 *
 * @example
 * splitSpintaxOptions("Hi|Hello {there|friend}|Hey")
 * // Returns: ["Hi", "Hello {there|friend}", "Hey"]
 */
function splitSpintaxOptions(content: string): string[] {
	const options: string[] = [];
	let current = "";
	let depth = 0;

	for (let i = 0; i < content.length; i++) {
		const char = content[i];
		const prevChar = i > 0 ? content[i - 1] : "";

		if (char === "{") {
			depth++;
			current += char;
		} else if (char === "}") {
			depth--;
			current += char;
		} else if (char === "|" && depth === 0 && prevChar !== "\\") {
			// Unescaped pipe at top level - split here
			options.push(current);
			current = "";
		} else {
			current += char;
		}
	}

	options.push(current);

	return options;
}

/**
 * Generate a cryptographically secure random integer in range [min, max] (inclusive)
 */
function secureRandomInt(min: number, max: number): number {
	if (min > max) {
		throw new Error("min must be less than or equal to max");
	}

	if (min === max) return min;

	const range = max - min + 1;

	if (typeof crypto !== "undefined" && crypto.getRandomValues) {
		const randomBuffer = new Uint32Array(1);
		crypto.getRandomValues(randomBuffer);
		return min + (randomBuffer[0] % range);
	}

	return min + Math.floor(Math.random() * range);
}

/**
 * Validate Spintax syntax in a template.
 * Returns an array of error messages, empty if valid.
 */
export function validateSpintax(template: string): string[] {
	const errors: string[] = [];
	let braceDepth = 0;
	let position = 0;

	for (const char of template) {
		position++;

		if (char === "{") {
			braceDepth++;
		} else if (char === "}") {
			braceDepth--;
			if (braceDepth < 0) {
				errors.push(`Unexpected closing brace at position ${position}`);
				braceDepth = 0; // Reset to continue checking
			}
		}
	}

	if (braceDepth > 0) {
		errors.push(`Unclosed Spintax brace (${braceDepth} unclosed)`);
	}

	const emptyOptionRegex = /\{\||\|\}/g;
	let match: RegExpExecArray | null;
	match = emptyOptionRegex.exec(template);
	while (match !== null) {
		errors.push(`Empty Spintax option at position ${match.index + 1}`);
		match = emptyOptionRegex.exec(template);
	}

	return errors;
}

/**
 * Count the number of possible Spintax combinations in a template.
 * Useful for showing users how many unique emails can be generated.
 */
export function countSpintaxCombinations(template: string): number {
	// This is a simplified count - doesn't handle nested perfectly
	let count = 1;

	const regex = /\{([^{}]*)\}/g;
	let match: RegExpExecArray | null;

	match = regex.exec(template);
	while (match !== null) {
		const options = splitSpintaxOptions(match[1]);
		count *= options.length;
	}

	return count;
}
