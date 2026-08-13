// Deterministic pseudo-randomness from a string.
//
// Used wherever something should look scattered but must not change
// between renders: sticker rotations, confetti, team colours. Math.random
// is wrong for all of these - it re-rolls on every render, so a sticker
// would visibly twitch each time the board updated, and it can't be called
// during render at all.

// FNV-1a. Fast, no dependencies, spreads well enough for visual purposes.
// Not doing anything security-shaped.
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A stable number in [0, 1) derived from the seed. */
export function unitFromSeed(seed: string): number {
  return (hashString(seed) % 100000) / 100000;
}

/** A stable number in [min, max) derived from the seed. */
export function rangeFromSeed(seed: string, min: number, max: number): number {
  return min + unitFromSeed(seed) * (max - min);
}
