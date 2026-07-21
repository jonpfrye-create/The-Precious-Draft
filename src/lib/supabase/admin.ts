import "server-only";

// Service-role client for use from Next.js app code (API routes, Server
// Components) ONLY. Bypasses Row Level Security entirely. The
// "server-only" import above makes it a build error to pull this into a
// client bundle. Standalone scripts should import from ./admin-client
// instead, since this guard throws unconditionally outside Next's bundler.
export { createAdminSupabaseClient } from "./admin-client";
