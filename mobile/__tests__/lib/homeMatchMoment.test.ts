// Task 4 (Plano 7): momento do jogo na Home. Regras puras; Lisboa é UTC+0 no inverno e UTC+1 no verão.
import type { GameStatus, Match } from '@/data/schemas';
import { countdownClock, homeMatchMoment, pickHomeMatch } from '@/lib/homeMatchMoment';

const match = (status: GameStatus, kickoff: string, extra: Partial<Match> = {}): Match =>
  ({
    id: '1001',
    sport: 'football',
    competition: { key: 'k', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 11', roundLabel: 'J11' },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '211', name: 'Benfica', logo: null },
    sportingSide: 'home',
    kickoff: new Date(kickoff),
    status,
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: '1001', attribution: null },
    ...extra,
  }) as unknown as Match;

const base = { predictionOpen: false, mvpOpen: false, votedMvp: false };
const at = (iso: string) => new Date(iso);

describe('homeMatchMoment', () => {
  it('a carregar', () => {
    expect(homeMatchMoment({ ...base, match: null, now: at('2026-11-20T10:00:00Z'), loading: true })).toEqual({
      state: 'loading',
      action: null,
      countdownTo: null,
    });
  });

  it('sem jogo agendado', () => {
    expect(homeMatchMoment({ ...base, match: null, now: at('2026-11-20T10:00:00Z') })).toEqual({
      state: 'none',
      action: null,
      countdownTo: null,
    });
  });

  it('jogo noutro dia: próximo, sem ação nem contagem', () => {
    const m = match('NS', '2026-11-22T20:30:00Z');
    expect(homeMatchMoment({ ...base, match: m, now: at('2026-11-20T10:00:00Z'), predictionOpen: true })).toEqual({
      state: 'next',
      action: null,
      countdownTo: null,
    });
  });

  describe('dia do jogo (Europe/Lisbon)', () => {
    const m = match('NS', '2026-11-22T20:30:00Z');
    it('com prognóstico aberto: contagem e ação Prognóstico', () => {
      const r = homeMatchMoment({ ...base, match: m, now: at('2026-11-22T08:00:00Z'), predictionOpen: true });
      expect(r.state).toBe('matchday');
      expect(r.countdownTo).toEqual(m.kickoff);
      expect(r.action).toEqual({ label: 'PROGNÓSTICO', href: '/jogo/1001?tab=prognostico' });
    });
    it('sem prognóstico aberto: contagem sem ação', () => {
      const r = homeMatchMoment({ ...base, match: m, now: at('2026-11-22T08:00:00Z') });
      expect(r).toEqual({ state: 'matchday', action: null, countdownTo: m.kickoff });
    });
    it('23:59 da véspera ainda é "próximo"; 00:01 do dia já é "dia de jogo"', () => {
      expect(homeMatchMoment({ ...base, match: m, now: at('2026-11-21T23:59:00Z') }).state).toBe('next');
      expect(homeMatchMoment({ ...base, match: m, now: at('2026-11-22T00:01:00Z') }).state).toBe('matchday');
    });
    it('no verão a meia-noite de Lisboa é 23:00 UTC', () => {
      const s = match('NS', '2026-07-15T19:00:00Z');
      expect(homeMatchMoment({ ...base, match: s, now: at('2026-07-14T22:59:00Z') }).state).toBe('next');
      expect(homeMatchMoment({ ...base, match: s, now: at('2026-07-14T23:01:00Z') }).state).toBe('matchday');
    });
    it('jogo às 00:30 de Lisboa: a véspera às 23:59 não é dia de jogo', () => {
      const late = match('NS', '2026-11-22T00:30:00Z');
      expect(homeMatchMoment({ ...base, match: late, now: at('2026-11-21T23:59:00Z') }).state).toBe('next');
      expect(homeMatchMoment({ ...base, match: late, now: at('2026-11-22T00:01:00Z') }).state).toBe('matchday');
    });
    it('hora do apito passada mas ainda NS no mesmo dia: continua dia de jogo (contagem a zero)', () => {
      const r = homeMatchMoment({ ...base, match: m, now: at('2026-11-22T20:31:00Z') });
      expect(r.state).toBe('matchday');
    });
  });

  it.each(['LIVE', 'HT'] as const)('%s: ao vivo com ação Ver jogo', (status) => {
    const m = match(status, '2026-11-22T20:30:00Z', { elapsed: 67 });
    expect(homeMatchMoment({ ...base, match: m, now: at('2026-11-22T21:40:00Z'), predictionOpen: true, mvpOpen: true })).toEqual({
      state: 'live',
      action: { label: 'VER JOGO', href: '/jogo/1001' },
      countdownTo: null,
    });
  });

  describe('terminado', () => {
    const m = match('FT', '2026-11-22T20:30:00Z', { finishedAt: new Date('2026-11-22T22:25:00Z') });
    it('MVP aberto e por votar: Vota no MVP', () => {
      const r = homeMatchMoment({ ...base, match: m, now: at('2026-11-22T22:30:00Z'), mvpOpen: true });
      expect(r).toEqual({ state: 'finished', action: { label: 'VOTA NO MVP', href: '/jogo/1001?tab=mvp' }, countdownTo: null });
    });
    it('já votou: Ver jogo', () => {
      const r = homeMatchMoment({ ...base, match: m, now: at('2026-11-22T22:30:00Z'), mvpOpen: true, votedMvp: true });
      expect(r.action).toEqual({ label: 'VER JOGO', href: '/jogo/1001' });
    });
    it('votação fechada: Ver jogo', () => {
      const r = homeMatchMoment({ ...base, match: m, now: at('2026-11-22T23:00:00Z') });
      expect(r.state).toBe('finished');
      expect(r.action?.label).toBe('VER JOGO');
    });
    it.each(['AET', 'PEN'] as const)('%s também é terminado', (status) => {
      expect(homeMatchMoment({ ...base, match: match(status, '2026-11-22T20:30:00Z'), now: at('2026-11-22T23:10:00Z') }).state).toBe('finished');
    });
    it('23:59 do dia do jogo ainda é terminado; 00:01 do dia seguinte volta ao próximo (sem jogo)', () => {
      expect(homeMatchMoment({ ...base, match: m, now: at('2026-11-22T23:59:00Z') }).state).toBe('finished');
      expect(homeMatchMoment({ ...base, match: m, now: at('2026-11-23T00:01:00Z') }).state).toBe('none');
    });
    it('jogo que acaba depois da meia-noite: terminado até ao fim do dia em que acabou', () => {
      const late = match('FT', '2026-11-22T23:30:00Z', { finishedAt: new Date('2026-11-23T01:20:00Z') });
      expect(homeMatchMoment({ ...base, match: late, now: at('2026-11-23T01:30:00Z') }).state).toBe('finished');
      expect(homeMatchMoment({ ...base, match: late, now: at('2026-11-24T00:01:00Z') }).state).toBe('none');
    });
  });

  it.each(['PST', 'CANC'] as const)('%s volta ao estado próximo, mesmo no dia do jogo', (status) => {
    const m = match(status, '2026-11-22T20:30:00Z');
    expect(homeMatchMoment({ ...base, match: m, now: at('2026-11-22T08:00:00Z'), predictionOpen: true, mvpOpen: true })).toEqual({
      state: 'next',
      action: null,
      countdownTo: null,
    });
  });
});

describe('pickHomeMatch', () => {
  const now = at('2026-11-22T23:30:00Z');
  it('devolve o primeiro por abrir e ignora vazio', () => {
    expect(pickHomeMatch([], now)).toBeNull();
    const a = match('NS', '2026-11-25T20:00:00Z', { id: 'a' });
    const b = match('NS', '2026-11-28T20:00:00Z', { id: 'b' });
    expect(pickHomeMatch([a, b], now)?.id).toBe('a');
  });
  it('um jogo terminado hoje tem prioridade sobre o seguinte', () => {
    const done = match('FT', '2026-11-22T18:00:00Z', { id: 'done', finishedAt: new Date('2026-11-22T20:00:00Z') });
    const next = match('NS', '2026-11-25T20:00:00Z', { id: 'next' });
    expect(pickHomeMatch([done, next], now)?.id).toBe('done');
  });
  it('terminado ontem, cancelado e por abrir há mais de 4 h ficam de fora', () => {
    const old = match('FT', '2026-11-21T18:00:00Z', { id: 'old', finishedAt: new Date('2026-11-21T20:00:00Z') });
    const canc = match('CANC', '2026-11-22T22:00:00Z', { id: 'canc' });
    const stale = match('NS', '2026-11-22T12:00:00Z', { id: 'stale' });
    const next = match('NS', '2026-11-25T20:00:00Z', { id: 'next' });
    expect(pickHomeMatch([old, stale, canc, next], now)?.id).toBe('next');
  });
  it('um jogo ao vivo conta sempre', () => {
    const live = match('LIVE', '2026-11-22T21:00:00Z', { id: 'live' });
    expect(pickHomeMatch([live], now)?.id).toBe('live');
  });
});

describe('countdownClock', () => {
  it('HH:MM:SS, arredondado para baixo, nunca negativo', () => {
    expect(countdownClock(2 * 3_600_000 + 14 * 60_000 + 37_999)).toBe('02:14:37');
    expect(countdownClock(59_000)).toBe('00:00:59');
    expect(countdownClock(-5000)).toBe('00:00:00');
  });
});
