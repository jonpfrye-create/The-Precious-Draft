import { createAdminSupabaseClient } from "../supabase/admin-client";
import { generateCommissionerSecret, generateLeagueCode } from "./codes";

// Every read and write in here goes through the service-role client. That
// is deliberate and load-bearing: league_secrets has RLS enabled with zero
// policies (see supabase/schema.sql), so the anon key shipped to browsers
// cannot read this table under any circumstance. If these queries ever get
// moved to the browser client they will silently return nothing.
//
// This module intentionally does NOT import "server-only", and uses a
// relative import for the same reason: scripts/show-codes.ts runs it
// outside Next's bundler, where that guard throws unconditionally. Next
// app code should reach this through ./commissioner, which is guarded.

export interface LeagueSecrets {
  leagueId: string;
  leagueCode: string;
  commissionerSecret: string;
}

interface SecretsRow {
  league_id: string;
  league_code: string;
  commissioner_secret: string;
}

function toLeagueSecrets(row: SecretsRow): LeagueSecrets {
  return {
    leagueId: row.league_id,
    leagueCode: row.league_code,
    commissionerSecret: row.commissioner_secret,
  };
}

// Both code columns are UNIQUE, so a collision surfaces as a 23505 unique
// violation rather than two leagues quietly sharing a code. Retrying with
// fresh codes is far simpler than pre-checking for a free code, and at
// these odds the loop effectively never runs twice.
const UNIQUE_VIOLATION = "23505";
const MAX_ATTEMPTS = 5;

export async function createLeagueSecrets(
  leagueId: string
): Promise<LeagueSecrets> {
  const supabase = createAdminSupabaseClient();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = {
      league_id: leagueId,
      league_code: generateLeagueCode(),
      commissioner_secret: generateCommissionerSecret(),
    };
    const { data, error } = await supabase
      .from("league_secrets")
      .insert(candidate)
      .select("league_id, league_code, commissioner_secret")
      .single();

    if (!error) return toLeagueSecrets(data);
    if (error.code !== UNIQUE_VIOLATION) throw error;

    // league_id is the primary key, so a unique violation on a league that
    // already has secrets is not a code collision - it means someone else
    // created them first. Hand back what's already there.
    const existing = await getLeagueSecrets(leagueId);
    if (existing) return existing;
  }
  throw new Error(
    "Could not generate a unique league code after several attempts"
  );
}

export async function getLeagueSecrets(
  leagueId: string
): Promise<LeagueSecrets | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("league_secrets")
    .select("league_id, league_code, commissioner_secret")
    .eq("league_id", leagueId)
    .maybeSingle();
  if (error) throw error;
  return data ? toLeagueSecrets(data) : null;
}

// Used to heal leagues created before codes existed, and by the
// `npm run codes` bootstrap script.
export async function ensureLeagueSecrets(
  leagueId: string
): Promise<LeagueSecrets> {
  const existing = await getLeagueSecrets(leagueId);
  if (existing) return existing;
  return createLeagueSecrets(leagueId);
}

// Returns the league a commissioner secret unlocks, or null if no league
// matches. The lookup is by exact value against a UNIQUE column, so an
// unknown secret is simply a miss.
export async function findLeagueIdByCommissionerSecret(
  secret: string
): Promise<string | null> {
  if (!secret) return null;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("league_secrets")
    .select("league_id")
    .eq("commissioner_secret", secret)
    .maybeSingle();
  if (error) throw error;
  return data?.league_id ?? null;
}

export async function findLeagueIdByLeagueCode(
  code: string
): Promise<string | null> {
  if (!code) return null;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("league_secrets")
    .select("league_id")
    .eq("league_code", code)
    .maybeSingle();
  if (error) throw error;
  return data?.league_id ?? null;
}
