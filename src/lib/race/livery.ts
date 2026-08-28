/**
 * Turning one orange mascot into twelve.
 *
 * The sprite's kit is a single strong orange; everything else is white
 * or near-black, which have no hue to rotate. So a plain hue rotation
 * repaints the jersey and leaves the uniform alone - twelve liveries out
 * of one piece of pixel art.
 */

/** The mascot sprite's own jersey hue, measured off the PNG. */
export const MASCOT_HUE = 22;

/** Hue of a #rrggbb colour, 0-360. Grey returns 0. */
export function hexToHue(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

/** How far to rotate the sprite so its kit lands on this team's colour. */
export function liveryRotation(hex: string): number {
  return hexToHue(hex) - MASCOT_HUE;
}
