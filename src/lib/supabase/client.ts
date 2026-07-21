import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

function requireEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} fehlt oder ist leer. In Vercel prüfen und ohne Leerzeichen/Zeilenumbruch speichern.`,
    );
  }
  return value;
}

export function createClient() {
  return createBrowserClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
