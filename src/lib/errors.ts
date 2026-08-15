/**
 * What to say when a server action doesn't come back.
 *
 * "Couldn't reach the server" was wrong about its own cause often enough
 * to matter. Server action ids are baked into a build, so any deploy
 * turns every page already open in a browser into one whose buttons post
 * to ids the server no longer has. The server is up; the page is stale;
 * a reload fixes it instantly - and the old message sent people looking
 * at their wifi instead.
 *
 * Both causes get the same advice because a reload is harmless when the
 * connection really is down, and it is the whole fix when it isn't.
 */
export const ACTION_FAILED =
  "That didn't save. Refresh the page and try again — if the app was updated while this page was open, that fixes it.";
