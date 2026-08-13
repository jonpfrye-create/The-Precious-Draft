import { randomInt } from "node:crypto";

// Crockford base32: the digits and uppercase letters, minus I, L, O and U.
// I/L/O are dropped because they're indistinguishable from 1/1/0 when a
// code is read aloud across a room or squinted at on a phone; U is
// dropped because leaving it out makes accidental profanity impossible.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// Short enough to read aloud to the room, long enough that guessing it is
// not worth anyone's time (32^6 ~ 1.07 billion). This code only ever lets
// someone claim a team - it grants no commissioner powers - so the bar it
// has to clear is "not stumbled into," not "not brute-forced."
const LEAGUE_CODE_LENGTH = 6;

// The commissioner secret is the real credential: it can enter picks for
// any team and undo them. It lives in a link nobody types by hand, so
// there's no reason to be short. 26 chars is ~130 bits.
const COMMISSIONER_SECRET_LENGTH = 26;

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    // randomInt is rejection-sampled, so this stays uniform even though
    // the alphabet length doesn't divide evenly into the RNG's range.
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

export function generateLeagueCode(): string {
  return randomCode(LEAGUE_CODE_LENGTH);
}

export function generateCommissionerSecret(): string {
  return randomCode(COMMISSIONER_SECRET_LENGTH);
}

// Codes get retyped from a text message, a scrap of paper, or a shout
// across the room, so accept the near misses: lowercase, stray spaces or
// dashes, and the letters we deliberately left out of the alphabet
// (someone who sees "0" may well type "O").
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

export function isValidCodeShape(code: string, expectedLength: number): boolean {
  if (code.length !== expectedLength) return false;
  return [...code].every((char) => ALPHABET.includes(char));
}

export function isValidLeagueCodeShape(code: string): boolean {
  return isValidCodeShape(code, LEAGUE_CODE_LENGTH);
}

export function isValidCommissionerSecretShape(code: string): boolean {
  return isValidCodeShape(code, COMMISSIONER_SECRET_LENGTH);
}

// The commissioner gets handed a URL, not a code, so the paste box has to
// cope with someone pasting the whole link back in. Pull the secret out of
// a ?secret= query param if there is one; otherwise treat the input as the
// bare code.
export function extractSecretFromInput(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]secret=([^&#\s]+)/);
  return normalizeCode(match ? match[1] : trimmed);
}

export const CODE_LENGTHS = {
  leagueCode: LEAGUE_CODE_LENGTH,
  commissionerSecret: COMMISSIONER_SECRET_LENGTH,
} as const;
