import { logger } from "firebase-functions";
import { crestFor } from "../config/brand";
import type { GameStatus } from "../game/types";
import { roundLabel } from "../model/labels";
import { FINAL_STATUSES, footballStatus } from "../model/status";
import type { CompetitionType, TeamRef } from "../model/types";
import type { AfFixtureCore } from "../sources/apiFootball.types";

/** Item de `competitions/{key}/data/fixtures`. `score.home/away` já inclui o prolongamento. */
export interface FixtureItem {
  id: string;
  kickoff: Date;
  round: string;
  roundLabel: string | null;
  home: TeamRef;
  away: TeamRef;
  status: GameStatus;
  score: {
    home: number | null;
    away: number | null;
    /** Golos só do prolongamento (já contados em home/away). */
    extraHome: number | null;
    extraAway: number | null;
    penaltyHome: number | null;
    penaltyAway: number | null;
  };
}

export function toFixtureItems(fixtures: AfFixtureCore[], type: CompetitionType): FixtureItem[] {
  return fixtures.map((f) => ({
    id: String(f.fixture.id),
    kickoff: new Date(f.fixture.date),
    round: f.league.round,
    roundLabel: roundLabel(f.league.round, type),
    home: { id: String(f.teams.home.id), name: f.teams.home.name, logo: crestFor(f.teams.home.id, f.teams.home.logo ?? null) },
    away: { id: String(f.teams.away.id), name: f.teams.away.name, logo: crestFor(f.teams.away.id, f.teams.away.logo ?? null) },
    status: footballStatus(f.fixture.status.short),
    score: {
      home: f.goals.home,
      away: f.goals.away,
      extraHome: f.score?.extratime?.home ?? null,
      extraAway: f.score?.extratime?.away ?? null,
      penaltyHome: f.score?.penalty?.home ?? null,
      penaltyAway: f.score?.penalty?.away ?? null,
    },
  }));
}

export type Stage = "table" | "knockout";

/** Tabela (campeonato, fase de liga, grupos), eliminatória, ou `null` se a ronda não se reconhece. */
export function stageOf(rawRound: string | null): Stage | null {
  if (rawRound === null) return null;
  const t = rawRound.trim();
  if (/^(?:regular season|league stage|group stage|group [a-z0-9]+)\s*-\s*\d+$/i.test(t)) return "table";
  if (
    /^round of \d+$/i.test(t) ||
    /^\d+(?:st|nd|rd|th)\s+round$/i.test(t) ||
    /^(?:knockout round )?play-?offs?$/i.test(t) ||
    /^(?:quarter|semi)[- ]?finals?$/i.test(t) ||
    /^final$/i.test(t) ||
    /^\d+(?:st|nd|rd|th)\s+finals?$/i.test(t) ||
    /^1\/\d+[\s-]*finals?$/i.test(t) ||
    /^(?:(?:\d+(?:st|nd|rd|th)\s+)?qualifying|preliminary) round$/i.test(t)
  ) {
    return "knockout";
  }
  return null;
}

const warned = new Set<string>();

/**
 * `stageOf` com rede de segurança para rondas que não se reconhecem: numa taça ou supertaça é
 * eliminatória; numa europeia é eliminatória se vier depois (pela ordem da API) da última ronda de
 * tabela. Avisa uma vez por ronda não reconhecida.
 */
export function classifyRound(raw: string | null, type: CompetitionType, order: string[]): Stage | null {
  if (raw === null) return null;
  const strict = stageOf(raw);
  if (strict) return strict;
  if (!warned.has(raw)) {
    warned.add(raw);
    logger.warn(`ronda não reconhecida: "${raw}" (${type})`);
  }
  if (type === "cup" || type === "supercup") return "knockout";
  if (type === "europe") {
    const lastTable = order.reduce((acc, r, i) => (stageOf(r) === "table" ? i : acc), -1);
    if (lastTable >= 0 && order.indexOf(raw) > lastTable) return "knockout";
  }
  return null;
}

export type Tie = {
  id: string;
  stage: string;
  home: TeamRef;
  away: TeamRef;
  legs: {
    matchId: string;
    /** Equipa da casa nesse jogo (o `score` da mão é do ponto de vista dela). Campo novo: docs antigos não o têm. */
    homeId: string;
    kickoff: string;
    status: string;
    score: { home: number | null; away: number | null; penaltyHome: number | null; penaltyAway: number | null };
  }[];
  aggregate: { home: number; away: number } | null;
  winnerTeamId: string | null;
  sportingInvolved: boolean;
};

export type Bracket = { stages: { label: string; raw: string; ties: Tie[] }[] };

const SPORTING_ID = "228";

function buildTie(stage: string, legs: FixtureItem[]): Tie {
  const sorted = [...legs].sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  const first = sorted[0];
  const home = first.home;
  const away = first.away;

  let aggregate: Tie["aggregate"] = null;
  let winnerTeamId: string | null = null;
  const done = sorted.every((l) => FINAL_STATUSES.has(l.status) && l.score.home !== null && l.score.away !== null);
  if (done) {
    let h = 0;
    let a = 0;
    for (const l of sorted) {
      if (l.home.id === home.id) {
        h += l.score.home!;
        a += l.score.away!;
      } else {
        h += l.score.away!;
        a += l.score.home!;
      }
    }
    aggregate = { home: h, away: a };
    if (h !== a) {
      winnerTeamId = h > a ? home.id : away.id;
    } else {
      const last = sorted[sorted.length - 1];
      const ph = last.score.penaltyHome;
      const pa = last.score.penaltyAway;
      if (ph !== null && pa !== null && ph !== pa) winnerTeamId = ph > pa ? last.home.id : last.away.id;
    }
  }

  return {
    id: first.id,
    stage,
    home,
    away,
    legs: sorted.map((l) => ({
      matchId: l.id,
      homeId: l.home.id,
      kickoff: l.kickoff.toISOString(),
      status: l.status,
      score: { home: l.score.home, away: l.score.away, penaltyHome: l.score.penaltyHome, penaltyAway: l.score.penaltyAway },
    })),
    aggregate,
    winnerTeamId,
    sportingInvolved: home.id === SPORTING_ID || away.id === SPORTING_ID,
  };
}

/**
 * Só os jogos de eliminatória. Etapas pela ordem de `rawRounds` (rondas da API); as que lá não
 * estiverem seguem pela data do primeiro jogo. As duas mãos de uma eliminatória (mesmo par de equipas
 * na mesma etapa) ficam numa só `Tie`.
 */
export function buildBracket(items: FixtureItem[], rawRounds: string[] = [], type: CompetitionType = "league"): Bracket {
  const order = rawRounds.length > 0 ? rawRounds : [...new Set([...items].sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime()).map((i) => i.round))];
  const byStage = new Map<string, FixtureItem[]>();
  for (const it of items) {
    if (classifyRound(it.round, type, order) !== "knockout") continue;
    const list = byStage.get(it.round) ?? [];
    list.push(it);
    byStage.set(it.round, list);
  }
  const firstKickoff = (raw: string) => Math.min(...byStage.get(raw)!.map((i) => i.kickoff.getTime()));
  const raws = [...byStage.keys()].sort((a, b) => {
    const ia = rawRounds.indexOf(a);
    const ib = rawRounds.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return firstKickoff(a) - firstKickoff(b);
  });

  return {
    stages: raws.map((raw) => {
      const list = byStage.get(raw)!;
      const pairs = new Map<string, FixtureItem[]>();
      for (const it of list) {
        const k = [it.home.id, it.away.id].sort().join("|");
        pairs.set(k, [...(pairs.get(k) ?? []), it]);
      }
      const ties = [...pairs.values()].map((legs) => buildTie(raw, legs)).sort((a, b) => a.legs[0].kickoff.localeCompare(b.legs[0].kickoff) || a.id.localeCompare(b.id));
      return { label: list[0].roundLabel ?? raw, raw, ties };
    }),
  };
}

export type CompetitionView = { primary: "table" | "bracket"; hasTable: boolean; hasBracket: boolean; currentStage: string | null };

/**
 * `bracket` só havendo eliminatórias, e quando a ronda atual é de eliminatória, não há linhas de
 * tabela, ou a competição acabou (sem ronda atual) e a última ronda é de eliminatória. Senão `table`.
 */
export function competitionView(type: CompetitionType, currentRaw: string | null, hasTableRows: boolean, hasKnockout: boolean, rounds: string[] = []): CompetitionView {
  const cur = classifyRound(currentRaw, type, rounds);
  const finishedInKnockout = currentRaw === null && rounds.length > 0 && classifyRound(rounds[rounds.length - 1], type, rounds) === "knockout";
  const primary = hasKnockout && (cur === "knockout" || !hasTableRows || finishedInKnockout) ? "bracket" : "table";
  return { primary, hasTable: hasTableRows, hasBracket: hasKnockout, currentStage: roundLabel(currentRaw, type) };
}
