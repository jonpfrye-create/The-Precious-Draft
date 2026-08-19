import { describe, expect, it } from "vitest";
import { POSITIONS } from "./positions";

describe("POSITIONS", () => {
  it("is exactly the six real positions, with no sentinel at the front", () => {
    // A drafter screen once did POSITIONS.slice(1) on the assumption that
    // an "all" entry led the list. It does not, so the slice dropped QB
    // and every quarterback in the draft rendered as unrosterable. Any
    // "all" tab has to be a separate constant in the component that wants
    // one, never an entry here.
    expect(POSITIONS).toEqual(["QB", "RB", "WR", "TE", "K", "DEF"]);
    expect(POSITIONS[0]).toBe("QB");
  });

  it("has no duplicates", () => {
    expect(new Set(POSITIONS).size).toBe(POSITIONS.length);
  });
});
