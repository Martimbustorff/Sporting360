// Task 15: tab Vídeos. useMatchVideos mockado (sem rede); o leitor real com os mocks de WebView e orientação.
import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { CompetitionType, Match, Video } from '@/data/schemas';

type L =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: Video[]; fromCache?: boolean };
const mockVideos: { current: L } = { current: { status: 'loading' } };

jest.mock('@/data/sports', () => ({
  useMatchVideos: jest.fn(() => mockVideos.current),
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { useMatchVideos } from '@/data/sports';
import { minuteOrder, VideosTab } from '@/components/match/VideosTab';

function match(type: CompetitionType = 'league'): Match {
  return {
    id: '1001',
    sport: 'football',
    competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type, season: '2026', round: 'Regular Season - 28', roundLabel: null },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '211', name: 'Benfica', logo: null },
    sportingSide: 'home',
    kickoff: new Date('2026-04-06T19:00:00Z'),
    status: 'FT',
    elapsed: 90,
    elapsedExtra: null,
    score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: '1001', attribution: null },
  } as Match;
}

const v = (id: string, over: Partial<Video> = {}): Video => ({
  id,
  title: `Vídeo ${id}`,
  minute: null,
  type: 'golo',
  thumbnail: null,
  embedSrc: `https://www.vsports.pt/embed/${id}`,
  publishedAt: null,
  ...over,
});

const ready = (data: Video[], fromCache = false): L => ({ status: 'ready', data, fromCache });
const rows = () => screen.getAllByTestId(/^video-row-/).map((n) => n.props.testID as string);

beforeEach(() => {
  mockVideos.current = { status: 'loading' };
});

describe('Vídeos', () => {
  it('lê os vídeos do jogo', async () => {
    mockVideos.current = ready([v('a')]);
    await render(<VideosTab match={match()} />);
    expect(useMatchVideos).toHaveBeenCalledWith('1001');
  });

  it('a carregar: esqueleto, sem mensagens', async () => {
    await render(<VideosTab match={match()} />);
    expect(screen.getByTestId('videos-loading')).toBeTruthy();
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });

  it('erro de leitura: estado de erro', async () => {
    mockVideos.current = { status: 'error', error: new Error('denied') };
    await render(<VideosTab match={match()} />);
    expect(screen.getByText('Não foi possível carregar os dados.')).toBeTruthy();
  });

  it('lista por minuto (com descontos), sem minuto no fim pela ordem de publicação', async () => {
    mockVideos.current = ready([
      v('resumo', { type: 'resumo', minute: null }),
      v('g64', { minute: '64' }),
      v('g45x3', { minute: '45+3' }),
      v('g12', { minute: '12' }),
      v('g45', { minute: '45' }),
      v('flash', { type: 'flash_interview', minute: null }),
    ]);
    await render(<VideosTab match={match()} />);
    // O resumo vai para o destaque; os restantes seguem por minuto.
    expect(rows()).toEqual([
      'video-row-resumo',
      'video-row-g12',
      'video-row-g45',
      'video-row-g45x3',
      'video-row-g64',
      'video-row-flash',
    ]);
  });

  it('o primeiro (o resumo) em destaque 16:9 e os outros em linha com miniatura', async () => {
    mockVideos.current = ready([v('g1', { minute: '5' }), v('resumo', { type: 'resumo' })]);
    await render(<VideosTab match={match()} />);
    const frame = (id: string) => {
      const open = within(screen.getByTestId(`video-row-${id}`)).getByTestId('video-open');
      return StyleSheet.flatten(open.props.style as object) as { flexDirection?: string } | undefined;
    };
    expect(frame('g1')?.flexDirection).toBe('row');
    expect(frame('resumo')?.flexDirection).toBeUndefined();
  });

  it('sem resumo, o primeiro da lista é o destaque', async () => {
    mockVideos.current = ready([v('g9', { minute: '9' }), v('g3', { minute: '3' })]);
    await render(<VideosTab match={match()} />);
    expect(rows()).toEqual(['video-row-g3', 'video-row-g9']);
  });


  it('rótulos por tipo em pt-PT', async () => {
    mockVideos.current = ready([
      v('1', { type: 'golo', minute: '1' }),
      v('2', { type: 'resumo', minute: '2' }),
      v('3', { type: 'flash_interview', minute: '3' }),
      v('4', { type: 'outro', minute: '4' }),
    ]);
    await render(<VideosTab match={match()} />);
    const label = (id: string) => within(screen.getByTestId(`video-row-${id}`)).getByTestId('video-type').props.children;
    expect(['1', '2', '3', '4'].map(label)).toEqual(['Golo', 'Resumo', 'Flash interview', 'Vídeo']);
  });

  it('um embed fora de vsports.pt não aparece na lista', async () => {
    mockVideos.current = ready([v('ok'), v('real', { embedSrc: 'https://sporting.vsports.pt/embd/100020/m/19776/scp/abc?autostart=false' }), v('bad', { embedSrc: 'https://evil.com/x' }), v('look', { embedSrc: 'https://vsports.pt.evil.com/e' })]);
    await render(<VideosTab match={match()} />);
    expect(rows()).toEqual(['video-row-ok', 'video-row-real']);
  });

  it('só embeds recusados conta como vazia', async () => {
    mockVideos.current = ready([v('bad', { embedSrc: 'http://www.vsports.pt/embed/1' })]);
    await render(<VideosTab match={match()} />);
    expect(screen.getByText('Os vídeos aparecem depois dos lances.')).toBeTruthy();
  });

  it('vazia: "Os vídeos aparecem depois dos lances."', async () => {
    mockVideos.current = ready([]);
    await render(<VideosTab match={match()} />);
    expect(screen.getByText('Os vídeos aparecem depois dos lances.')).toBeTruthy();
  });

  it('coleção inexistente conta como vazia', async () => {
    mockVideos.current = { status: 'missing' };
    await render(<VideosTab match={match()} />);
    expect(screen.getByText('Os vídeos aparecem depois dos lances.')).toBeTruthy();
  });

  it('competição europeia sem vídeos: "Sem vídeos para esta competição."', async () => {
    mockVideos.current = ready([]);
    await render(<VideosTab match={match('europe')} />);
    expect(screen.getByText('Sem vídeos para esta competição.')).toBeTruthy();
    expect(screen.queryByText('Os vídeos aparecem depois dos lances.')).toBeNull();
  });

  it('competição europeia com vídeos mostra a lista', async () => {
    mockVideos.current = ready([v('e1', { minute: '9' })]);
    await render(<VideosTab match={match('europe')} />);
    expect(rows()).toEqual(['video-row-e1']);
  });

  it('dados da cache: aviso de sem ligação', async () => {
    mockVideos.current = ready([v('a')], true);
    await render(<VideosTab match={match()} />);
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });
});

describe('minuteOrder', () => {
  it('minuto e descontos; vazio ou estranho vai para o fim', async () => {
    expect(minuteOrder('12')).toBeLessThan(minuteOrder('45'));
    expect(minuteOrder('45')).toBeLessThan(minuteOrder('45+3'));
    expect(minuteOrder('45+3')).toBeLessThan(minuteOrder('46'));
    expect(minuteOrder('90+5')).toBeLessThan(minuteOrder('91'));
    expect(minuteOrder(null)).toBe(Infinity);
    expect(minuteOrder('')).toBe(Infinity);
    expect(minuteOrder('abc')).toBe(Infinity);
  });
});
