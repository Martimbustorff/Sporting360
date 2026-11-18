import type { MatchDoc } from "../../src/model/types";
import { reconcile, toMatchDoc } from "../../src/modalities/freeSourcesSync";
import { teamRef, type NormalizedMatch } from "../../src/sources/free/common";

const NOW = new Date("2026-11-18T12:00:00Z");
const DAY = 86_400_000;
const KICK = new Date("2026-11-22T19:30:00Z");

function nm(o: Partial<NormalizedMatch> & { sourceKey: string; sourceId: string; opponent?: string; sporting?: string; side?: "home" | "away" }): NormalizedMatch {
  const sp = teamRef(o.sporting ?? "Sporting CP");
  const op = teamRef(o.opponent ?? "SL Benfica");
  const side = o.side ?? "home";
  return {
    sport: "roller_hockey",
    season: "2026-2027",
    competition: { id: "campeonato-placard", name: "Campeonato Placard", round: "3ª Jornada", type: "league" },
    kickoff: KICK,
    home: side === "home" ? sp : op,
    away: side === "home" ? op : sp,
    sportingSide: side,
    status: "NS",
    statusRaw: "",
    score: { home: null, away: null },
    venue: null,
    ...o,
  };
}

type Over = Partial<NormalizedMatch> & { sourceId?: string; opponent?: string };
const primary = (o: Over = {}) => nm({ sourceKey: "hp_fpp", sourceId: "493_20", ...o });
const fallback = (o: Over = {}) =>
  nm({ sourceKey: "hoqueipatins", sourceId: "110386", sporting: "Sporting", opponent: "Benfica", competition: { id: "campeonato-placard", name: "Campeonato Placard", round: "0003-Jornada 3", type: "league" }, venue: "Pavilhão João Rocha", attribution: "hoqueipatins.pt", ...o });

const existingDoc = (m: NormalizedMatch, id: string): MatchDoc => ({ ...toMatchDoc(m, id, NOW), id });

describe("reconcile", () => {
  it("o mesmo jogo nas duas fontes (nomes diferentes) → 1 jogo, campos da principal, local da recurso", () => {
    const r = reconcile([], [primary()], [fallback({ kickoff: new Date(KICK.getTime() - DAY) })], "hq", NOW);
    expect(r.used).toBe("merged");
    expect(r.matches).toHaveLength(1);
    const m = r.matches[0];
    expect(m.id).toBe("hq_hp_fpp_493_20");
    expect(m.kickoff).toEqual(KICK);
    expect(m.away.name).toBe("SL Benfica");
    expect(m.competition).toMatchObject({ key: "roller_hockey_campeonato-placard_2026-2027", id: "campeonato-placard", season: "2026-2027", roundLabel: "J3" });
    expect(m.venue).toEqual({ id: null, name: "Pavilhão João Rocha", city: null });
    expect(m.source).toEqual({ provider: "hp_fpp", id: "493_20", fallbackUsed: false, exactKickoff: false, attribution: "hoqueipatins.pt" });
    expect(r.alerts).toEqual([]);
  });

  it("a recurso só preenche nulos: resultado e estado quando a principal não os tem", () => {
    const fin = { status: "FT" as const, score: { home: 4, away: 2 } };
    const r = reconcile([], [primary()], [fallback(fin)], "hq", NOW);
    expect(r.matches[0]).toMatchObject({ status: "FT", score: { home: 4, away: 2 } });
    const r2 = reconcile([], [primary({ status: "FT", score: { home: 4, away: 2 } })], [fallback({ status: "FT", score: { home: 9, away: 9 } })], "hq", NOW);
    expect(r2.matches[0].score).toMatchObject({ home: 4, away: 2 });
    expect(r2.alerts.join(" ")).toMatch(/resultado diferente/);
  });

  it("principal com erro → jogos da recurso, com fallbackUsed e alerta", () => {
    const r = reconcile([], new Error("HTTP 500"), [fallback()], "hq", NOW);
    expect(r.used).toBe("fallback");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].id).toBe("hq_hoqueipatins_110386");
    expect(r.matches[0].source).toMatchObject({ provider: "hoqueipatins", fallbackUsed: true, attribution: "hoqueipatins.pt" });
    expect(r.alerts.join(" ")).toMatch(/principal falhou: HTTP 500/);
  });

  it("principal com erro e jogo já gravado pela principal: a recurso só completa esse documento", () => {
    const prev = existingDoc(primary(), "hq_hp_fpp_493_20");
    const r = reconcile([prev], new Error("x"), [fallback({ status: "FT", score: { home: 3, away: 1 } })], "hq", NOW);
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]).toMatchObject({ id: "hq_hp_fpp_493_20", status: "FT", score: { home: 3, away: 1 }, kickoff: KICK });
    expect(r.matches[0].source).toMatchObject({ provider: "hp_fpp", id: "493_20", fallbackUsed: true });
  });

  it("Review Focus 5: principal com 0 jogos em novembro e 5 existentes → nada removido, alerta", () => {
    const existing = [1, 2, 3, 4, 5].map((i) => existingDoc(primary({ sourceId: `493_${i}`, kickoff: new Date(KICK.getTime() + i * 7 * DAY) }), `hq_hp_fpp_493_${i}`));
    const r = reconcile(existing, [], [], "hq", NOW);
    expect(r.matches).toEqual([]);
    expect(r.used).toBe("none");
    expect(r.alerts.join(" ")).toMatch(/0 jogos nas duas fontes/);
    const r2 = reconcile(existing, [], [fallback()], "hq", NOW);
    expect(r2.alerts.join(" ")).toMatch(/principal devolveu 0 jogos e a recurso 1/);
    expect(r2.used).toBe("fallback");
  });

  it("0 jogos nas duas fontes em julho não alerta (fora de época)", () => {
    expect(reconcile([], [], [], "hq", new Date("2026-07-15T12:00:00Z")).alerts).toEqual([]);
  });

  it("jogo adiado 2 dias na principal → mantém o id existente com a nova hora", () => {
    const fromFallback = existingDoc(fallback(), "hq_hoqueipatins_110386");
    const later = new Date(KICK.getTime() + 2 * DAY);
    const r = reconcile([fromFallback], [primary({ kickoff: later })], new Error("x"), "hq", NOW);
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]).toMatchObject({ id: "hq_hoqueipatins_110386", kickoff: later, source: { provider: "hp_fpp", id: "493_20", fallbackUsed: false } });
    // Mesmo id de fonte: casa pelo id mesmo com outra ronda.
    const prev = existingDoc(primary(), "hq_hp_fpp_493_20");
    const r2 = reconcile([prev], [primary({ kickoff: new Date(KICK.getTime() + 20 * DAY), competition: { id: "campeonato-placard", name: "Campeonato Placard", round: "9ª Jornada", type: "league" } })], [], "hq", NOW);
    expect(r2.matches.map((m) => m.id)).toEqual(["hq_hp_fpp_493_20"]);
  });

  it("C10: série de play-off de 3 jogos com o mesmo adversário em 5 dias → 3 jogos, não fundidos", () => {
    const series = (key: "hp_fpp" | "hoqueipatins", rounds: string[]) =>
      rounds.map((round, i) =>
        nm({
          sourceKey: key,
          sourceId: `${key === "hp_fpp" ? "473_" : "1105"}${i + 1}`,
          opponent: key === "hp_fpp" ? "FC Porto " : "Porto",
          kickoff: new Date(KICK.getTime() + [0, 2, 5][i] * DAY),
          competition: { id: "campeonato-placard", name: "Campeonato Placard", round, type: "league" },
        }),
      );
    const p = series("hp_fpp", ["1/2 Final - Jornada 1", "1/2 Final - Jornada 2", "1/2 Final - Jornada 3"]);
    // Mesma ronda nas duas fontes: cada jogo funde com o seu.
    const r = reconcile([], p, series("hoqueipatins", ["0601-Meias-Finais - Jornada 1", "0602-Meias-Finais - Jornada 2", "0603-Meias-Finais - Jornada 3"]), "hq", NOW);
    expect(r.matches).toHaveLength(3);
    expect(r.matches.map((m) => m.competition.roundLabel)).toEqual(["Meias-finais, jogo 1", "Meias-finais, jogo 2", "Meias-finais, jogo 3"]);
    expect(r.matches.every((m) => m.source.provider === "hp_fpp")).toBe(true);
    // Rondas que não se comparam: na dúvida não funde nem duplica (a recurso não acrescenta).
    const r2 = reconcile([], p, series("hoqueipatins", ["Jogo A", "Jogo B", "Jogo C"]), "hq", NOW);
    expect(r2.matches.map((m) => m.id)).toEqual(["hq_hp_fpp_473_1", "hq_hp_fpp_473_2", "hq_hp_fpp_473_3"]);
    // Segunda execução com os 3 já gravados: os mesmos 3 ids.
    const existing = r.matches;
    const r3 = reconcile(existing, p, [], "hq", NOW);
    expect(r3.matches.map((m) => m.id)).toEqual(["hq_hp_fpp_473_1", "hq_hp_fpp_473_2", "hq_hp_fpp_473_3"]);
  });

  it("jogo só na recurso (sem candidato) entra com fallbackUsed", () => {
    const wse = fallback({ sourceId: "109728", opponent: "Barcelos", kickoff: new Date("2026-11-26T19:00:00Z"), competition: { id: "liga-dos-campeoes-wse", name: "Liga dos Campeões WSE", round: "0001-Jornada 1", type: "europe" } });
    const r = reconcile([], [primary()], [fallback(), wse], "hq", NOW);
    expect(r.matches.map((m) => m.id).sort()).toEqual(["hq_hoqueipatins_109728", "hq_hp_fpp_493_20"]);
    expect(r.matches.find((m) => m.id === "hq_hoqueipatins_109728")!.source).toMatchObject({ fallbackUsed: true, attribution: "hoqueipatins.pt" });
  });
});

describe("toMatchDoc", () => {
  it("final: finishedAt estimado, penáltis e emblema do Sporting", () => {
    const m = toMatchDoc(primary({ status: "PEN", score: { home: 4, away: 4 }, penalty: { home: 3, away: 4 } }), "hq_x", NOW);
    expect(m).toMatchObject({ sport: "roller_hockey", status: "PEN", finishedAtSource: "estimated", sportingSide: "home", score: { home: 4, away: 4, penalty: { home: 3, away: 4 }, halftime: null, extratime: null } });
    expect(m.finishedAt).toEqual(new Date(KICK.getTime() + 110 * 60_000));
    expect(m.home.logo).toMatch(/sporting-cp-2026/);
    expect(m).not.toHaveProperty("venue");
  });
});
