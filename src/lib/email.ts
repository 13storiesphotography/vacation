/** Strict enough to reject unfinished input like `name@hotmail` (missing TLD). */
const COMPLETE_EMAIL =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isCompleteEmail(value: string): boolean {
  const email = normalizeEmail(value);
  if (!email || email.length > 254) return false;
  return COMPLETE_EMAIL.test(email);
}
