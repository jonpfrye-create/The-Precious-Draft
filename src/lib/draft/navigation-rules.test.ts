import { describe, expect, it } from "vitest";
import { destinationFor } from "./navigation-rules";

describe("destinationFor", () => {
  it("sends you to the board while a phase is being drafted", () => {
    expect(destinationFor(true, 1)).toBe("/commish/board");
    expect(destinationFor(true, 3)).toBe("/commish/board");
  });

  it("sends a brand new league to setup", () => {
    expect(destinationFor(false, 0)).toBe("/commish/setup");
  });

  it("still routes an unfinished draft to the next phase", () => {
    // The regression: completing the Main draft used to land on a blank
    // new-league form, which read as the league having been wiped and
    // would have created a second league if submitted.
    expect(destinationFor(false, 1)).toBe("/commish/next-phase");
    expect(destinationFor(false, 2)).toBe("/commish/next-phase");
  });

  it("never sends an existing league to setup", () => {
    for (let phases = 1; phases <= 3; phases++) {
      expect(destinationFor(false, phases)).not.toBe("/commish/setup");
    }
  });

  it("sends a finished draft back to the board, not to a dead end", () => {
    // All three phases done. Sending this to next-phase produced a page
    // whose only link bounced straight back to it.
    expect(destinationFor(false, 3)).toBe("/commish/board");
  });
});
