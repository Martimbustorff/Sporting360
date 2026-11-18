import { periodKeys } from "../../src/time/periods";

describe("periodKeys", () => {
  it("Monday in Lisbon belongs to the new week", () => {
    expect(periodKeys(new Date("2026-11-16T23:30:00Z"))).toEqual({
      week: "2026-W47", month: "2026-11", season: "2026-2027",
    });
  });
  it("season boundary follows Lisbon summer time", () => {
    expect(periodKeys(new Date("2026-06-30T22:59:00Z")).season).toBe("2025-2026");
    expect(periodKeys(new Date("2026-06-30T23:00:00Z")).season).toBe("2026-2027");
  });
  it("ISO week year differs from calendar year", () => {
    const k = periodKeys(new Date("2027-01-01T00:30:00Z"));
    expect(k.week).toBe("2026-W53");
    expect(k.month).toBe("2027-01");
  });
});

describe("periodKeys deferred minors", () => {
  it("ISO week boundaries in Lisbon", () => {
    expect(periodKeys(new Date("2026-07-12T23:30:00Z")).week).toBe("2026-W29");
    expect(periodKeys(new Date("2026-12-27T23:30:00Z")).week).toBe("2026-W52");
    expect(periodKeys(new Date("2026-12-28T00:00:00Z")).week).toBe("2026-W53");
  });
  it("season spans the calendar year change", () => {
    expect(periodKeys(new Date("2026-12-15T12:00:00Z")).season).toBe("2026-2027");
    expect(periodKeys(new Date("2027-01-15T12:00:00Z")).season).toBe("2026-2027");
  });
});
