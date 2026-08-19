import { describe, expect, it } from "vitest";
import { DRAFT_START_ISO, DRAFT_START_MS, draftClock } from "./draft-clock";

const at = (iso: string) => Date.parse(iso);

describe("DRAFT_START", () => {
  it("is 5:00 PM Pacific on Saturday 29 August 2026", () => {
    // The constant is written in UTC, so this asserts it lands where the
    // league thinks it does. A silent hour out here means the door opens
    // while everyone is still eating.
    const target = new Date(DRAFT_START_MS);
    const pacific = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(target);

    expect(pacific).toBe("Saturday, August 29, 2026 at 5:00 PM");
  });

  it("parses", () => {
    expect(Number.isNaN(Date.parse(DRAFT_START_ISO))).toBe(false);
  });
});

describe("draftClock", () => {
  it("breaks the remaining time into days, hours, minutes and seconds", () => {
    const now = at("2026-08-19T10:33:04Z");
    expect(draftClock(now)).toEqual({
      open: false,
      days: "10",
      hours: "13",
      minutes: "26",
      seconds: "56",
    });
  });

  it("pads every field to two digits so the boxes never reflow", () => {
    // One day, one hour, one minute and one second out.
    const now = DRAFT_START_MS - (86400 + 3600 + 60 + 1) * 1000;
    expect(draftClock(now)).toMatchObject({
      days: "01",
      hours: "01",
      minutes: "01",
      seconds: "01",
    });
  });

  it("stays locked right up to the target", () => {
    expect(draftClock(DRAFT_START_MS - 1).open).toBe(false);
    expect(draftClock(DRAFT_START_MS - 1)).toMatchObject({
      days: "00",
      hours: "00",
      minutes: "00",
      seconds: "00",
    });
  });

  it("opens exactly on the target and stays open", () => {
    expect(draftClock(DRAFT_START_MS).open).toBe(true);
    expect(draftClock(DRAFT_START_MS + 1).open).toBe(true);
    // Mid-draft, hours later. The door does not swing shut again.
    expect(draftClock(at("2026-08-29T23:30:00-07:00")).open).toBe(true);
  });

  it("never counts backwards past zero", () => {
    // A phone whose clock is a day fast must not show 23:59:59 and
    // rising - it shows an open draft, which is the safe wrong answer.
    expect(draftClock(DRAFT_START_MS + 86400_000)).toEqual({
      open: true,
      days: "00",
      hours: "00",
      minutes: "00",
      seconds: "00",
    });
  });

  it("takes an explicit target so the page can be tested at any date", () => {
    const target = at("2030-01-01T00:00:00Z");
    expect(draftClock(target - 90_000, target)).toMatchObject({
      open: false,
      minutes: "01",
      seconds: "30",
    });
  });
});
