import { Timestamp } from "firebase-admin/firestore";
import { classifyDiff, diffLegacy, parseArgs } from "../../scripts/compare-legacy";
import { summarize } from "../../src/news/newsSync";

const game = (over: Record<string, unknown> = {}) => ({
  api: "1001",
  timestamp: Timestamp.fromMillis(1_790_000_000_000),
  teamhome: { name: "Sporting CP", logo: "https://x/228.png", api: "228" },
  teamaway: { name: "Benfica", logo: "https://x/211.png", api: "211" },
  scorehome: "1",
  scoreaway: "0",
  competition: "Primeira Liga",
  journey: " 11",
  isActive: false,
  ...over,
});

describe("diffLegacy", () => {
  it("documentos iguais: sem diferenças", () => {
    expect(diffLegacy({ "1001": game() }, { "1001": game({ timestamp: Timestamp.fromMillis(1_790_000_000_000) }) }, [])).toEqual({ missing: [], extra: [], changed: [] });
  });

  it("_ingest é sempre ignorado", () => {
    expect(diffLegacy({ "1001": game() }, { "1001": game({ _ingest: "v2027" }) }, []).changed).toEqual([]);
  });

  it("o tipo conta: scorehome '1' vs 1 é uma diferença", () => {
    expect(diffLegacy({ "1001": game() }, { "1001": game({ scorehome: 1 }) }, []).changed).toEqual([{ id: "1001", field: "scorehome", a: "1", b: 1 }]);
  });

  it("id só de um lado: missing (só na antiga) e extra (só na nova)", () => {
    const d = diffLegacy({ "1001": game(), "1002": game({ api: "1002" }) }, { "1001": game(), "1003": game({ api: "1003" }) }, []);
    expect(d.missing).toEqual(["1002"]);
    expect(d.extra).toEqual(["1003"]);
    expect(d.changed).toEqual([]);
  });

  it("campos aninhados aparecem com o caminho completo; campo a mais ou a menos conta", () => {
    const d = diffLegacy({ "1001": game() }, { "1001": game({ teamhome: { name: "Sporting CP", logo: "https://y/crest.png", api: "228" }, extraField: "x" }) }, []);
    expect(d.changed).toEqual([
      { id: "1001", field: "extraField", a: undefined, b: "x" },
      { id: "1001", field: "teamhome.logo", a: "https://x/228.png", b: "https://y/crest.png" },
    ]);
  });

  it("listas comparadas por posição e tamanho", () => {
    const a = { p: { Players: [{ name: "A", goals: 1 }] } };
    const b = { p: { Players: [{ name: "A", goals: 2 }, { name: "B", goals: 0 }] } };
    expect(diffLegacy(a, b, []).changed).toEqual([
      { id: "p", field: "Players.0.goals", a: 1, b: 2 },
      { id: "p", field: "Players.1", a: undefined, b: { name: "B", goals: 0 } },
    ]);
  });

  it("ignore aceita campos de topo e prefixos com ponto", () => {
    const d = diffLegacy(
      { "1001": game() },
      { "1001": game({ isActive: true, endTime: "x", teamhome: { name: "Sporting CP", logo: "z", api: "228" } }) },
      ["isActive", "endTime", "teamhome.logo"],
    );
    expect(d.changed).toEqual([]);
  });

  it("Timestamp com valores diferentes, ou Timestamp contra string, é diferença", () => {
    const t = Timestamp.fromMillis(1_790_000_000_000);
    expect(diffLegacy({ g: { t } }, { g: { t: Timestamp.fromMillis(1_790_000_060_000) } }, []).changed).toHaveLength(1);
    expect(diffLegacy({ g: { t } }, { g: { t: t.toDate().toISOString() } }, []).changed).toHaveLength(1);
  });
});

describe("classifyDiff (diferenças esperadas)", () => {
  it("summaries: playerSub '' contra 'null' é esperada; outro valor não", () => {
    expect(classifyDiff("summaries", { id: "s", field: "playerSub.name", a: "null", b: "" })).toBe("expected");
    expect(classifyDiff("summaries", { id: "s", field: "playerSub.api", a: "", b: "null" })).toBe("expected");
    expect(classifyDiff("summaries", { id: "s", field: "playerSub.name", a: "Trincão", b: "" })).toBe("unexpected");
  });

  it("players: contadores 0, '' e null/undefined são equivalentes", () => {
    expect(classifyDiff("players", { id: "p", field: "Players.3.goals", a: null, b: 0 })).toBe("expected");
    expect(classifyDiff("players", { id: "p", field: "Players.3.saves", a: undefined, b: "" })).toBe("expected");
    expect(classifyDiff("players", { id: "p", field: "Players.3.goals", a: 1, b: 0 })).toBe("unexpected");
    expect(classifyDiff("players", { id: "p", field: "Players.3.name", a: null, b: "" })).toBe("unexpected");
  });

  it("news: sport e publishedAt são campos novos", () => {
    expect(classifyDiff("news", { id: "n", field: "publishedAt", a: undefined, b: "2026-12-01" })).toBe("expected");
    expect(classifyDiff("news", { id: "n", field: "sport", a: undefined, b: "football" })).toBe("expected");
    expect(classifyDiff("news", { id: "n", field: "title", a: "a", b: "b" })).toBe("unexpected");
    const content = "palavra ".repeat(80).trim();
    expect(classifyDiff("news", { id: "n", field: "summary", a: content, b: summarize(content) }, { content })).toBe("expected");
    expect(classifyDiff("news", { id: "n", field: "summary", a: content, b: "outro" }, { content })).toBe("unexpected");
  });

  it("games: o logótipo do Sporting passa a ser o emblema de 2026", () => {
    expect(classifyDiff("games", { id: "g", field: "teamhome.logo", a: "https://media.api-sports.io/football/teams/228.png", b: "https://s360-prognostico-download.web.app/brand/sporting-cp-2026.png" })).toBe("expected");
    expect(classifyDiff("games", { id: "g", field: "teamhome.logo", a: "https://media.api-sports.io/football/teams/211.png", b: "https://other/211.png" })).toBe("unexpected");
  });
});

describe("parseArgs", () => {
  it("exige --project e um --since ISO válido", () => {
    expect(parseArgs(["--project", "scp360-37a74", "--since", "2026-12-04T10:00:00Z"])).toMatchObject({ project: "scp360-37a74", since: new Date("2026-12-04T10:00:00Z") });
    expect(() => parseArgs(["--project", "scp360-37a74"])).toThrow();
    expect(() => parseArgs(["--project", "scp360-37a74", "--since", "ontem"])).toThrow();
    expect(() => parseArgs(["--since", "2026-12-04T10:00:00Z"])).toThrow();
  });
});
