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

export interface Placement {
  placement_x: number | null;
  placement_y: number | null;
  placement_rotation: number | null;
}

// How far off-centre a click can push a sticker, as a percentage of the
// cell. Clamped so a sticker slapped right at the edge still stays legible
// and doesn't overlap its neighbours.
const MAX_PLACEMENT_PERCENT = 22;
// A corner slap comes out visibly more crooked than a careful middle press.
const MAX_PLACEMENT_ROTATION = 7;

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * Turns a click inside a cell into a placement.
 *
 * `relativeX` and `relativeY` run 0..1 across the cell, so the caller can
 * work them out from a bounding rect without this needing to know anything
 * about the DOM. Rotation follows the horizontal offset: press it on to
 * the right and it leans right, which is what a hand does.
 */
export function placementFromClick(
  relativeX: number,
  relativeY: number
): { x: number; y: number; rotation: number } {
  // Recentre so the middle of the cell is (0, 0).
  const offsetX = (relativeX - 0.5) * 2;
  const offsetY = (relativeY - 0.5) * 2;
  return {
    x: clamp(offsetX * MAX_PLACEMENT_PERCENT, MAX_PLACEMENT_PERCENT),
    y: clamp(offsetY * MAX_PLACEMENT_PERCENT, MAX_PLACEMENT_PERCENT),
    rotation: clamp(offsetX * MAX_PLACEMENT_ROTATION, MAX_PLACEMENT_ROTATION),
  };
}

/**
 * Where a sticker actually sits: the spot it was pressed onto if a human
 * placed it, otherwise the tilt derived from its id.
 *
 * Auto-drafted and simulated picks have no placement, and should still look
 * hand-placed rather than sitting in a perfect grid.
 */
export function placementStyle(
  pickId: string,
  placement: Placement
): { transform: string } {
  const { placement_x, placement_y, placement_rotation } = placement;
  if (placement_x === null || placement_y === null) {
    return stickerStyle(pickId);
  }
  const rotation = placement_rotation ?? 0;
  return {
    transform: `translate(${placement_x.toFixed(1)}%, ${placement_y.toFixed(1)}%) rotate(${rotation.toFixed(2)}deg)`,
  };
}
