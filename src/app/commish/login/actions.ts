"use server";

import { extractSecretFromInput } from "@/lib/auth/codes";
import {
  startCommissionerSession,
  verifyCommissionerSecret,
} from "@/lib/auth/commissioner";

export interface SignInResult {
  ok: boolean;
  error?: string;
}

// Returns a result rather than calling redirect(): redirect() works by
// throwing a control-flow error, which the caller's try/catch would
// swallow and report as a failed sign-in. The client navigates instead.
export async function signInAsCommissioner(
  input: string
): Promise<SignInResult> {
  const secret = extractSecretFromInput(input ?? "");
  if (!secret) {
    return { ok: false, error: "Paste your commissioner link or code first." };
  }

  const league = await verifyCommissionerSecret(secret);
  if (!league) {
    // Deliberately vague: distinguishing "no such code" from "code for a
    // different league" would confirm a guess. Exactly one person needs
    // this to work, and they have the link.
    return { ok: false, error: "That commissioner code wasn't recognized." };
  }

  await startCommissionerSession(secret);
  return { ok: true };
}
