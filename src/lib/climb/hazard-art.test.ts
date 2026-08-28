import { describe, expect, it } from "vitest";
import { climbScene, HAZARDS, YETI } from "./climb";
import { HAZARD_ART, hazardColour } from "./hazard-art";
import { rotateCW } from "./paint";

const LEGAL = new Set([".", "k", "a", "b", "c", "w"]);

describe("hazard art", () => {
  it("covers every hazard that can fell a mascot", () => {
    // A hazard with no art fells somebody with nothing visibly doing it,
    // which on the night reads as the mascot having tripped over.
    for (const hazard of [...HAZARDS, YETI]) {
      expect(HAZARD_ART[hazard.id], hazard.id).toBeDefined();
    }
  });

  it("has no art for anything that cannot happen", () => {
    const known = new Set([...HAZARDS.map((h) => h.id), YETI.id]);
    for (const id of Object.keys(HAZARD_ART)) {
      expect(known.has(id), `${id} is drawn but never used`).toBe(true);
    }
  });

  it("is rectangular and uses only characters the renderer knows", () => {
    for (const [id, art] of Object.entries(HAZARD_ART)) {
      const w = art.rows[0]?.length ?? 0;
      expect(w, id).toBeGreaterThan(0);
      art.rows.forEach((row, y) => {
        expect(row.length, `${id} row ${y}: "${row}"`).toBe(w);
        for (const ch of row) {
          expect(LEGAL.has(ch), `${id} row ${y} has "${ch}"`).toBe(true);
        }
      });
    }
  });

  it("gives every hazard a label that says what happened", () => {
    for (const hazard of [...HAZARDS, YETI]) {
      expect(hazard.label, hazard.id).toMatch(/^[A-Z ]+$/);
    }
  });

  it("draws nothing for a blank and something for every colour key", () => {
    const art = HAZARD_ART.boulder;
    expect(hazardColour(".", art)).toBeNull();
    for (const ch of ["k", "a", "b", "c", "w"]) {
      expect(hazardColour(ch, art), ch).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("rotateCW", () => {
  it("turns a standing mascot onto its side without losing a pixel", () => {
    // How the fallen are drawn: the same sprite, lying where it went
    // down.
    const rows = ["ab", "cd", "ef"];
    const turned = rotateCW(rows);
    expect(turned).toEqual(["eca", "fdb"]);
    expect(turned.join("").split("").sort()).toEqual(
      rows.join("").split("").sort()
    );
  });

  it("survives an empty grid", () => {
    expect(rotateCW([])).toEqual([]);
  });
});

describe("there are enough hazards to go round", () => {
  it("never repeats a disaster over a twelve-team climb", () => {
    // Eight hazards and eleven fellings meant the list wrapped and the
    // last two mascots died of something the room had already watched.
    for (const seed of ["a", "b", "phase-1", "2026-08-29", "zzz"]) {
      const teams = Array.from({ length: 12 }, (_, i) => ({
        teamId: `t${i}`,
        name: `T${i}`,
        hex: "#fff",
      }));
      const fellings = teams.map((t, i) => ({ position: i + 1, teamId: t.teamId }));
      const scene = climbScene(teams, fellings, seed);
      const used = scene.climbers
        .map((c) => c.hazard?.id)
        .filter((id): id is string => Boolean(id));
      expect(used.length, seed).toBe(11);
      expect(new Set(used).size, seed).toBe(used.length);
    }
  });

  it("has at least one hazard spare for the largest field it will see", () => {
    // Main is twelve; Leftovers and Microwave are smaller. If a field
    // ever grows, this fails before anybody watches a repeat.
    expect(HAZARDS.length).toBeGreaterThanOrEqual(12 - 2);
  });
});
