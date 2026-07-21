import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export function createClient() {
  // IMPORTANT: access env vars statically so Next.js inlines them into the client bundle.
  // Dynamic access like process.env[name] breaks browser auth.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase ist nicht konfiguriert. NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel setzen (ohne Sensitive) und neu deployen.",
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
