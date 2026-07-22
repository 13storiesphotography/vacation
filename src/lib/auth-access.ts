import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const FRESH_ACCOUNT_MS = 2 * 60 * 1000;

/**
 * Invite-only guard for OAuth providers.
 * Allows existing/invited users; blocks brand-new OAuth-only accounts
 * that have no vacation membership.
 *
 * Relies on Supabase "Enable sign ups" being off + Automatic linking by email.
 * When the service role key is missing, we skip the extra check.
 *
 * Note: Apple Sign-In UI is currently removed (needs paid Apple Developer).
 * This guard remains for any future OAuth provider.
 */
export async function assertOAuthUserAllowed(user: User): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const admin = createAdminClient();
  if (!admin) return { ok: true };

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    return { ok: false, reason: "Apple hat keine E-Mail geliefert." };
  }

  const { data: byUser } = await admin
    .from("vacation_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (byUser && byUser.length > 0) {
    return { ok: true };
  }

  const { data: byEmail } = await admin
    .from("vacation_members")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (byEmail && byEmail.length > 0) {
    return { ok: true };
  }

  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  const identities = authUser.user?.identities ?? [];
  const hasNonAppleIdentity = identities.some(
    (identity) => identity.provider !== "apple",
  );
  if (hasNonAppleIdentity) {
    return { ok: true };
  }

  const createdAt = Date.parse(user.created_at);
  const isFresh = Number.isFinite(createdAt) && Date.now() - createdAt < FRESH_ACCOUNT_MS;
  if (!isFresh) {
    // Pre-existing account (e.g. first admin) signing in with Apple.
    return { ok: true };
  }

  return {
    ok: false,
    reason: "Zugang nur per Einladung. Bitte lass dich zuerst einladen.",
  };
}
