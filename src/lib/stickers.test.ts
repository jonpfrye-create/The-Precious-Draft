import { describe, expect, it } from "vitest";
import { stickerStyle, stickerTransform } from "./stickers";

describe("stickerTransform", () => {
  it("is stable for the same pick", () => {
    // The whole point: a sticker placed on the board must never move
    // again, however many times the board re-renders.
    const first = stickerTransform("pick-123");
    const second = stickerTransform("pick-123");
    expect(second).toEqual(first);
  });

  it("differs between picks", () => {
    const rotations = new Set(
      Array.from({ length: 50 }, (_, i) => stickerTransform(`pick-${i}`).rotation)
    );
    expect(rotations.size).toBeGreaterThan(40);
  });

  it("stays within a believable tilt", () => {
    // Big enough to read as hand-placed, small enough that names don't
    // collide with the next cell.
    for (let i = 0; i < 500; i++) {
      const { rotation, offsetX, offsetY } = stickerTransform(`pick-${i}`);
      expect(Math.abs(rotation)).toBeLessThanOrEqual(2.8);
      expect(Math.abs(offsetX)).toBeLessThanOrEqual(2.5);
      expect(Math.abs(offsetY)).toBeLessThanOrEqual(2.5);
    }
  });

  it("tilts both ways", () => {
    const rotations = Array.from({ length: 200 }, (_, i) =>
      stickerTransform(`pick-${i}`).rotation
    );
    expect(rotations.some((r) => r > 0.5)).toBe(true);
    expect(rotations.some((r) => r < -0.5)).toBe(true);
  });

  it("does not leave everything nearly straight", () => {
    // A hash that clustered near zero would produce a grid that only
    // looked broken rather than hand-placed.
    const rotations = Array.from({ length: 200 }, (_, i) =>
      stickerTransform(`pick-${i}`).rotation
    );
    const meaningful = rotations.filter((r) => Math.abs(r) > 1);
    expect(meaningful.length).toBeGreaterThan(60);
  });
});

describe("stickerStyle", () => {
  it("produces a usable CSS transform", () => {
    const { transform } = stickerStyle("pick-1");
    expect(transform).toMatch(/^rotate\(-?\d+\.\d{2}deg\) translate\(-?\d+\.\d+px, -?\d+\.\d+px\)$/);
  });

  it("matches the underlying transform", () => {
    const { rotation } = stickerTransform("pick-42");
    expect(stickerStyle("pick-42").transform).toContain(
      `${rotation.toFixed(2)}deg`
    );
  });
});
