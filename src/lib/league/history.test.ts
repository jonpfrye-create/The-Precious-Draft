import { describe, expect, it } from "vitest";
import {
  HARDWARE,
  currentSeasonNumber,
  toRoman,
  type Competition,
} from "./history";

const byKey = (key: string): Competition => {
  const found = HARDWARE.find((c) => c.key === key);
  if (!found) throw new Error(`no competition ${key}`);
  return found;
};

describe("league history", () => {
  it("covers the three competitions", () => {
    expect(HARDWARE.map((c) => c.key)).toEqual([
      "precious",
      "leftovers",
      "microwave",
    ]);
  });

  it("runs from each competition's first year to 2025 with no gaps", () => {
    // A missing year would render as a silent hole in a table people
    // were present for.
    const spans: [string, number, number][] = [
      ["precious", 2009, 2025],
      ["leftovers", 2021, 2025],
      ["microwave", 2023, 2025],
    ];

    for (const [key, from, to] of spans) {
      const years = byKey(key).seasons.map((s) => s.year);
      const expected = [];
      for (let y = to; y >= from; y--) expected.push(y);
      expect(years, key).toEqual(expected);
    }
  });

  it("lists newest first", () => {
    for (const comp of HARDWARE) {
      const years = comp.seasons.map((s) => s.year);
      expect(years, comp.key).toEqual([...years].sort((a, b) => b - a));
    }
  });

  it("gives every season three distinct, non-empty finishers", () => {
    for (const comp of HARDWARE) {
      for (const season of comp.seasons) {
        const podium = [season.first, season.second, season.third];
        const where = `${comp.key} ${season.year}`;

        for (const name of podium) {
          expect(name.trim(), where).not.toBe("");
          expect(name, where).toBe(name.trim());
        }

        // The same team cannot take two places in one year.
        expect(new Set(podium).size, where).toBe(3);
      }
    }
  });

  it("uses one style of apostrophe throughout", () => {
    // Mixed straight and curly quotes in a list of proper nouns reads as
    // carelessness, and these names are the point of the section.
    for (const comp of HARDWARE) {
      for (const season of comp.seasons) {
        for (const name of [season.first, season.second, season.third]) {
          expect(name, `${comp.key} ${season.year}`).not.toContain("'");
        }
      }
    }
  });
});

describe("currentSeasonNumber", () => {
  it("is one past the seasons on record", () => {
    // The poster bills 2026 as Season XVIII. That claim and this table
    // are printed on the same page, so they are derived from one number
    // rather than typed twice.
    expect(byKey("precious").seasons).toHaveLength(17);
    expect(currentSeasonNumber()).toBe(18);
    expect(toRoman(currentSeasonNumber())).toBe("XVIII");
  });
});

describe("toRoman", () => {
  it("handles the subtractive cases", () => {
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(9)).toBe("IX");
    expect(toRoman(14)).toBe("XIV");
    expect(toRoman(19)).toBe("XIX");
    expect(toRoman(40)).toBe("XL");
    expect(toRoman(2026)).toBe("MMXXVI");
  });
});
