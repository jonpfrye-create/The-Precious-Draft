import { describe, expect, it } from "vitest";
import { hexToHue, liveryRotation, MASCOT_HUE } from "./livery";
import { TEAM_PALETTE } from "@/lib/teams/branding";

describe("hexToHue", () => {
  it("finds the primaries", () => {
    expect(hexToHue("#ff0000")).toBeCloseTo(0);
    expect(hexToHue("#00ff00")).toBeCloseTo(120);
    expect(hexToHue("#0000ff")).toBeCloseTo(240);
  });

  it("returns a hue in range for grey, rather than NaN", () => {
    // NaN would become `hue-rotate(NaNdeg)`, which browsers drop - the
    // runner would silently stay orange.
    for (const grey of ["#000000", "#ffffff", "#808080"]) {
      expect(Number.isFinite(hexToHue(grey)), grey).toBe(true);
    }
  });

  it("copes with or without the leading hash", () => {
    expect(hexToHue("ff0000")).toBe(hexToHue("#ff0000"));
  });
});

describe("liveryRotation", () => {
  it("leaves the mascot alone when the team is already its colour", () => {
    expect(Math.abs(liveryRotation("#e8a33d") - 0)).toBeLessThan(20);
  });

  it("gives every palette colour a finite rotation", () => {
    for (const colour of TEAM_PALETTE) {
      const rotation = liveryRotation(colour.hex);
      expect(Number.isFinite(rotation), colour.hex).toBe(true);
      expect(Math.abs(rotation)).toBeLessThanOrEqual(360 + MASCOT_HUE);
    }
  });

  it("tells the palette apart", () => {
    // If two teams rotate to the same place their mascots are
    // indistinguishable, and the race stops being readable.
    const rotations = TEAM_PALETTE.map((c) => Math.round(liveryRotation(c.hex)));
    expect(new Set(rotations).size).toBeGreaterThan(TEAM_PALETTE.length / 2);
  });
});
