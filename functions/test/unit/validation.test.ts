import { validateDisplayName, validAvatarId } from "../../src/callables/validation";

describe("validateDisplayName", () => {
  it("trims and collapses inner spaces", () => {
    expect(validateDisplayName("  Leão   77 ")).toEqual({ ok: true, value: "Leão 77" });
  });
  it("accepts apostrophe and hyphen", () => {
    expect(validateDisplayName("D'Alva-Sá")).toEqual({ ok: true, value: "D'Alva-Sá" });
  });
  it("accepts exactly 20 code points", () => {
    const v = "Ç".repeat(20);
    expect(validateDisplayName(v)).toEqual({ ok: true, value: v });
  });
  it("normalises NFD to NFC", () => {
    const nfd = "Leão".normalize("NFD");
    expect(nfd).not.toBe("Leão");
    expect(validateDisplayName(nfd)).toEqual({ ok: true, value: "Leão" });
  });
  it("too short", () => {
    expect(validateDisplayName("ab")).toEqual({ ok: false, error: "TOO_SHORT" });
    expect(validateDisplayName("   ")).toEqual({ ok: false, error: "TOO_SHORT" });
    expect(validateDisplayName("")).toEqual({ ok: false, error: "TOO_SHORT" });
  });
  it("too long", () => {
    expect(validateDisplayName("a".repeat(21))).toEqual({ ok: false, error: "TOO_LONG" });
  });
  it("counts code points, not UTF-16 units", () => {
    // 10 astral letters = 20 UTF-16 units but 10 code points: accepted (length is counted in code points).
    expect(validateDisplayName("𝒜".repeat(10))).toEqual({ ok: true, value: "𝒜".repeat(10) });
  });
  it("HAS_AT wins over INVALID_CHARS", () => {
    expect(validateDisplayName("a@b.pt")).toEqual({ ok: false, error: "HAS_AT" });
    expect(validateDisplayName("a@🦁")).toEqual({ ok: false, error: "HAS_AT" });
  });
  it("invalid chars", () => {
    expect(validateDisplayName("Leão 🦁")).toEqual({ ok: false, error: "INVALID_CHARS" });
    expect(validateDisplayName("-abc")).toEqual({ ok: false, error: "INVALID_CHARS" });
  });
  it("reserved fallback prefix", () => {
    expect(validateDisplayName("Sportinguista 7")).toEqual({ ok: false, error: "RESERVED_NAME" });
    expect(validateDisplayName("sportinguista")).toEqual({ ok: false, error: "RESERVED_NAME" });
    expect(validateDisplayName("Sportinguistas")).toEqual({ ok: true, value: "Sportinguistas" });
  });
  it("non-string is TOO_SHORT", () => {
    expect(validateDisplayName(undefined)).toEqual({ ok: false, error: "TOO_SHORT" });
    expect(validateDisplayName(42)).toEqual({ ok: false, error: "TOO_SHORT" });
  });
});

describe("validAvatarId", () => {
  it.each([null, "leao-1", "a", "a".repeat(32)])("accepts %p", (v) => {
    expect(validAvatarId(v)).toBe(true);
  });
  it.each(["X Y", "", "UPPER", "a".repeat(33), "a/b", undefined, 5, {}])("rejects %p", (v) => {
    expect(validAvatarId(v)).toBe(false);
  });
});
