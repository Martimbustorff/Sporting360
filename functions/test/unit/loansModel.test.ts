import { computeExpiresAt, isLoanActive, newLoanId } from "../../src/loans/model";

const H = 3600 * 1000;
const kickoff = new Date("2026-12-01T20:00:00Z");
const finishedAt = new Date("2026-12-01T21:55:00Z");
const base = { kickoff, finishedAt: null, postponedWithoutDate: false };

describe("computeExpiresAt", () => {
  it.each(["NS", "LIVE", "HT"])("%s: início + 4 h", (status) => {
    expect(computeExpiresAt({ ...base, status }).getTime()).toBe(kickoff.getTime() + 4 * H);
  });
  it.each(["FT", "AET", "PEN"])("%s: fim + 2 h", (status) => {
    expect(computeExpiresAt({ ...base, status, finishedAt }).getTime()).toBe(finishedAt.getTime() + 2 * H);
  });
  it("terminado sem finishedAt cai para início + 4 h", () => {
    expect(computeExpiresAt({ ...base, status: "FT" }).getTime()).toBe(kickoff.getTime() + 4 * H);
  });
  it.each(["PST", "CANC"])("%s sem nova data: hora original + 2 h", (status) => {
    expect(computeExpiresAt({ ...base, status, postponedWithoutDate: true }).getTime()).toBe(kickoff.getTime() + 2 * H);
  });
  it("CANC dá sempre início + 2 h, mesmo sem a marca postponedWithoutDate", () => {
    expect(computeExpiresAt({ ...base, status: "CANC" }).getTime()).toBe(kickoff.getTime() + 2 * H);
  });
  it("adiado com nova data segue a hora remarcada (+ 4 h)", () => {
    expect(computeExpiresAt({ ...base, status: "PST" }).getTime()).toBe(kickoff.getTime() + 4 * H);
  });
});

describe("isLoanActive", () => {
  const now = new Date("2026-12-01T21:00:00Z");
  const exp = (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }) as never;
  it("ativo antes de expirar e sem cancelamento", () => {
    expect(isLoanActive({ cancelledAt: null, expiresAt: exp(new Date(now.getTime() + 1)) }, now)).toBe(true);
  });
  it("falso com cancelledAt", () => {
    expect(isLoanActive({ cancelledAt: exp(now), expiresAt: exp(new Date(now.getTime() + H)) }, now)).toBe(false);
  });
  it("falso com expiresAt <= now", () => {
    expect(isLoanActive({ cancelledAt: null, expiresAt: exp(now) }, now)).toBe(false);
    expect(isLoanActive({ cancelledAt: null, expiresAt: exp(new Date(now.getTime() - 1)) }, now)).toBe(false);
  });
});

describe("newLoanId", () => {
  it("22 caracteres base64url e únicos", () => {
    const a = newLoanId();
    const b = newLoanId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a).not.toBe(b);
  });
});
