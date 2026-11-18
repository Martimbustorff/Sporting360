// Task 17: cartão "S360 MATCHDAY" (SEM FIGMA; referência 818:20427).
import { createRef, type ComponentRef } from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// Task 18: largura da janela controlada pelo teste (carry da revisão da Task 17: cartão em ecrãs estreitos).
const mockWindow = { width: 375, height: 812, scale: 2, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

import { ShareCard, shareCardScale } from '@/components/ShareCard';
import type { Match } from '@/data/schemas';

const MATCH = {
  id: '1001',
  sport: 'football',
  competition: { key: 'football_94_2026', id: '94', name: 'Liga Portugal', type: 'league', season: '2026', round: 'Regular Season - 20', roundLabel: null },
  home: { id: '242', name: 'Famalicão', logo: 'https://x/242.png' },
  away: { id: '228', name: 'Sporting CP', logo: 'https://x/228-old.png' },
  sportingSide: 'away',
  kickoff: new Date('2027-04-16T19:15:00Z'),
  status: 'NS',
  elapsed: null,
  elapsedExtra: null,
  score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
  finishedAt: null,
  venue: null,
} as unknown as Match;

beforeEach(() => {
  mockWindow.width = 375;
});

describe('ShareCard', () => {
  it('mostra marca, competição, jornada, data, equipas, prognóstico, hashtag e convite', async () => {
    await render(<ShareCard match={MATCH} home={1} away={2} />);
    expect(screen.getByTestId('share-logo')).toHaveTextContent('S360');
    expect(screen.getByTestId('share-title')).toHaveTextContent('MATCHDAY');
    expect(screen.getByText('Liga Portugal')).toBeTruthy();
    expect(screen.getByText('J20')).toBeTruthy();
    expect(screen.getByTestId('share-kickoff')).toHaveTextContent('16 abril 20:15');
    expect(screen.getByText('Famalicão')).toBeTruthy();
    expect(screen.getByText('Sporting CP')).toBeTruthy();
    expect(screen.getByTestId('share-score-home')).toHaveTextContent('1');
    expect(screen.getByTestId('share-score-away')).toHaveTextContent('2');
    expect(screen.getByText('#JogoAJogoLadoALado')).toBeTruthy();
    expect(screen.getByText('Partilha o teu prognóstico')).toBeTruthy();
  });

  it('QR com o link do jogo e o link curto em texto', async () => {
    await render(<ShareCard match={MATCH} home={1} away={2} />);
    expect(screen.getByTestId('qrcode').props.value).toBe('https://s360-prognostico-download.web.app/j?src=share&game=1001');
    expect(screen.getByText('s360-prognostico-download.web.app/j')).toBeTruthy();
  });

  it('o Sporting usa o emblema local 2026, não o logo da API', async () => {
    await render(<ShareCard match={MATCH} home={1} away={2} />);
    const hidden = { includeHiddenElements: true };
    const src = (id: string) => JSON.stringify(screen.getByTestId(id, hidden).props.source);
    expect(src('share-crest-away')).toContain('sporting-cp-2026');
    expect(src('share-crest-away')).not.toContain('228-old');
    expect(src('share-crest-home')).toContain('https://x/242.png');
  });

  it('expõe a View raiz por ref para a captura', async () => {
    const ref = createRef<ComponentRef<typeof View>>();
    await render(<ShareCard ref={ref} match={MATCH} home={1} away={2} />);
    expect(ref.current).toBeTruthy();
    expect(screen.getByTestId('share-card').props.collapsable).toBe(false);
  });

  // Task 18 (carry da revisão da Task 17): a imagem dura mais do que a semana do jogo.
  it('data absoluta mesmo na semana do jogo (nunca "Sexta-feira, 16")', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2027-04-14T10:00:00Z'));
    try {
      await render(<ShareCard match={MATCH} home={1} away={2} />);
      expect(screen.getByTestId('share-kickoff')).toHaveTextContent('16 abril 20:15');
      expect(screen.queryByText(/Sexta-feira/)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ShareCard em ecrãs estreitos', () => {
  it('shareCardScale: 1 a partir de 363 pt; abaixo encolhe para caber com 8 pt de cada lado', () => {
    expect(shareCardScale(430)).toBe(1);
    expect(shareCardScale(375)).toBe(1);
    expect(shareCardScale(363)).toBe(1);
    expect(shareCardScale(320)).toBeCloseTo(304 / 347, 5);
  });

  it('a 375 pt fica no tamanho do design, sem escala', async () => {
    await render(<ShareCard match={MATCH} home={1} away={2} />);
    const frame = screen.getByTestId('share-card-frame');
    expect(frame.props.style).toBeUndefined();
    expect(screen.getByTestId('share-card').props.style).toEqual(expect.objectContaining({ width: 347 }));
  });

  it('a 320 pt encolhe à vista (cabe em 304 pt) mas o cartão capturado mantém 347 pt e não tem transformação', async () => {
    mockWindow.width = 320;
    await render(<ShareCard match={MATCH} home={1} away={2} />);
    const s = 304 / 347;
    const outer = screen.getByTestId('share-card-fit');
    expect(outer.props.style).toEqual(expect.objectContaining({ width: 304 }));
    const frame = screen.getByTestId('share-card-frame');
    expect(frame.props.style).toEqual(expect.objectContaining({ transform: [{ scale: s }] }));
    const card = screen.getByTestId('share-card');
    expect(card.props.style).toEqual(expect.objectContaining({ width: 347 }));
    expect(card.props.style.transform).toBeUndefined();
  });

  it('a 320 pt a altura à vista acompanha a escala depois de medir o cartão', async () => {
    mockWindow.width = 320;
    await render(<ShareCard match={MATCH} home={1} away={2} />);
    await act(async () => {
      fireEvent(screen.getByTestId('share-card'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 347, height: 500 } } });
    });
    expect(screen.getByTestId('share-card-fit').props.style).toEqual(
      expect.objectContaining({ width: 304, height: (500 * 304) / 347 }),
    );
  });
});
