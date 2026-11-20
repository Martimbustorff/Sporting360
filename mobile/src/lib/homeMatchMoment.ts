// Momento do jogo na Home (Plano 7, Tarefa 4; Figma 01, 01b, 01c, 07a, 07b, 07c). Regras puras, sem React nem Firestore.
// "Hoje" é sempre o dia civil em Europe/Lisbon (ptDate.lisbonParts), também no horário de verão.
import type { Match } from '@/data/schemas';
import { lisbonParts } from '@/lib/ptDate';

export type HomeMomentState = 'next' | 'none' | 'loading' | 'matchday' | 'live' | 'finished';
export type HomeMomentAction = { label: 'PROGNÓSTICO' | 'VER JOGO' | 'VOTA NO MVP'; href: string };
export type HomeMoment = { state: HomeMomentState; action: HomeMomentAction | null; countdownTo: Date | null };

export type HomeMomentInput = {
  match: Match | null;
  now: Date;
  /** Prognóstico ainda aberto (gameWindows.predictionOpen). */
  predictionOpen: boolean;
  /** Votação do MVP aberta (gameWindows.mvpWindow(...).state === 'open'). */
  mvpOpen: boolean;
  /** O utilizador já votou neste jogo. */
  votedMvp: boolean;
  /** A ler o jogo (cartão em esqueleto). Opcional: por omissão false. */
  loading?: boolean;
};

const HOUR = 3_600_000;
/** Mesma folga da query da Home: um jogo por abrir há mais de 4 h deixa de contar (feed parado). */
const OPEN_GRACE_MS = 4 * HOUR;
const FINISHED = ['FT', 'AET', 'PEN'] as const;

const isFinished = (m: Pick<Match, 'status'>): boolean => (FINISHED as readonly string[]).includes(m.status);

/** Número do dia civil de Lisboa, comparável entre instantes. */
function lisbonDay(d: Date): number {
  const p = lisbonParts(d);
  return Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;
}

const sameLisbonDay = (a: Date, b: Date): boolean => lisbonDay(a) === lisbonDay(b);

const open = (m: Match): HomeMomentAction => ({ label: 'VER JOGO', href: `/jogo/${m.id}` });

export function homeMatchMoment(input: HomeMomentInput): HomeMoment {
  const { match: m, now, predictionOpen, mvpOpen, votedMvp, loading } = input;
  if (loading) return { state: 'loading', action: null, countdownTo: null };
  if (!m) return { state: 'none', action: null, countdownTo: null };

  const next: HomeMoment = { state: 'next', action: null, countdownTo: null };
  if (m.status === 'PST' || m.status === 'CANC') return next;
  if (m.status === 'LIVE' || m.status === 'HT') return { state: 'live', action: open(m), countdownTo: null };

  if (isFinished(m)) {
    // Até ao fim do dia (Lisboa) em que o jogo acabou; depois o cartão deixa de o mostrar.
    if (!sameLisbonDay(m.finishedAt ?? m.kickoff, now)) return { state: 'none', action: null, countdownTo: null };
    const vote = mvpOpen && !votedMvp;
    return {
      state: 'finished',
      action: vote ? { label: 'VOTA NO MVP', href: `/jogo/${m.id}?tab=mvp` } : open(m),
      countdownTo: null,
    };
  }

  // NS com o apito já passado (o feed ainda não passou a LIVE): "próximo" com Ver jogo, sem contagem (o relógio pára).
  if (m.kickoff.getTime() <= now.getTime()) return { state: 'next', action: open(m), countdownTo: null };

  // NS: dia de jogo só no próprio dia, em Lisboa, e antes do apito.
  if (sameLisbonDay(m.kickoff, now)) {
    return {
      state: 'matchday',
      action: predictionOpen ? { label: 'PROGNÓSTICO', href: `/jogo/${m.id}?tab=sumario` } : null,
      countdownTo: m.kickoff,
    };
  }
  return next;
}

/**
 * O jogo que o cartão mostra, a partir dos jogos (ordenados por apito) desde ontem: o primeiro que esteja ao vivo,
 * por abrir (NS/PST com apito até 4 h atrás ou no futuro) ou terminado hoje em Lisboa. Cancelados nunca.
 */
export function pickHomeMatch(matches: readonly Match[], now: Date): Match | null {
  return (
    matches.find((m) => {
      if (m.status === 'CANC') return false;
      if (m.status === 'LIVE' || m.status === 'HT') return true;
      if (isFinished(m)) return sameLisbonDay(m.finishedAt ?? m.kickoff, now);
      return m.kickoff.getTime() >= now.getTime() - OPEN_GRACE_MS;
    }) ?? null
  );
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "02:14:37": horas, minutos e segundos (a hora não dá a volta aos 24); nunca negativo, arredonda para baixo. */
export function countdownClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
