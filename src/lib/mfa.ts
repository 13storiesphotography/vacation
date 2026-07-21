/** Days a new account may use /app before TOTP enroll is mandatory. */
export const MFA_ENROLL_GRACE_DAYS = 7;

export function mfaEnrollGraceDeadline(createdAt: string | null | undefined): Date | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const deadline = new Date(created);
  deadline.setUTCDate(deadline.getUTCDate() + MFA_ENROLL_GRACE_DAYS);
  return deadline;
}

export function isWithinMfaEnrollGrace(createdAt: string | null | undefined, now = new Date()): boolean {
  const deadline = mfaEnrollGraceDeadline(createdAt);
  if (!deadline) return false;
  return now.getTime() < deadline.getTime();
}

export function formatMfaGraceRemaining(
  createdAt: string | null | undefined,
  now = new Date(),
): string | null {
  const deadline = mfaEnrollGraceDeadline(createdAt);
  if (!deadline) return null;
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return null;
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 1) return "noch heute";
  return `noch ${days} Tage`;
}
