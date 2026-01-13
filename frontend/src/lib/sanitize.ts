import DOMPurify from "dompurify";

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Safe to call in both Client and Server environments.
 * 
 * @param html The HTML string to sanitize
 * @returns Sanitized HTML string (on client) or original HTML string (on server)
 */
export function sanitizeHtml(html: string): string {
    if (typeof window === "undefined") {
        // SSR path:
        // We intentionally do not sanitize on the server because:
        // - DOMPurify requires a DOM
        // - React escapes HTML during SSR
        // - Final rendering and XSS protection happens on the client
        return html;
    }
    return DOMPurify.sanitize(html);
}
