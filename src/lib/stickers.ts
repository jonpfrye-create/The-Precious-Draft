import { rangeFromSeed } from "./random/seeded";

export interface StickerTransform {
  rotation: number;
  offsetX: number;
  offsetY: number;
}

// This league drafted on a physical board with printed player stickers for
// years, and no sticker ever went on straight. A perfect grid is the one
// thing that would make the board feel like a spreadsheet instead, so every
// pick gets its own small, permanent tilt.
//
// Kept small on purpose: enough to read as hand-placed from across a room,
// not so much that names start colliding with their neighbours.
const MAX_ROTATION_DEGREES = 2.8;
const MAX_OFFSET_PX = 2.5;

/**
 * The tilt for one pick. Derived from the pick's id, so it's decided once
 * and never changes - a sticker that re-rotated whenever the board
 * refreshed would be worse than no rotation at all.
 */
export function stickerTransform(seed: string): StickerTransform {
  return {
    rotation: rangeFromSeed(`${seed}:rot`, -MAX_ROTATION_DEGREES, MAX_ROTATION_DEGREES),
    offsetX: rangeFromSeed(`${seed}:x`, -MAX_OFFSET_PX, MAX_OFFSET_PX),
    offsetY: rangeFromSeed(`${seed}:y`, -MAX_OFFSET_PX, MAX_OFFSET_PX),
  };
}

/** Ready-to-use CSS transform for a sticker. */
export function stickerStyle(seed: string): { transform: string } {
  const { rotation, offsetX, offsetY } = stickerTransform(seed);
  return {
    transform: `rotate(${rotation.toFixed(2)}deg) translate(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px)`,
  };
}
