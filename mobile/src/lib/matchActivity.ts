// Jogo no ecrã de bloqueio (Plano 10, ponto 2). Conteúdo da Live Activity "MatchActivity" (widgets/MatchActivity.tsx),
// igual ao que o servidor envia (functions/src/liveActivity/props.ts): a app usa-o quando arranca a atividade sozinha
// (iOS sem "push-to-start" ou jogo já a decorrer ao abrir a app). Os emblemas são ficheiros na pasta partilhada.
import type { EventItem, Match } from '@/data/schemas';

export type MatchActivityProps = {
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
  /** Epoch (ms) do minuto 0, para o relógio a contar; null com a bola parada. */
  clockFrom: number | null;
  minute: string;
  lastGoal: string | null;
};

export const CREST_FILE = (teamId: string) => `crest_${teamId}.png`;

const PHASES: Record<string, { label: string; running: boolean }> = {
  '1H': { label: '1.ª PARTE', running: true },
  '2H': { label: '2.ª PARTE', running: true },
  ET: { label: 'PROLONGAMENTO', running: true },
  HT: { label: 'INTERVALO', running: false },
  BT: { label: 'INTERVALO', running: false },
  P: { label: 'PENÁLTIS', running: false },
};
const FALLBACK = { label: 'AO VIVO', running: true };

function phaseOf(m: Match): { label: string; running: boolean } {
  if (m.status === 'FT' || m.status === 'AET' || m.status === 'PEN') return { label: 'FINAL', running: false };
  if (m.status === 'HT') return { label: 'INTERVALO', running: false };
  return PHASES[(m.statusRaw ?? '').trim().toUpperCase()] ?? FALLBACK;
}

function roundText(m: Match): string | null {
  const n = /(?:regular season|league (?:stage|phase))\s*-\s*(\d+)$/i.exec(m.competition.round ?? '');
  if (n) return `JORNADA ${n[1]}`;
  const label = m.competition.roundLabel ?? m.competition.round;
  return label ? label.toLocaleUpperCase('pt-PT') : null;
}

const shortName = (name: string) => name.replace(/^Sporting CP$/i, 'Sporting').toLocaleUpperCase('pt-PT');
const minuteText = (minute: number, extra: number | null) => (extra ? `${minute}+${extra}'` : `${minute}'`);

function lastGoalText(events: EventItem[]): string | null {
  const last = events
    .filter((e) => e.type === 'goal' && e.detail.toLowerCase() !== 'missed penalty' && e.comments !== 'Penalty Shootout')
    .sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0))
    .at(-1);
  return last ? `${last.playerName ?? ''} ${minuteText(last.minute, last.extra)}`.trim() : null;
}

export function matchActivityProps(m: Match, events: EventItem[], now: Date, dir: string | null): MatchActivityProps {
  const phase = phaseOf(m);
  const crest = (id: string) => (dir ? `${dir}/${CREST_FILE(id)}` : null);
  return {
    matchId: m.id,
    competition: m.competition.name.toLocaleUpperCase('pt-PT'),
    round: roundText(m),
    homeName: shortName(m.home.name),
    awayName: shortName(m.away.name),
    homeCrest: crest(m.home.id),
    awayCrest: crest(m.away.id),
    homeScore: m.score.home ?? 0,
    awayScore: m.score.away ?? 0,
    phase: phase.label,
    clockFrom: phase.running && m.elapsed !== null ? now.getTime() - m.elapsed * 60_000 : null,
    minute: m.elapsed !== null ? minuteText(m.elapsed, m.elapsedExtra) : '',
    lastGoal: lastGoalText(events),
  };
}
