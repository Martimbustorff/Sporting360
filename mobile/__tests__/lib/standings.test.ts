// Task 12: escolha da vista da Classificação (tabela ou eliminatórias) e textos da tabela e do quadro.
import type { Competition, Tie } from '@/data/schemas';
import {
  aggregateText,
  getViewChoice,
  goalsText,
  legScoreText,
  resetViewChoices,
  resolveView,
  setViewChoice,
  showSelector,
} from '@/lib/standings';

type View = NonNullable<Competition['view']>;
const view = (primary: View['primary'], hasTable = true, hasBracket = true): View => ({
  primary,
  hasTable,
  hasBracket,
  currentStage: null,
});

describe('resolveView', () => {
  it('sem view: tabela se houver linhas, senão eliminatórias', () => {
    expect(resolveView(undefined, true, true, null)).toBe('table');
    expect(resolveView(undefined, false, true, null)).toBe('bracket');
  });

  it('segue view.primary quando essa vista existe', () => {
    expect(resolveView(view('bracket'), true, true, null)).toBe('bracket');
    expect(resolveView(view('table'), true, true, null)).toBe('table');
  });

  it('a escolha do utilizador vem primeiro, se essa vista existir', () => {
    expect(resolveView(view('bracket'), true, true, 'table')).toBe('table');
    expect(resolveView(view('table'), true, true, 'bracket')).toBe('bracket');
  });

  it('escolha `bracket` sem quadro cai na tabela', () => {
    expect(resolveView(view('table', true, false), true, false, 'bracket')).toBe('table');
    expect(resolveView(undefined, true, false, 'bracket')).toBe('table');
  });

  it('primary `bracket` com o quadro ainda vazio mostra a tabela', () => {
    expect(resolveView(view('bracket'), true, false, null)).toBe('table');
  });
});

describe('showSelector', () => {
  it('só com as duas vistas', () => {
    expect(showSelector(view('table'), true, true)).toBe(true);
    expect(showSelector(view('table'), true, false)).toBe(false);
    expect(showSelector(undefined, false, true)).toBe(false);
  });

  it('com hasBracket false no servidor, sem seletor mesmo com eliminatórias no documento', () => {
    expect(showSelector(view('table', true, false), true, true)).toBe(false);
    // Sem `view` (doc da competição em falta), decidem os dados.
    expect(showSelector(undefined, true, true)).toBe(true);
  });
});

describe('escolha manual da vista (sessão da app)', () => {
  beforeEach(() => resetViewChoices());

  it('guarda por chave de competição', () => {
    expect(getViewChoice('football_2_2026')).toBeNull();
    setViewChoice('football_2_2026', 'table');
    expect(getViewChoice('football_2_2026')).toBe('table');
    expect(getViewChoice('football_3_2026')).toBeNull();
    setViewChoice('football_2_2026', 'bracket');
    expect(getViewChoice('football_2_2026')).toBe('bracket');
  });
});

describe('textos', () => {
  it('golos como 8:4', () => {
    expect(goalsText({ goalsFor: 8, goalsAgainst: 4 })).toBe('8:4');
  });

  const tie: Tie = {
    id: 't1',
    stage: 'Round of 16',
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '211', name: 'SL Benfica', logo: null },
    legs: [
      { matchId: 'a', kickoff: '2027-02-10T20:00:00.000Z', status: 'FT', score: { home: 2, away: 1, penaltyHome: null, penaltyAway: null } },
      { matchId: 'b', kickoff: '2027-02-17T20:00:00.000Z', status: 'FT', score: { home: 1, away: 1, penaltyHome: null, penaltyAway: null } },
    ],
    aggregate: { home: 3, away: 2 },
    winnerTeamId: '228',
    sportingInvolved: true,
  };

  const leg1 = tie.legs[0]!;
  const leg2 = tie.legs[1]!;

  it('agregado do servidor, sem recalcular', () => {
    expect(aggregateText({ ...tie, aggregate: { home: 9, away: 0 } })).toBe('9-0');
    expect(aggregateText({ ...tie, aggregate: null })).toBeNull();
  });

  it('resultado de cada mão; a 2.ª mão lê-se do lado das equipas da eliminatória', () => {
    expect(legScoreText(leg1, 0, '228')).toBe('2-1');
    expect(legScoreText(leg2, 1, '228')).toBe('1-1');
    expect(legScoreText({ ...leg1, score: { home: 3, away: 0, penaltyHome: null, penaltyAway: null } }, 1, '228')).toBe('0-3');
  });

  it('mão com penáltis 4-3: "1-1 (4-3 g.p.)" (penaltiesText, F8)', () => {
    const pen = { ...leg1, status: 'PEN', score: { home: 1, away: 1, penaltyHome: 4, penaltyAway: 3 } };
    expect(legScoreText(pen, 0, '228')).toBe('1-1 (4-3 g.p.)');
    expect(legScoreText(pen, 1, '228')).toBe('1-1 (3-4 g.p.)');
  });

  it('com `homeId` na mão (docs novos) orienta-se por ele, não pelo índice', () => {
    // Mão de índice 1 jogada em casa da equipa da esquerda (ex.: sorteio que repete a casa): não troca.
    const sameHome = { ...leg2, homeId: '228', score: { home: 3, away: 0, penaltyHome: null, penaltyAway: null } };
    expect(legScoreText(sameHome, 1, '228')).toBe('3-0');
    // Mão de índice 0 em casa da equipa da direita: troca, penáltis incluídos.
    const awayHome = { ...leg1, homeId: '211', status: 'PEN', score: { home: 1, away: 1, penaltyHome: 5, penaltyAway: 4 } };
    expect(legScoreText(awayHome, 0, '228')).toBe('1-1 (4-5 g.p.)');
  });

  it('sem `homeId` (docs antigos) a 2.ª mão continua a ler-se trocada', () => {
    expect('homeId' in leg2).toBe(false);
    expect(legScoreText({ ...leg2, score: { home: 2, away: 0, penaltyHome: null, penaltyAway: null } }, 1, '228')).toBe('0-2');
  });

  it('mão por jogar não tem resultado', () => {
    expect(legScoreText({ ...leg1, status: 'NS', score: { home: null, away: null, penaltyHome: null, penaltyAway: null } }, 0, '228')).toBeNull();
  });
});
