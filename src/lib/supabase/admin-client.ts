import { createClient } from "@supabase/supabase-js";

// The actual client construction, with no "server-only" import guard.
// Used directly by standalone Node scripts (e.g. scripts/ingest-players.ts)
// that run outside Next.js's bundler, where that guard would throw
// unconditionally. Next.js app code should import from ./admin instead,
// which wraps this with the guard.
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment."
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
