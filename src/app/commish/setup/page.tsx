import { redirect } from "next/navigation";
import { checkSetupAccess } from "@/lib/auth/setup-access";
import SetupForm from "./SetupForm";

// Access depends on live DB state (whether any league exists yet).
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Deliberately outside the (protected) group: on an empty database there
  // is no commissioner secret yet, so this page has to be reachable to
  // mint the first one. See lib/auth/setup-access.ts.
  const access = await checkSetupAccess();
  if (!access.allowed) redirect("/commish/login");

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black">
      <h1 className="text-3xl font-semibold">Set up the Main draft</h1>
      <SetupForm />
    </div>
  );
}
