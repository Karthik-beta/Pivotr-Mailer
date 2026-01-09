/**
 * Unit Tests: Spintax Utilities
 *
 * Tests the pure business logic of spintax resolution and variable injection.
 * No AWS services are used in these tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    resolveSpintax,
    injectVariables,
    validateSpintax,
} from '../../../../lambda/shared/src/utils/spintax.js';

describe('Spintax Utilities', () => {
    describe('resolveSpintax', () => {
        it('should return empty string for empty input', () => {
            expect(resolveSpintax('')).toBe('');
        });

        it('should return same string when no spintax present', () => {
            const input = 'Hello World!';
            expect(resolveSpintax(input)).toBe(input);
        });

        it('should resolve simple spintax with two options', () => {
            const input = '{Hello|Hi} World!';
            const result = resolveSpintax(input);

            expect(result).toMatch(/^(Hello|Hi) World!$/);
        });

        it('should resolve spintax with multiple options', () => {
            const input = '{one|two|three|four}';
            const result = resolveSpintax(input);

            expect(['one', 'two', 'three', 'four']).toContain(result);
        });

        it('should resolve multiple spintax groups', () => {
            const input = '{Hi|Hello} {World|Universe}!';
            const result = resolveSpintax(input);

            expect(result).toMatch(/^(Hi|Hello) (World|Universe)!$/);
        });

        it('should handle spintax with single option', () => {
            const input = '{only} option';
            expect(resolveSpintax(input)).toBe('only option');
        });

        it('should handle empty spintax', () => {
            const input = 'Before {} After';
            expect(resolveSpintax(input)).toBe('Before  After');
        });

        it('should preserve escaped pipes', () => {
            const input = '{option\\|with\\|pipes|other}';
            const result = resolveSpintax(input);

            expect(result).toMatch(/^(option\|with\|pipes|other)$/);
        });

        it('should handle nested spintax', () => {
            // Nested spintax like {outer{inner1|inner2}|simple}
            const input = '{a{b|c}|d}';
            const result = resolveSpintax(input);

            // Result should be one of: ab, ac, d
            expect(['ab', 'ac', 'd']).toContain(result);
        });

        it('should not affect variable placeholders', () => {
            const input = '{Hello|Hi} {{FirstName}}!';
            const result = resolveSpintax(input);

            expect(result).toMatch(/^(Hello|Hi) \{\{FirstName\}\}!$/);
        });

        it('should protect against infinite loops with MAX_ITERATIONS', () => {
            // This shouldn't hang even with malformed input
            const input = '{{{{{{{{{{heavily nested}}}}}}}}}}';
            const start = Date.now();
            resolveSpintax(input);
            const elapsed = Date.now() - start;

            // Should complete quickly (< 100ms)
            expect(elapsed).toBeLessThan(100);
        });
    });

    describe('injectVariables', () => {
        it('should return empty string for empty input', () => {
            expect(injectVariables('', {})).toBe('');
        });

        it('should return same string when no variables present', () => {
            const input = 'Hello World!';
            expect(injectVariables(input, { name: 'John' })).toBe(input);
        });

        it('should inject single variable', () => {
            const input = 'Hello {{name}}!';
            const result = injectVariables(input, { name: 'John' });

            expect(result).toBe('Hello John!');
        });

        it('should inject multiple variables', () => {
            const input = 'Hi {{firstName}}, welcome to {{company}}!';
            const result = injectVariables(input, {
                firstName: 'Jane',
                company: 'Acme Corp',
            });

            expect(result).toBe('Hi Jane, welcome to Acme Corp!');
        });

        it('should handle case-insensitive variable names', () => {
            const input = '{{FIRSTNAME}} {{firstname}} {{FirstName}}';
            const result = injectVariables(input, { firstName: 'John' });

            expect(result).toBe('John John John');
        });

        it('should preserve unknown variables', () => {
            const input = 'Hello {{unknown}}!';
            const result = injectVariables(input, { name: 'John' });

            expect(result).toBe('Hello {{unknown}}!');
        });

        it('should handle empty variable values', () => {
            const input = 'Hello {{name}}!';
            const result = injectVariables(input, { name: '' });

            expect(result).toBe('Hello !');
        });

        it('should handle variables with special characters in values', () => {
            const input = 'Email: {{email}}';
            const result = injectVariables(input, { email: 'test@example.com' });

            expect(result).toBe('Email: test@example.com');
        });

        it('should not inject variables that look like spintax', () => {
            // {{var}} should work, but {var} should not be replaced
            const input = '{spintax} and {{variable}}';
            const result = injectVariables(input, { spintax: 'x', variable: 'y' });

            expect(result).toBe('{spintax} and y');
        });
    });

    describe('validateSpintax', () => {
        it('should return empty array for valid spintax', () => {
            const errors = validateSpintax('{Hello|Hi} World!');
            expect(errors).toEqual([]);
        });

        it('should return empty array for empty input', () => {
            const errors = validateSpintax('');
            expect(errors).toEqual([]);
        });

        it('should detect unclosed braces', () => {
            const errors = validateSpintax('{Hello|Hi World');
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Unclosed');
        });

        it('should detect unexpected closing braces', () => {
            const errors = validateSpintax('Hello} World');
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Unexpected closing brace');
        });

        it('should detect multiple errors', () => {
            const errors = validateSpintax('}missing open{');
            expect(errors.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle nested braces correctly', () => {
            const errors = validateSpintax('{{nested}}');
            expect(errors).toEqual([]);
        });

        it('should validate complex valid spintax', () => {
            const template = '{Hi|Hello} {{FirstName}}, {welcome to|we\'re glad to have you at} {{Company}}!';
            const errors = validateSpintax(template);
            expect(errors).toEqual([]);
        });
    });

    describe('Integration: resolveSpintax + injectVariables', () => {
        it('should work together for a complete email template', () => {
            const template = '{Hi|Hello} {{firstName}}, {welcome|thanks for joining}!';

            // First resolve spintax
            const resolved = resolveSpintax(template);

            // Then inject variables
            const final = injectVariables(resolved, { firstName: 'John' });

            // Should match one of the expected patterns
            expect(final).toMatch(/^(Hi|Hello) John, (welcome|thanks for joining)!$/);
        });

        it('should handle real-world email subject', () => {
            const template = '{Quick question|Following up} about {{company}}';

            const resolved = resolveSpintax(template);
            const final = injectVariables(resolved, { company: 'Acme Corp' });

            expect(final).toMatch(/^(Quick question|Following up) about Acme Corp$/);
        });

        it('should handle real-world email body', () => {
            const template = `
{Hi|Hello} {{firstName}},

{I noticed|I saw|I found} your company {{company}} {online|while researching}.

{Would you be open to|Are you interested in|Can we schedule} a quick call?

Best,
{John|Jane|The Team}
            `.trim();

            const resolved = resolveSpintax(template);
            const final = injectVariables(resolved, {
                firstName: 'Alex',
                company: 'TechCo',
            });

            expect(final).toContain('Alex');
            expect(final).toContain('TechCo');
            expect(final).not.toContain('{{firstName}}');
            expect(final).not.toContain('{{company}}');
        });
    });
});
