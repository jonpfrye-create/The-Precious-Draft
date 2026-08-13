import { describe, expect, it } from "vitest";
import {
  placementFromClick,
  placementStyle,
  stickerStyle,
  stickerTransform,
} from "./stickers";

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

describe("placementFromClick", () => {
  it("puts a dead-centre click at the centre", () => {
    expect(placementFromClick(0.5, 0.5)).toEqual({ x: 0, y: 0, rotation: 0 });
  });

  it("pushes toward the corner you clicked", () => {
    const topLeft = placementFromClick(0, 0);
    expect(topLeft.x).toBeLessThan(0);
    expect(topLeft.y).toBeLessThan(0);

    const bottomRight = placementFromClick(1, 1);
    expect(bottomRight.x).toBeGreaterThan(0);
    expect(bottomRight.y).toBeGreaterThan(0);
  });

  it("leans the way it was pressed on", () => {
    expect(placementFromClick(1, 0.5).rotation).toBeGreaterThan(0);
    expect(placementFromClick(0, 0.5).rotation).toBeLessThan(0);
  });

  it("clamps so a corner slap stays inside its cell", () => {
    // Clicks outside the cell can happen on a fast drag; they shouldn't
    // fling a sticker over its neighbours.
    for (const [x, y] of [[-3, -3], [4, 4], [0, 1], [1, 0]]) {
      const p = placementFromClick(x, y);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(22);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(22);
      expect(Math.abs(p.rotation)).toBeLessThanOrEqual(7);
    }
  });

  it("is more crooked at the edge than in the middle", () => {
    expect(Math.abs(placementFromClick(0.95, 0.5).rotation)).toBeGreaterThan(
      Math.abs(placementFromClick(0.55, 0.5).rotation)
    );
  });
});

describe("placementStyle", () => {
  const none = {
    placement_x: null,
    placement_y: null,
    placement_rotation: null,
  };

  it("falls back to the seeded tilt when nobody placed it", () => {
    // Auto-drafted and simulated picks still need to look hand-placed.
    expect(placementStyle("pick-1", none)).toEqual(stickerStyle("pick-1"));
  });

  it("uses the stored placement when there is one", () => {
    const { transform } = placementStyle("pick-1", {
      placement_x: 12.5,
      placement_y: -8,
      placement_rotation: 4,
    });
    expect(transform).toContain("translate(12.5%, -8.0%)");
    expect(transform).toContain("rotate(4.00deg)");
  });

  it("treats a missing rotation as straight rather than falling back", () => {
    const { transform } = placementStyle("pick-1", {
      placement_x: 5,
      placement_y: 5,
      placement_rotation: null,
    });
    expect(transform).toContain("rotate(0.00deg)");
  });

  it("positions in percent so a TV and a laptop agree", () => {
    const { transform } = placementStyle("pick-1", {
      placement_x: 10,
      placement_y: 10,
      placement_rotation: 0,
    });
    expect(transform).toContain("%");
    expect(transform).not.toContain("px");
  });
});
