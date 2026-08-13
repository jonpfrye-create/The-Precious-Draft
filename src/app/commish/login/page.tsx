import LoginForm from "./LoginForm";

// Reads the cookie via the form's action; never prerender.
export const dynamic = "force-dynamic";

export default async function CommishLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // /commish/enter bounces here with ?error=invalid when a secret link
  // doesn't match, so a stale bookmark explains itself.
  const { error } = await searchParams;
  const initialError =
    error === "invalid"
      ? "That commissioner link is no longer valid. Paste the current one below."
      : null;

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex w-full max-w-md flex-col gap-2">
        <h1 className="text-3xl font-semibold">Commissioner access</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          This is the private side of the draft board — entering picks, undo,
          and phase setup. Drafters don&apos;t come through here.
        </p>
      </div>
      <LoginForm initialError={initialError} />
      <p className="max-w-md text-sm text-zinc-500">
        Lost your link? Run <code className="font-mono">npm run codes</code> on
        the computer with the project on it to print it again.
      </p>
    </div>
  );
}
