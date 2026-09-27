// Identifies this browser's cart to the server so stock holds can be tied to it.
const KEY = 'cart_token';

// randomUUID needs a secure context (HTTPS/localhost); getRandomValues works everywhere.
const randomId = (): string => {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const generate = () =>
  randomId()
    .replaceAll(/[^A-Za-z0-9_-]/g, '')
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
