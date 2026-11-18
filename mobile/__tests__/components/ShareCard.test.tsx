// Task 17: cartão "S360 MATCHDAY" (SEM FIGMA; referência 818:20427).
import { createRef, type ComponentRef } from 'react';
import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ShareCard } from '@/components/ShareCard';
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

describe('ShareCard', () => {
  it('mostra marca, competição, jornada, data, equipas, prognóstico, hashtag e convite', async () => {
    await render(<ShareCard match={MATCH} home={1} away={2} />);
    expect(screen.getByTestId('share-logo')).toHaveTextContent('S360');
    expect(screen.getByTestId('share-title')).toHaveTextContent('MATCHDAY');
    expect(screen.getByText('Liga Portugal')).toBeTruthy();
    expect(screen.getByText('J20')).toBeTruthy();
    expect(screen.getByTestId('share-kickoff')).toHaveTextContent(/20:15$/);
    expect(screen.getByText('Famalicão')).toBeTruthy();
    expect(screen.getByText('Sporting CP')).toBeTruthy();
    expect(screen.getByTestId('share-score-home')).toHaveTextContent('1');
    expect(screen.getByTestId('share-score-away')).toHaveTextContent('2');
    expect(screen.getByText('#JogoAJogoLadoALado')).toBeTruthy();
    expect(screen.getByText('Partilha o teu prognóstico')).toBeTruthy();
  });

  it('QR com o link do jogo e o link curto em texto', async () => {
    await render(<ShareCard match={MATCH} home={1} away={2} />);
    expect(screen.getByTestId('qrcode').props.value).toBe('https://scp360-37a74.web.app/j?src=share&game=1001');
    expect(screen.getByText('scp360-37a74.web.app/j')).toBeTruthy();
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
});
