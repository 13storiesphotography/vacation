import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Server-only admin client. Returns null when the service role key is missing. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRole) return null;

  return createClient<Database>(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
