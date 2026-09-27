// Display fallback for optional text: blank strings count as missing too
// (unlike `??`, which only replaces null/undefined).
export const textOr = (value: string | null | undefined, fallback: string): string => {
  if (value) return value;
  return fallback;
};
