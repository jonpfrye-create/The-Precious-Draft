import { createClient } from "@supabase/supabase-js";

// Anon-key client for reads from client components / the browser. RLS
// only grants this key SELECT access — see supabase/schema.sql.
export function createBrowserSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
