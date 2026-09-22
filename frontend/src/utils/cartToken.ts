// Identifies this browser's cart to the server so stock holds can be tied to it.
const KEY = 'cart_token';

const generate = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`)
    .replace(/[^A-Za-z0-9_-]/g, '')
    .padEnd(16, '0')
    .slice(0, 64);

export function getCartToken(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const token = generate();
    localStorage.setItem(KEY, token);
    return token;
  } catch {
    return generate();
  }
}

// Unique key for one checkout attempt; retries reuse it so the server can
// de-duplicate, a changed cart gets a fresh one.
export const newIdempotencyKey = (): string => generate();
