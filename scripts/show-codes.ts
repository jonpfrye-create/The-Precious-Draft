import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createAdminSupabaseClient } from "../src/lib/supabase/admin-client";
import { ensureLeagueSecrets } from "../src/lib/auth/secrets";

// Prints the commissioner link and league code for every league, creating
// them if they don't exist yet. This is the bootstrap path (leagues made
// before codes existed have no secrets row) and the recovery path (the
// commissioner link is not stored anywhere else in readable form).
//
// Run with: npm run codes
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local, which is what keeps
// this to whoever already has the project checked out.

function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return fromEnv || "http://localhost:3000";
}

async function main() {
  const supabase = createAdminSupabaseClient();
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;

  if (!leagues || leagues.length === 0) {
    console.log(
      "\nNo leagues yet. Open /commish/setup to create one - the first" +
        "\nleague can be created without a code, and creating it will" +
        "\ngenerate your commissioner link automatically.\n"
    );
    return;
  }

  const base = siteUrl();
  console.log("");
  for (const league of leagues) {
    const secrets = await ensureLeagueSecrets(league.id);
    const created = new Date(league.created_at).toLocaleDateString();
    console.log(`  ${league.name}  (created ${created})`);
    console.log(`  ${"-".repeat(60)}`);
    console.log(`  League code (share freely):  ${secrets.leagueCode}`);
    console.log(
      `  Commissioner link (KEEP PRIVATE):\n    ${base}/commish/enter?secret=${secrets.commissionerSecret}`
    );
    console.log("");
  }

  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    console.log(
      "  Note: links above use localhost because NEXT_PUBLIC_SITE_URL isn't set." +
        "\n  For the live site, swap the host for your real domain.\n"
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
