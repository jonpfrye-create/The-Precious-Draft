import { requireCommissionerLeague } from "@/lib/auth/commissioner";

// Every route inside this (protected) group is commissioner-only. The
// group exists so that adding a page here gates it automatically - the
// login page and the secret-link handler deliberately live outside it.
//
// This guards *rendering* only. Server actions are separate HTTP
// endpoints that do not run this layout, so each one calls
// requireCommissionerLeagueForAction itself.
export const dynamic = "force-dynamic";

export default async function ProtectedCommishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCommissionerLeague();
  return <>{children}</>;
}
