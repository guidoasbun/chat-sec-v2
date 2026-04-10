// Whitelist approach: only allow characters that belong in a chat message.
// Anything not in this set is stripped before it leaves the browser.
// This mirrors the InputSanitizationMiddleware on the backend.
const ALLOWED_CHARS = /[^a-zA-Z0-9 .,!?'"@#\-_:()\n]/g;

export function sanitizeInput(text: string): string {
  return text.replace(ALLOWED_CHARS, "").trim();
}
