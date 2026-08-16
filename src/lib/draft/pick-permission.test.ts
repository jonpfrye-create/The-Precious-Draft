import { describe, expect, it } from "vitest";
import { checkPickPermission, refusalMessage } from "./pick-permission";

const BASE = {
  isCommissioner: false,
  claimedTeamId: null as string | null,
  forTeamId: "team-a",
  onClockTeamId: "team-a",
  phaseIsComplete: false,
};

describe("checkPickPermission", () => {
  it("lets a drafter pick for their own team on their turn", () => {
    expect(
      checkPickPermission({ ...BASE, claimedTeamId: "team-a" })
    ).toEqual({ allowed: true });
  });

  it("refuses a drafter picking for somebody else", () => {
    // The whole point of claims: holding the league code must not let you
    // draft for the person sitting next to you.
    expect(
      checkPickPermission({
        ...BASE,
        claimedTeamId: "team-b",
        forTeamId: "team-a",
      })
    ).toEqual({ allowed: false, reason: "not-your-team" });
  });

  it("refuses a drafter picking out of turn", () => {
    expect(
      checkPickPermission({
        ...BASE,
        claimedTeamId: "team-a",
        onClockTeamId: "team-b",
      })
    ).toEqual({ allowed: false, reason: "not-your-turn" });
  });

  it("refuses someone with no claim at all", () => {
    expect(checkPickPermission(BASE)).toEqual({
      allowed: false,
      reason: "no-claim",
    });
  });

  it("says not-your-team before not-your-turn", () => {
    // Both are wrong at once. Reporting the clock would imply the team
    // might become theirs later, which it never will.
    expect(
      checkPickPermission({
        ...BASE,
        claimedTeamId: "team-b",
        forTeamId: "team-a",
        onClockTeamId: "team-c",
      }).reason
    ).toBe("not-your-team");
  });

  it("lets the commissioner pick for anyone, on anyone's turn", () => {
    // Somebody's phone will die and the draft cannot stop for it.
    expect(
      checkPickPermission({
        ...BASE,
        isCommissioner: true,
        claimedTeamId: null,
        forTeamId: "team-c",
        onClockTeamId: "team-a",
      })
    ).toEqual({ allowed: true });
  });

  it("closes a finished phase to the commissioner too", () => {
    expect(
      checkPickPermission({
        ...BASE,
        isCommissioner: true,
        phaseIsComplete: true,
      })
    ).toEqual({ allowed: false, reason: "phase-complete" });
  });

  it("refuses everyone when nobody is on the clock", () => {
    expect(
      checkPickPermission({
        ...BASE,
        claimedTeamId: "team-a",
        onClockTeamId: null,
      }).allowed
    ).toBe(false);
  });

  it("has a message for every refusal", () => {
    for (const reason of [
      "phase-complete",
      "not-your-team",
      "not-your-turn",
      "no-claim",
    ] as const) {
      expect(refusalMessage(reason).length).toBeGreaterThan(0);
    }
  });
});
