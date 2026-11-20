import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { GameHeader, GameNavTitle, compactSummary, type GameHeaderVM } from '@/components/GameHeader';
import { colors, layout } from '@/theme/tokens';

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
const live: GameHeaderVM = {
  ...base,
  home: { name: 'Sporting CP', crestUrl: null, id: 228 },
  away: { name: 'FC Porto', crestUrl: null, id: 212 },
  state: 'live',
  minute: 67,
  minuteText: '67’',
  score: { home: 2, away: 1 },
  goals: [
    { side: 'home', minute: 23, extra: null, name: 'L. Suárez', text: 'L. Suárez 23’' },
    { side: 'away', minute: 38, extra: null, name: 'Samu', text: 'Samu 38’' },
    { side: 'home', minute: 54, extra: null, name: 'Trincão', text: 'Trincão 54’' },
  ],
};

describe('GameHeader completo, antes do jogo (frame 29)', () => {
  it('títulos por ordem (competição, jornada, pílula só se for o próximo, data), hora grande e nomes; sem resultado', async () => {
    const view = await render(<GameHeader game={base} />);
    expect(screen.queryByText('Próximo jogo')).toBeNull();
    await view.rerender(<GameHeader game={{ ...base, isNext: true }} />);
    expect(screen.getByText('Próximo jogo')).toBeTruthy();
    const titles = within(screen.getByTestId('match-titles'));
    expect(titles.getByTestId('titles-competition')).toBeTruthy();
    expect(titles.getByTestId('competition-badge')).toBeTruthy();
    expect(screen.getByTestId('game-time').props.children).toBe('20:30');
    expect(screen.getByTestId('game-date').props.children).toBe('SEG 14 SET');
    expect(screen.getByText('FC Vizela')).toBeTruthy();
    expect(screen.getByText('Sporting CP')).toBeTruthy();
    expect(screen.queryByTestId('score-home')).toBeNull();
  });

  it('a hora usa Score 72', async () => {
    await render(<GameHeader game={base} />);
    expect(StyleSheet.flatten(screen.getByTestId('game-time').props.style).fontSize).toBe(72);
  });

  it('a pílula é um cabeçalho acessível', async () => {
    await render(<GameHeader game={base} />);
    expect(screen.getByRole('header').props.accessible).toBe(true);
  });

  it('adiado e cancelado: estado e data, sem hora, resultado nem pontos', async () => {
    const { rerender } = await render(<GameHeader game={{ ...base, state: 'postponed', score: { home: 0, away: 0 } }} />);
    expect(screen.getByText('Adiado')).toBeTruthy();
    expect(screen.getByTestId('game-date')).toBeTruthy();
    expect(screen.queryByTestId('game-time')).toBeNull();
    expect(screen.queryByTestId('score-home')).toBeNull();
    await rerender(<GameHeader game={{ ...base, state: 'cancelled' }} />);
    expect(screen.getByText('Cancelado')).toBeTruthy();
    expect(screen.queryByTestId('game-time')).toBeNull();
  });
});

describe('Canal de TV no cabeçalho (frame 29)', () => {
  it('com canal mostra o chip por baixo da hora', async () => {
    await render(<GameHeader game={{ ...base, tv: 'SPORT TV' }} />);
    expect(within(screen.getByTestId('game-tv')).getByText('SPORT TV')).toBeTruthy();
  });
  it.each([[null], [''], [undefined]])('sem canal (%p) não mostra o chip', async (tv) => {
    await render(<GameHeader game={{ ...base, tv }} />);
    expect(screen.queryByTestId('game-tv')).toBeNull();
  });
  it('ao vivo não mostra o chip (frame 06)', async () => {
    await render(<GameHeader game={{ ...live, tv: 'SPORT TV' }} />);
    expect(screen.queryByTestId('game-tv')).toBeNull();
  });
});

describe('GameHeader completo, ao vivo (frame 06)', () => {
  it('mostra "Ao vivo · 2.ª parte", caixas e minuto', async () => {
    await render(<GameHeader game={live} />);
    expect(screen.getByText('Ao vivo · 2.ª parte')).toBeTruthy();
    expect(screen.getByTestId('live-dot')).toBeTruthy();
    expect(String(screen.getByTestId('score-home').props.children)).toBe('2');
    expect(String(screen.getByTestId('score-away').props.children)).toBe('1');
    expect(screen.getByTestId('live-minute').props.children).toBe('67’');
    expect(StyleSheet.flatten(screen.getByTestId('score-home').props.style).fontSize).toBe(72);
  });

  it('1.ª parte e prolongamento', async () => {
    const { rerender } = await render(<GameHeader game={{ ...live, minute: 30, minuteText: '30’' }} />);
    expect(screen.getByText('Ao vivo · 1.ª parte')).toBeTruthy();
    await rerender(<GameHeader game={{ ...live, minute: 105, minuteText: '105’' }} />);
    expect(screen.getByText('Ao vivo · Prolongamento')).toBeTruthy();
  });

  it('marcadores por equipa, cada um com o minuto', async () => {
    await render(<GameHeader game={live} />);
    const scorers = within(screen.getByTestId('game-scorers'));
    expect(scorers.getByText('L. Suárez 23’')).toBeTruthy();
    expect(scorers.getByText('Trincão 54’')).toBeTruthy();
    expect(scorers.getByText('Samu 38’')).toBeTruthy();
  });

  it('a linha do tempo põe os golos do Sporting em cima e os do adversário em baixo', async () => {
    await render(<GameHeader game={live} />);
    expect(screen.getAllByTestId('timeline-goal-top')).toHaveLength(2);
    expect(screen.getAllByTestId('timeline-goal-bottom')).toHaveLength(1);
    expect(screen.getByTestId('timeline-now')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('timeline-progress').props.style).width).toBe(`${67 / 0.9}%`);
  });

  it('só a caixa de quem marcou por último leva o contorno verde', async () => {
    await render(<GameHeader game={live} />);
    const ring = (id: string) => StyleSheet.flatten(screen.getByTestId(`${id}-box`).props.style).borderColor;
    expect(ring('score-home')).toBe(layout.headerScoreRing);
    expect(ring('score-away')).toBeUndefined();
  });

  it('golo (20/11): o número sobe e o telemóvel vibra uma vez; abrir o jogo não vibra', async () => {
    const Haptics = require('expo-haptics') as { notificationAsync: jest.Mock };
    const spy = jest.spyOn(Haptics, 'notificationAsync').mockResolvedValue(undefined as never);
    const view = await render(<GameHeader game={live} />);
    expect(spy).not.toHaveBeenCalled();
    await view.rerender(<GameHeader game={{ ...live, score: { home: (live.score?.home ?? 0) + 1, away: live.score?.away ?? 0 } }} />);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('sem golos conhecidos não há marcadores', async () => {
    await render(<GameHeader game={{ ...live, goals: [] }} />);
    expect(screen.queryByTestId('game-scorers')).toBeNull();
    expect(screen.getByTestId('match-timeline')).toBeTruthy();
  });

  it('o cartão do prognóstico só aparece quando existe', async () => {
    const { rerender } = await render(<GameHeader game={live} />);
    expect(screen.queryByTestId('prediction-summary')).toBeNull();
    await rerender(<GameHeader game={{ ...live, prediction: { home: 2, away: 1, points: null } }} />);
    expect(screen.getByText('O teu prognóstico')).toBeTruthy();
    expect(screen.getByTestId('prediction-pick').props.children).toBe('2-1');
    expect(screen.queryByTestId('prediction-points')).toBeNull();
  });

  it('com pontos liquidados mostra o selo "+4 PTS"', async () => {
    await render(<GameHeader game={{ ...live, state: 'finished', prediction: { home: 2, away: 1, points: 4 } }} />);
    expect(within(screen.getByTestId('prediction-points')).getByText('+4 PTS')).toBeTruthy();
  });

  it('halftime mostra Intervalo e o resultado, sem minuto', async () => {
    await render(<GameHeader game={{ ...live, state: 'halftime', minute: 45 }} />);
    expect(screen.getByText('Intervalo')).toBeTruthy();
    expect(screen.queryByTestId('live-minute')).toBeNull();
    expect(screen.queryByTestId('timeline-now')).toBeNull();
  });
});

describe('GameHeader terminado', () => {
  const finished: GameHeaderVM = { ...live, state: 'finished', minute: null, minuteText: '' };
  it('Terminado, resultado e "Fim do jogo"', async () => {
    await render(<GameHeader game={finished} />);
    expect(screen.getByText('Terminado')).toBeTruthy();
    expect(screen.getByText('Fim do jogo')).toBeTruthy();
    expect(screen.queryByTestId('timeline-now')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('timeline-progress').props.style).width).toBe('100%');
  });

  it('com penáltis mostra o desempate', async () => {
    await render(<GameHeader game={{ ...finished, penalty: { home: 4, away: 3 } }} />);
    expect(screen.getByText('4-3 g.p.')).toBeTruthy();
  });
});

describe('GameHeader compacto (frames 08 e 10)', () => {
  it('mostra emblemas, resultado "2 - 1" e o estado FIM', async () => {
    await render(<GameHeader size="compact" game={{ ...live, state: 'finished', minute: null, minuteText: '' }} />);
    expect(screen.getByTestId('compact-score').props.children).toBe('2 - 1');
    expect(screen.getByText('Fim')).toBeTruthy();
    expect(screen.getByTestId('compact-crest-home', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('compact-crest-away', { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('compact-score').props.style).fontSize).toBe(24);
  });

  it('ao vivo mostra o minuto no estado, em primary', async () => {
    await render(<GameHeader size="compact" game={live} />);
    expect(screen.getByText('67’')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('compact-state').props.style).backgroundColor).toBe(colors.primary);
  });

  it('antes do jogo mostra a hora no lugar do resultado', async () => {
    await render(<GameHeader size="compact" game={base} />);
    expect(screen.getByTestId('compact-score').props.children).toBe('20:30');
    expect(screen.queryByTestId('compact-state')).toBeNull();
  });

  it('tem um rótulo de resumo acessível', async () => {
    await render(<GameHeader size="compact" game={live} />);
    const node = screen.getByTestId('game-header-compact');
    expect(node.props.accessible).toBe(true);
    expect(node.props.accessibilityLabel).toBe('Sporting CP 2, FC Porto 1, ao vivo, 67’');
  });

  it('compactSummary para terminado e para jogo por começar', () => {
    expect(compactSummary({ ...live, state: 'finished' })).toBe('Sporting CP 2, FC Porto 1, terminado');
    expect(compactSummary(base)).toBe('FC Vizela contra Sporting CP, 20:30');
  });
});

describe('GameHeader outra modalidade (frame 34)', () => {
  it('mostra o local no cabeçalho', async () => {
    await render(<GameHeader game={{ ...base, venue: 'Pavilhão João Rocha, Lisboa' }} />);
    expect(screen.getByTestId('game-venue').props.children).toBe('Pavilhão João Rocha, Lisboa');
    expect(screen.getByTestId('game-time')).toBeTruthy();
  });
});

describe('nomes longos a 320 pt', () => {
  it('nomes de equipa e de competição levam uma linha com reticências', async () => {
    const long = { ...base, home: { name: 'Gil Vicente Futebol Clube', crestUrl: null }, competitionName: 'Liga Placard Futsal Feminino' };
    await render(<GameHeader game={long} />);
    expect(screen.getByText('Gil Vicente Futebol Clube').props.numberOfLines).toBe(1);
    expect(screen.getByText('Liga Placard Futsal Feminino').props.numberOfLines).toBe(1);
  });

  it('a jornada vira o badge J16 na barra', async () => {
    await render(<GameNavTitle game={base} />);
    expect(screen.getByText('J16')).toBeTruthy();
    expect(screen.getByText('Liga Portugal')).toBeTruthy();
  });

  it.each(['postponed', 'cancelled'] as const)('compacto %s mostra VS e não a hora', async (state) => {
    await render(<GameHeader game={{ ...base, state }} size="compact" />);
    expect(screen.getByTestId('compact-score').props.children).toBe('VS');
  });
});
