import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GameHeader, type GameHeaderVM } from '@/components/GameHeader';

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

const base: GameHeaderVM = {
  competitionName: 'Liga Portugal',
  round: 'Regular Season - 16',
  home: { name: 'FC Vizela', crestUrl: 'https://example.com/vizela.png' },
  away: { name: 'Sporting CP', crestUrl: null, id: 228 },
  state: 'scheduled',
  kickoff: new Date('2026-09-14T19:30:00Z'),
  tv: 'SportTV',
};
const NOW = new Date('2026-09-09T10:00:00Z');

describe('GameHeader', () => {
  it('scheduled: strip, round, names, Lisbon time, tv, no score', async () => {
    await render(<GameHeader game={base} now={NOW} />);
    expect(screen.getByText(/^próximo$/i)).toBeTruthy();
    expect(screen.getByText('J16')).toBeTruthy();
    expect(screen.getByText('FC Vizela')).toBeTruthy();
    expect(screen.getByText('Sporting CP')).toBeTruthy();
    expect(screen.getByText('20:30')).toBeTruthy();
    expect(screen.getByText('14 Set')).toBeTruthy();
    expect(screen.getByText('SportTV')).toBeTruthy();
    expect(screen.queryByTestId('score-home')).toBeNull();
  });

  it('shows the competition name and an accessible strip', async () => {
    await render(<GameHeader game={base} now={NOW} />);
    expect(screen.getByText('Liga Portugal')).toBeTruthy();
    expect(screen.getByRole('header').props.accessible).toBe(true);
  });

  it('live: minute strip and score boxes', async () => {
    await render(
      <GameHeader game={{ ...base, state: 'live', minute: 23, score: { home: 3, away: 0 } }} now={NOW} />,
    );
    expect(screen.getByText('Live - 23’')).toBeTruthy();
    expect(String(screen.getByTestId('score-home').props.children)).toBe('3');
    expect(String(screen.getByTestId('score-away').props.children)).toBe('0');
    expect(screen.queryByText('20:30')).toBeNull();
  });

  it('finished shows Terminado', async () => {
    await render(<GameHeader game={{ ...base, state: 'finished', score: { home: 1, away: 2 } }} now={NOW} />);
    expect(screen.getByText('Terminado')).toBeTruthy();
  });

  it('renders the tabs slot', async () => {
    await render(<GameHeader game={base} now={NOW} tabs={<Text>slot-tabs</Text>} />);
    expect(screen.getByText('slot-tabs')).toBeTruthy();
  });

  it('Sporting (id 228) uses the local 2026 crest, others the remote logo', async () => {
    await render(<GameHeader game={base} now={NOW} />);
    expect(screen.getByTestId('crest-away', { includeHiddenElements: true }).props.source).toEqual({ testUri: expect.stringContaining('sporting-cp-2026') });
    expect(screen.getByTestId('crest-home', { includeHiddenElements: true }).props.source).toEqual({ uri: 'https://example.com/vizela.png' });
  });
});

describe('GameHeader states (Review Focus 2)', () => {
  it('postponed: Adiado and the date, no time and no score', async () => {
    await render(
      <GameHeader game={{ ...base, state: 'postponed', score: { home: 0, away: 0 } }} now={NOW} />,
    );
    expect(screen.getByText(/^adiado$/i)).toBeTruthy();
    expect(screen.getByText('14 Set')).toBeTruthy();
    expect(screen.queryByText('20:30')).toBeNull();
    expect(screen.queryByTestId('score-home')).toBeNull();
    expect(screen.queryByText('SportTV')).toBeNull();
  });

  it('cancelled: Cancelado, no time and no score', async () => {
    await render(<GameHeader game={{ ...base, state: 'cancelled' }} now={NOW} />);
    expect(screen.getByText(/^cancelado$/i)).toBeTruthy();
    expect(screen.getByText('14 Set')).toBeTruthy();
    expect(screen.queryByText('20:30')).toBeNull();
    expect(screen.queryByTestId('score-home')).toBeNull();
  });

  it('halftime: Intervalo and the score', async () => {
    await render(
      <GameHeader game={{ ...base, state: 'halftime', minute: 45, score: { home: 1, away: 1 } }} now={NOW} />,
    );
    expect(screen.getByText(/^intervalo$/i)).toBeTruthy();
    expect(String(screen.getByTestId('score-home').props.children)).toBe('1');
    expect(String(screen.getByTestId('score-away').props.children)).toBe('1');
  });

  it('live with stoppage time uses minuteText', async () => {
    await render(
      <GameHeader
        game={{ ...base, state: 'live', minute: 45, minuteText: '45+2’', score: { home: 1, away: 0 } }}
        now={NOW}
      />,
    );
    expect(screen.getByText('Live - 45+2’')).toBeTruthy();
  });

  it('venue only when set (football VMs have venue null)', async () => {
    const { rerender } = await render(<GameHeader game={{ ...base, venue: null }} now={NOW} />);
    expect(screen.queryByTestId('game-venue')).toBeNull();
    await rerender(<GameHeader game={{ ...base, venue: 'Pavilhão João Rocha' }} now={NOW} />);
    expect(screen.getByText('Pavilhão João Rocha')).toBeTruthy();
  });
});
