import { redirect } from "next/navigation";
import { getFirstLeague } from "@/lib/draft/queries";

// Which redirect fires depends on live DB state - never prerender this.
export const dynamic = "force-dynamic";

export default async function CommishEntry() {
  const league = await getFirstLeague();
  if (!league) {
    redirect("/commish/setup");
  }
  redirect("/commish/board");
}
