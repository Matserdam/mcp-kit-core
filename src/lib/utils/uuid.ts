/**
 * Runtime-agnostic ID generator that prefers Web Crypto API when available
 * and falls back to a timestamp-based pseudo-random string for edge/Deno compatibility.
 */
export function generateId(): string {
  // Try Web Crypto API first (available in browsers, Deno, modern Node, edge runtimes)
  const crypto = globalThis.crypto as Crypto | undefined;
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: timestamp + random hex string (not cryptographically secure)
  // This is acceptable for request correlation IDs, not security decisions
  const timestamp = Date.now().toString(16);
  const randomPart = Math.random().toString(16).slice(2, 10);
  return `${timestamp}-${randomPart}-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}
