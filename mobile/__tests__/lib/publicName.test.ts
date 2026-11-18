import { validateDisplayName, validAvatarId, publicName } from "@/lib/publicName";


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

describe("publicName", () => {
  it("usa displayName aparado", () => {
    expect(publicName({ displayName: "  Leão 77 " }, "u1")).toBe("Leão 77");
  });
  it("name derivado mostra primeiro nome e inicial do apelido", () => {
    expect(publicName({ name: "MARTIM BUSTORFF" }, "u1")).toBe("Martim B.");
    expect(publicName({ name: "Maria Albuquerque Costa" }, "u1")).toBe("Maria C.");
    expect(publicName({ name: "joão silva" }, "u1")).toBe("João S.");
    expect(publicName({ displayName: "   ", name: "ana pinto" }, "u1")).toBe("Ana P.");
  });
  it("nome de uma só palavra fica como está (Title Case)", () => {
    expect(publicName({ name: "martim" }, "u1")).toBe("Martim");
    expect(publicName({ name: "ÉVORA" }, "u1")).toBe("Évora");
  });
  it("partículas no fim são ignoradas: usa o último apelido que não é partícula", () => {
    expect(publicName({ name: "ana pinto da costa e silva" }, "u1")).toBe("Ana S.");
    expect(publicName({ name: "Rui Costa de" }, "u1")).toBe("Rui C.");
    expect(publicName({ name: "Rui dos Santos" }, "u1")).toBe("Rui S.");
    expect(publicName({ name: "Rui da" }, "u1")).toBe("Rui");
  });
  it("inicial acentuada fica maiúscula", () => {
    expect(publicName({ name: "ana évora" }, "u1")).toBe("Ana É.");
    expect(publicName({ name: "ana órfão" }, "u1")).toBe("Ana Ó.");
  });
  it("emoji no meio é ignorado; emoji no fim não conta como apelido", () => {
    expect(publicName({ name: "Ana 🦁 Pinto Da Costa E Silva" }, "abcd1234")).toBe("Ana S.");
    expect(publicName({ name: "Ana 🦁 Pinto" }, "abcd1234")).toBe("Ana P.");
    expect(publicName({ name: "Leão 🦁" }, "abcd1234")).toBe("Leão");
  });
  it("apelido de uma letra e apelido com hífen", () => {
    expect(publicName({ name: "Ana B" }, "u1")).toBe("Ana B.");
    expect(publicName({ name: "Ana Silva-Pinto" }, "u1")).toBe("Ana S.");
    expect(publicName({ name: "Jo X" }, "u1")).toBe("Jo X.");
  });
  it("nome longo também mostra só primeiro nome e inicial", () => {
    expect(publicName({ name: "MARTIM MARIA DE SOUSA BUSTORFF" }, "abcd1234")).toBe("Martim B.");
  });
  it("displayName escolhido mostra-se como foi escolhido", () => {
    expect(publicName({ displayName: "Ana Pinto", name: "Ana Maria Costa" }, "u1")).toBe("Ana Pinto");
  });
  it("name com @ é tratado como inexistente (nunca expõe email)", () => {
    expect(publicName({ name: "joao@mail.com" }, "abcd1234")).toBe("Sportinguista #1234");
  });
  it("sem nada devolve Sportinguista #<últimos 4 do uid>", () => {
    expect(publicName({}, "abcd1234")).toBe("Sportinguista #1234");
    expect(publicName({ displayName: null, name: null }, "abcd1234")).toBe("Sportinguista #1234");
  });
  it("displayName com @ é ignorado e cai para name ou uid", () => {
    expect(publicName({ displayName: "joao@mail.com", name: "ana pinto" }, "u1")).toBe("Ana P.");
    expect(publicName({ displayName: "joao@mail.com" }, "abcd1234")).toBe("Sportinguista #1234");
  });
  it("name reservado ou inválido cai para o uid", () => {
    expect(publicName({ name: "SPORTINGUISTA #ZZZZ" }, "abcd1234")).toBe("Sportinguista #1234");
    expect(publicName({ name: "Sportinguista Ana" }, "abcd1234")).toBe("Sportinguista #1234");
    expect(publicName({ name: "sportinguista x" }, "abcd1234")).toBe("Sportinguista #1234");
    expect(publicName({ name: "a".repeat(60) }, "abcd1234")).toBe("Sportinguista #1234");
    expect(publicName({ name: "Bartolomeuzinhodasilva Antunes" }, "abcd1234")).toBe("Sportinguista #1234");
    expect(publicName({ name: "ana\u200Bpinto" }, "abcd1234")).toBe("Sportinguista #1234");
    expect(publicName({ name: "🦁 Pinto" }, "abcd1234")).toBe("Sportinguista #1234");
  });
  it("name em NFD mantém o acento da inicial", () => {
    expect(publicName({ name: "ana évora".normalize("NFD") }, "u1")).toBe("Ana É.");
    expect(publicName({ name: "joão silva".normalize("NFD") }, "u1")).toBe("João S.");
  });
  it("iniciais à cabeça são ignoradas quando sobra outra palavra", () => {
    expect(publicName({ name: "D. Maria Costa" }, "u1")).toBe("Maria C.");
    expect(publicName({ name: "j. silva costa" }, "u1")).toBe("Silva C.");
    expect(publicName({ name: "J. Silva" }, "u1")).toBe("Silva");
    expect(publicName({ name: "A B. Pinto" }, "u1")).toBe("Pinto");
  });
  it("displayName inválido também é ignorado", () => {
    expect(publicName({ displayName: "x".repeat(40), name: "ana pinto" }, "u1")).toBe("Ana P.");
  });
});
