import type { EventItem } from "../football/mapFixture";
import type { MatchDoc } from "../model/types";

// Jogo no ecrã de bloqueio (Plano 10, ponto 2; Figma 53 e 53b). Conteúdo da Live Activity "MatchActivity"
// (mobile/widgets/MatchActivity.tsx). O mesmo formato é construído pela app quando arranca a atividade localmente
// (mobile/src/lib/matchActivity.ts): mudar aqui obriga a mudar lá. Os emblemas são ficheiros na pasta partilhada
// do dispositivo (App Group), por isso o caminho vem de cada dispositivo.

export const ACTIVITY_NAME = "MatchActivity";

export interface MatchActivityProps {
  matchId: string;
  competition: string;
  round: string | null;
  homeName: string;
  awayName: string;
  homeCrest: string | null;
  awayCrest: string | null;
  homeScore: number;
  awayScore: number;
  /** "1.ª PARTE", "INTERVALO", "FINAL"... */
  phase: string;
  /** Epoch (ms) do minuto 0, para o relógio a contar no telemóvel; null quando a bola está parada. */
  clockFrom: number | null;
  /** "67'": o minuto na altura do envio (o relógio continua a contar a partir de `clockFrom`). */
  minute: string;
  /** "Trincão 54'": o último golo do jogo, de qualquer equipa. */
  lastGoal: string | null;
}

const PHASES: Record<string, { label: string; running: boolean }> = {
  "1H": { label: "1.ª PARTE", running: true },
  "2H": { label: "2.ª PARTE", running: true },
  ET: { label: "PROLONGAMENTO", running: true },
  HT: { label: "INTERVALO", running: false },
  BT: { label: "INTERVALO", running: false },
  P: { label: "PENÁLTIS", running: false },
};

export function phaseOf(m: Pick<MatchDoc, "status" | "statusRaw">): { label: string; running: boolean } {
  if (m.status === "FT" || m.status === "AET" || m.status === "PEN") return { label: "FINAL", running: false };
  if (m.status === "HT") return PHASES.HT;
  return PHASES[m.statusRaw.trim().toUpperCase()] ?? { label: "AO VIVO", running: true };
}

export function roundText(m: Pick<MatchDoc, "competition">): string | null {
  const n = /(?:regular season|league (?:stage|phase))\s*-\s*(\d+)$/i.exec(m.competition.round ?? "");
  if (n) return `JORNADA ${n[1]}`;
  const label = m.competition.roundLabel ?? m.competition.round;
  return label ? label.toLocaleUpperCase("pt-PT") : null;
}

/** "Sporting CP" -> "SPORTING" (como no Figma 53); os outros nomes ficam como estão, em maiúsculas. */
const shortName = (name: string) => name.replace(/^Sporting CP$/i, "Sporting").toLocaleUpperCase("pt-PT");

function minuteText(minute: number, extra: number | null): string {
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

function lastGoalText(events: EventItem[]): string | null {
  const goals = events
    .filter((e) => e.type === "goal" && e.detail.toLowerCase() !== "missed penalty" && e.comments !== "Penalty Shootout")
    .sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0));
  const last = goals.at(-1);
  if (!last) return null;
  return `${last.playerName ?? ""} ${minuteText(last.minute, last.extra)}`.trim();
}

export function activityProps(m: MatchDoc, events: EventItem[], now: Date, dir: string | null): MatchActivityProps {
  const phase = phaseOf(m);
  const crest = (id: string) => (dir ? `${dir}/crest_${id}.png` : null);
  return {
    matchId: m.id,
    competition: m.competition.name.toLocaleUpperCase("pt-PT"),
    round: roundText(m),
    homeName: shortName(m.home.name),
    awayName: shortName(m.away.name),
    homeCrest: crest(m.home.id),
    awayCrest: crest(m.away.id),
    homeScore: m.score.home ?? 0,
    awayScore: m.score.away ?? 0,
    phase: phase.label,
    clockFrom: phase.running && m.elapsed !== null ? now.getTime() - m.elapsed * 60_000 : null,
    minute: m.elapsed !== null ? minuteText(m.elapsed, m.elapsedExtra) : "",
    lastGoal: lastGoalText(events),
  };
}

/** O que muda o que se vê (resultado, fase, último golo). O relógio e o minuto contam no telemóvel e não contam aqui. */
export function activitySignature(p: MatchActivityProps): string {
  return JSON.stringify([p.homeScore, p.awayScore, p.phase, p.lastGoal]);
}
