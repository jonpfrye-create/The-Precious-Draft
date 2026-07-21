import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

// Shows a live player count - must never be statically prerendered.
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createBrowserSupabaseClient();
  const { count, error } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Precious Draft
      </h1>
      {error ? (
        <p className="text-red-600">
          Supabase connection failed: {error.message}
        </p>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-400">
          Connected to Supabase — {count} players in the pool.
        </p>
      )}
      <Link
        href="/commish"
        className="rounded bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
      >
        Go to draft board
      </Link>
    </div>
  );
}
