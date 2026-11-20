// Plano 7, Tarefa 4: cartão do próximo jogo (Figma 4920:5140), todos os estados, altura fixa e nomes longos.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NextMatchCard, NEXT_MATCH_TEXT } from '@/components/NextMatchCard';
import type { GameStatus, Match } from '@/data/schemas';
import { homeMatchMoment, type HomeMoment } from '@/lib/homeMatchMoment';
import { layout } from '@/theme/tokens';

const match = (status: GameStatus, extra: Partial<Match> = {}, kickoff = '2026-12-21T18:00:00Z'): Match =>
  ({
    id: '1001',
    sport: 'football',
    competition: { key: 'k', id: '96', name: 'Taça de Portugal', type: 'cup', season: '2026', round: 'Round of 16', roundLabel: 'Oitavos de final' },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '212', name: 'SC Braga', logo: null },
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

const handlers = { onOpenMatch: jest.fn(), onAction: jest.fn(), onOpenAgenda: jest.fn(), onRetry: jest.fn() };
const NOW = new Date('2026-12-21T09:00:00Z');
const moment = (m: Match | null, flags: Partial<Parameters<typeof homeMatchMoment>[0]> = {}, now = NOW): HomeMoment =>
  homeMatchMoment({ match: m, now, predictionOpen: false, mvpOpen: false, votedMvp: false, ...flags });

const view = async (m: Match | null, mo: HomeMoment, extra: { error?: boolean; now?: Date } = {}) =>
  render(<NextMatchCard moment={mo} match={m} now={extra.now ?? NOW} error={extra.error} {...handlers} />);

beforeEach(() => jest.clearAllMocks());

it('Próximo: competição, ronda, data, hora e equipas; tocar abre o jogo', async () => {
  const m = match('NS', {}, '2026-12-26T18:00:00Z');
  await view(m, moment(m));
  expect(screen.getByText('Taça de Portugal')).toBeTruthy();
  expect(screen.getByText('Oitavos de final')).toBeTruthy();
  expect(screen.getByText('SÁB 26 DEZ')).toBeTruthy();
  expect(screen.getByTestId('next-time').props.children).toBe('18:00');
  expect(screen.getByText('Sporting CP')).toBeTruthy();
  expect(screen.getByText('SC Braga')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'PROGNÓSTICO' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^Próximo jogo/ }));
  expect(handlers.onOpenMatch).toHaveBeenCalledWith('1001');
});

it('Próximo: o canal de TV aparece em chip quando o jogo o traz', async () => {
  const m = match('NS', { tv: 'BTV' }, '2026-12-26T18:00:00Z');
  await view(m, moment(m));
  expect(screen.getByTestId('next-tv')).toBeTruthy();
  expect(screen.getByText('BTV')).toBeTruthy();
});

it.each([[null], [''], [undefined]])('Próximo: sem canal (%p) não há chip', async (tv) => {
  const m = match('NS', { tv }, '2026-12-26T18:00:00Z');
  await view(m, moment(m));
  expect(screen.queryByTestId('next-tv')).toBeNull();
});

it('Próximo com jogo adiado mostra o estado no lugar da hora', async () => {
  const m = match('PST', {}, '2026-12-26T18:00:00Z');
  await view(m, moment(m));
  expect(screen.getByTestId('next-time').props.children).toBe('ADIADO');
});

it('Dia de jogo: HOJE · hora, contagem HH:MM:SS ao relógio dado e ação Prognóstico', async () => {
  const m = match('NS');
  const now = new Date('2026-12-21T15:45:23Z');
  await view(m, moment(m, { predictionOpen: true }, now), { now });
  expect(screen.getByText('HOJE · 18:00')).toBeTruthy();
  expect(screen.getByTestId('next-countdown').props.children).toBe('02:14:37');
  await fireEvent.press(screen.getByRole('button', { name: 'PROGNÓSTICO' }));
  expect(handlers.onAction).toHaveBeenCalledWith('/jogo/1001?tab=sumario');
  expect(handlers.onOpenMatch).not.toHaveBeenCalled();
});

it('Dia de jogo sem prognóstico aberto: sem botão', async () => {
  const m = match('NS');
  await view(m, moment(m));
  expect(screen.queryByRole('button', { name: 'PROGNÓSTICO' })).toBeNull();
  expect(screen.getByTestId('next-countdown')).toBeTruthy();
});

it('Ao vivo: badge, minuto, resultado e Ver jogo', async () => {
  const m = match('LIVE', { elapsed: 67, score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null } as Match['score'] });
  await view(m, moment(m, {}, new Date('2026-12-21T19:10:00Z')));
  expect(screen.getByText(NEXT_MATCH_TEXT.live)).toBeTruthy();
  expect(screen.getByText('67’')).toBeTruthy();
  expect(screen.getByTestId('next-score').props.children).toBe('2 - 1');
  await fireEvent.press(screen.getByRole('button', { name: 'VER JOGO' }));
  expect(handlers.onAction).toHaveBeenCalledWith('/jogo/1001');
  expect(screen.getByRole('button', { name: /^Jogo ao vivo/ })).toBeTruthy();
});

it('Intervalo mostra "Intervalo" no lugar do minuto', async () => {
  const m = match('HT', { score: { home: 0, away: 0, halftime: null, extratime: null, penalty: null } as Match['score'] });
  await view(m, moment(m, {}, new Date('2026-12-21T18:50:00Z')));
  expect(screen.getByText('Intervalo')).toBeTruthy();
});

it('Terminado com MVP aberto: Vota no MVP abre o separador MVP', async () => {
  const m = match('FT', {
    finishedAt: new Date('2026-12-21T19:55:00Z'),
    score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null } as Match['score'],
  });
  await view(m, moment(m, { mvpOpen: true }, new Date('2026-12-21T20:00:00Z')));
  expect(screen.getByText(NEXT_MATCH_TEXT.finished)).toBeTruthy();
  expect(screen.getByText(NEXT_MATCH_TEXT.endOfGame)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'VOTA NO MVP' }));
  expect(handlers.onAction).toHaveBeenCalledWith('/mvp/1001');
});

it('Terminado depois de votar: Ver jogo', async () => {
  const m = match('FT', { score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null } as Match['score'] });
  await view(m, moment(m, { mvpOpen: true, votedMvp: true }, new Date('2026-12-21T20:00:00Z')));
  expect(screen.getByRole('button', { name: 'VER JOGO' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'VOTA NO MVP' })).toBeNull();
});

it('Sem jogo: mensagem e Ver Agenda (o cartão não é um botão de jogo)', async () => {
  await view(null, moment(null));
  expect(screen.getByText(NEXT_MATCH_TEXT.none)).toBeTruthy();
  expect(screen.getByText(NEXT_MATCH_TEXT.noneHint)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Próximo jogo/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: NEXT_MATCH_TEXT.agenda }));
  expect(handlers.onOpenAgenda).toHaveBeenCalled();
});

it('Erro: o mesmo cartão com "Tentar outra vez"', async () => {
  await view(null, moment(null), { error: true });
  expect(screen.getByText(NEXT_MATCH_TEXT.errorHint)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: NEXT_MATCH_TEXT.retry }));
  expect(handlers.onRetry).toHaveBeenCalled();
});

it('A carregar: esqueleto anunciado como ocupado, sem botões', async () => {
  await view(null, moment(null, { loading: true }));
  expect(screen.getByTestId('next-match-loading').props.accessibilityLabel).toBe(NEXT_MATCH_TEXT.loading);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

describe('altura fixa de matchCardHeight e nomes longos', () => {
  const long = {
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '300', name: 'Gil Vicente Futebol Clube', logo: null },
  } as Partial<Match>;
  const longComp = { competition: { key: 'k', id: '1', name: 'Taça da Liga Portugal Betclic Feminina', type: 'cup', season: '2026', round: 'Round of 16', roundLabel: 'Oitavos de final' } } as Partial<Match>;
  const cases: [string, Match | null, Partial<Parameters<typeof homeMatchMoment>[0]>, Date][] = [
    ['próximo', match('NS', { ...long, ...longComp }, '2026-12-26T18:00:00Z'), {}, NOW],
    ['dia de jogo', match('NS', { ...long, ...longComp }), { predictionOpen: true }, NOW],
    ['ao vivo', match('LIVE', { ...long, elapsed: 90, elapsedExtra: 4 }), {}, new Date('2026-12-21T19:30:00Z')],
    ['terminado', match('FT', long), { mvpOpen: true }, new Date('2026-12-21T20:00:00Z')],
    ['sem jogo', null, {}, NOW],
    ['a carregar', null, { loading: true }, NOW],
  ];
  it.each(cases)('%s: altura fixa, nomes numa linha com reticências', async (_n, m, flags, now) => {
    await view(m, moment(m, flags, now), { now });
    const card = screen.getByTestId('next-match-card');
    expect(StyleSheet.flatten(card.props.style).height).toBe(layout.matchCardHeight);
    expect(layout.matchCardHeight).toBe(204);
    for (const name of ['Gil Vicente Futebol Clube', 'Taça da Liga Portugal Betclic Feminina']) {
      for (const t of screen.queryAllByText(name)) expect(t.props.numberOfLines).toBe(name.startsWith('Gil') ? 1 : 1);
    }
  });
});

describe('largura 320 pt e acessibilidade do cartão', () => {
  const small = (ui: React.ReactElement) => (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <View style={{ width: 320 }}>{ui}</View>
    </SafeAreaProvider>
  );
  it('dia de jogo: contagem numa linha que encolhe; nomes longos continuam a cortar', async () => {
    const m = match('NS', { away: { id: '300', name: 'Gil Vicente Futebol Clube', logo: null } } as Partial<Match>);
    const now = new Date('2026-12-21T15:45:23Z');
    await render(small(<NextMatchCard moment={moment(m, { predictionOpen: true }, now)} match={m} now={now} {...handlers} />));
    const c = screen.getByTestId('next-countdown');
    expect(c.props.numberOfLines).toBe(1);
    expect(c.props.adjustsFontSizeToFit).toBe(true);
    expect(c.props.minimumFontScale).toBe(layout.matchCardCountdownMinScale);
    expect(screen.getByText('Gil Vicente Futebol Clube').props.numberOfLines).toBe(1);
  });
  it('a contagem ao segundo para quando chega ao apito', async () => {
    jest.useFakeTimers({ now: new Date('2026-12-21T17:59:58Z') });
    try {
      const m = match('NS');
      const now = new Date('2026-12-21T17:59:58Z');
      await render(<NextMatchCard moment={moment(m, {}, now)} match={m} now={now} ticking {...handlers} />);
      expect(screen.getByTestId('next-countdown').props.children).toBe('00:00:02');
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId('next-countdown').props.children).toBe('00:00:00');
    } finally {
      jest.useRealTimers();
    }
  });
  it('o trinco da contagem repõe-se quando o alvo muda (jogo adiado ou outro jogo)', async () => {
    jest.useFakeTimers({ now: new Date('2026-12-21T17:59:58Z') });
    try {
      const m = match('NS');
      const now = new Date('2026-12-21T17:59:58Z');
      const view = (mm: Match, n: Date) => (
        <NextMatchCard moment={moment(mm, {}, n)} match={mm} now={n} ticking {...handlers} />
      );
      await render(view(m, now));
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId('next-countdown').props.children).toBe('00:00:00');
      const later = { ...m, kickoff: new Date('2026-12-21T19:00:00Z') } as Match;
      const n2 = new Date(Date.now());
      await screen.rerender(view(later, n2));
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('next-countdown').props.children).not.toBe('00:00:00');
    } finally {
      jest.useRealTimers();
    }
  });
  it('a etiqueta do cartão inclui equipas e hora, resultado ou estado', async () => {
    const m = match('NS', {}, '2026-12-26T18:00:00Z');
    const r = await view(m, moment(m));
    expect(screen.getByRole('button', { name: 'Próximo jogo: Sporting CP contra SC Braga, SÁB 26 DEZ às 18:00' })).toBeTruthy();
    r.unmount();
    const l = match('LIVE', { elapsed: 10, score: { home: 1, away: 0, halftime: null, extratime: null, penalty: null } as Match['score'] });
    await view(l, moment(l, {}, new Date('2026-12-21T18:20:00Z')));
    expect(screen.getByRole('button', { name: 'Jogo ao vivo: Sporting CP contra SC Braga, ao vivo, 1 - 0' })).toBeTruthy();
  });
});
