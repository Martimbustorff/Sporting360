// Task 7: linha de jogo da Agenda (Figma 500:28822 / 489:7038).
// Review Focus 2 (adiado e cancelado) e Review Focus 4 (nomes longos numa linha).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { layout } from '@/theme/tokens';
import { MatchRow, rowIsLarge } from '@/components/MatchRow';
import type { GameStatus, Match } from '@/data/schemas';

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

const KICKOFF = new Date('2026-09-14T19:30:00Z'); // 20:30 em Lisboa
// Fora da semana de KICKOFF, para a data sair como "14 Set" (ptDate.formatKickoffDate).
const NOW = new Date('2026-09-09T10:00:00Z');

function match(over: Partial<Match> = {}): Match {
  return {
    id: '1001',
    sport: 'football',
    competition: {
      key: 'football_94_2026',
      id: '94',
      name: 'Liga Portugal',
      type: 'league',
      season: '2026',
      round: 'Regular Season - 16',
      roundLabel: null,
    },
    home: { id: '228', name: 'Sporting CP', logo: null },
    away: { id: '217', name: 'SC Braga', logo: 'https://example.com/217.png' },
    sportingSide: 'home',
    kickoff: KICKOFF,
    status: 'NS' as GameStatus,
    elapsed: null,
    elapsedExtra: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null,
    venue: null,
    referee: null,
    source: { provider: 'api-football', id: '1001', attribution: null },
    ...over,
  } as Match;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

describe('jogo por jogar', () => {
  it('data numa linha por cima (20/11) e a hora na caixa do meio; sem competição por omissão (jornadas)', async () => {
    await render(<MatchRow match={match()} onPress={jest.fn()} />);
    expect(screen.getByText('SEG 14 SET')).toBeTruthy();
    expect(screen.queryByTestId('row-competition')).toBeNull();
    expect(screen.getByTestId('row-time').props.children).toBe('20:30');
    expect(screen.queryByTestId('row-score')).toBeNull();
    expect(screen.queryByText('Liga Portugal')).toBeNull();
    expect(screen.queryByTestId('row-arrow')).toBeNull();
  });

  it('carregar na linha devolve o id do jogo', async () => {
    const onPress = jest.fn();
    await render(<MatchRow match={match()} onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('match-row-1001'));
    expect(onPress).toHaveBeenCalledWith('1001');
  });

  it('sem onPress a linha não é botão (F9)', async () => {
    await render(<MatchRow match={match()} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('match-row-1001').props.accessible).toBe(true);
  });
});

describe('resultado', () => {
  it('FT 3-0 mostra "3-0" na caixa e não a hora', async () => {
    await render(
      <MatchRow
        match={match({ status: 'FT', score: { home: 3, away: 0, halftime: null, extratime: null, penalty: null } })}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByTestId('row-score').props.children).toBe('3-0');
    expect(screen.queryByTestId('row-time')).toBeNull();
  });

  it('desempate por penáltis usa o texto partilhado da Task 4', async () => {
    await render(
      <MatchRow
        match={match({
          status: 'PEN',
          score: { home: 1, away: 1, halftime: null, extratime: null, penalty: { home: 4, away: 3 } },
        })}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('4-3 g.p.')).toBeTruthy();
  });
});

describe('adiado e cancelado (Review Focus 2)', () => {
  it('PST mostra "Adiado" e nunca a hora', async () => {
    await render(<MatchRow match={match({ status: 'PST' })} onPress={jest.fn()} />);
    expect(screen.getByText('Adiado')).toBeTruthy();
    expect(screen.queryByText('20:30')).toBeNull();
    expect(screen.getByText('SEG 14 SET')).toBeTruthy();
    expect(screen.queryByTestId('row-score')).toBeNull();
  });

  it('CANC mostra "Cancelado" e não mostra resultado', async () => {
    await render(
      <MatchRow
        match={match({ status: 'CANC', score: { home: 0, away: 0, halftime: null, extratime: null, penalty: null } })}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('Cancelado')).toBeTruthy();
    expect(screen.queryByTestId('row-score')).toBeNull();
    expect(screen.queryByText('20:30')).toBeNull();
  });
});

describe('leitores de ecrã', () => {
  it('a ronda da API sai traduzida no rótulo ("Round of 32" em português)', async () => {
    await render(
      <MatchRow
        match={match({ competition: { key: 'football_96_2026', id: '96', name: 'Taça de Portugal', type: 'cup', season: '2026', round: 'Round of 32', roundLabel: null } })}
        onPress={jest.fn()}
      />,
    );
    const label = screen.getByTestId('match-row-1001').props.accessibilityLabel as string;
    expect(label).toContain('Taça de Portugal, 16 avos de final');
    expect(label).not.toMatch(/Round of/);
  });

  it('a linha por jogar lê-se de uma vez: equipas, competição e estado', async () => {
    await render(<MatchRow match={match()} onPress={jest.fn()} />);
    const row = screen.getByTestId('match-row-1001');
    expect(row.props.accessible).toBe(true);
    expect(row.props.accessibilityLabel).toBe('Sporting CP contra SC Braga. Liga Portugal, J16. Próximo');
  });

  it('com resultado o rótulo traz o resultado em vez de "contra"', async () => {
    await render(
      <MatchRow
        match={match({ status: 'PEN', score: { home: 1, away: 1, halftime: null, extratime: null, penalty: { home: 4, away: 3 } } })}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByTestId('match-row-1001').props.accessibilityLabel).toBe(
      'Sporting CP 1-1 (4-3 g.p.) SC Braga. Liga Portugal, J16. Terminado',
    );
  });

  it('adiado entra no rótulo e a linha sem onPress também o tem', async () => {
    await render(<MatchRow match={match({ status: 'PST' })} />);
    expect(screen.getByTestId('match-row-1001').props.accessibilityLabel).toBe(
      'Sporting CP contra SC Braga. Liga Portugal, J16. Adiado',
    );
  });
});

describe('nomes longos (Review Focus 4)', () => {
  const long = match({
    sport: 'futsal',
    competition: {
      key: 'futsal_1_2026',
      id: '1',
      name: 'Liga dos Campeões UEFA de Futsal',
      type: 'europe',
      season: '2026',
      round: 'Round of 32',
      roundLabel: null,
    },
    home: { id: '228', name: 'Sporting Clube de Portugal B', logo: null },
    away: { id: '9', name: 'Gil Vicente Futebol Clube de Barcelos', logo: null },
    status: 'FT',
    score: { home: 3, away: 0, halftime: null, extratime: null, penalty: null },
  } as Partial<Match>);

  it('nomes ficam numa linha com reticências', async () => {
    await render(<MatchRow match={long} onPress={jest.fn()} />);
    for (const text of ['Sporting Clube de Portugal B', 'Gil Vicente Futebol Clube de Barcelos']) {
      const node = screen.getByText(text);
      expect(node.props.numberOfLines).toBe(1);
      expect(node.props.ellipsizeMode).toBe('tail');
    }
  });

  it('o resultado e a data não são empurrados para fora: as colunas fixas não encolhem', async () => {
    await render(<MatchRow match={long} onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('row-center').props.style)).toEqual(
      expect.objectContaining({ flexShrink: 0, width: layout.matchRowCenter }),
    );
    expect(screen.getByTestId('row-score').props.children).toBe('3-0');
  });

  it('no Calendário (showCompetition) a linha de cima leva a competição e a jornada', async () => {
    await render(<MatchRow match={match()} showCompetition onPress={jest.fn()} />);
    expect(screen.getByTestId('row-competition').props.children).toMatch(/^LIGA PORTUGAL/);
  });

  describe('21/11 (Figma 35c): competição numa linha, jornada · data por baixo, maior a partir de 375 pt', () => {
    it('a competição fica sozinha na primeira linha e a jornada abre a segunda', async () => {
      await render(<MatchRow match={match()} showCompetition onPress={jest.fn()} />);
      expect(screen.getByTestId('row-competition').props.children).toBe('LIGA PORTUGAL');
      expect(StyleSheet.flatten(screen.getByTestId('row-date').props.style).flexDirection).toBeUndefined();
      expect(screen.getByText('J16')).toBeTruthy();
    });

    it('cresce a partir de 375 pt: 320 e 360 não, 375, 393 e 430 sim', () => {
      expect([320, 360, 374, 375, 393, 430].map(rowIsLarge)).toEqual([false, false, false, true, true, true]);
    });

    it('num ecrã grande (o do teste) emblemas 40 e nomes 18', async () => {
      await render(<MatchRow match={match()} showCompetition onPress={jest.fn()} />);
      expect(StyleSheet.flatten(screen.getByText('Sporting CP').props.style).fontSize).toBe(18);
    });

    it('fora do Calendário nunca cresce nem mostra a competição', async () => {
      await render(<MatchRow match={match()} onPress={jest.fn()} />);
      expect(screen.queryByTestId('row-competition')).toBeNull();
      expect(StyleSheet.flatten(screen.getByText('Sporting CP').props.style).fontSize).toBe(16);
    });
  });

  it('emblema da casa e de fora presentes com nomes longos', async () => {
    await render(<MatchRow match={long} onPress={jest.fn()} />);
    expect(screen.getByTestId('row-crest-home', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('row-crest-away')).toBeTruthy();
  });
});

describe('emblema de recurso (modalidades sem emblema na fonte)', () => {
  it('sem emblema mostra as iniciais do adversário no espaço do emblema', async () => {
    await render(
      <MatchRow
        match={{
          id: 'fs_1', sport: 'futsal',
          competition: { key: 'futsal_liga_2026-2027', id: 'liga', name: 'Liga Placard', type: 'league', season: '2026-2027', round: null, roundLabel: null },
          home: { id: 'fundao', name: 'AD Fundão', logo: null },
          away: { id: 'sporting', name: 'Sporting CP', logo: 'https://s360-prognostico-download.web.app/brand/sporting-cp-2026.png' },
          sportingSide: 'away', kickoff: new Date('2026-11-22T20:30:00Z'), status: 'NS', elapsed: null, elapsedExtra: null,
          score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
          finishedAt: null, venue: null, referee: null, source: { provider: 'futsalportugal', id: '1', attribution: null },
        } as never}
        onPress={() => undefined}
      />,
    );
    expect(screen.getByText('FU', { includeHiddenElements: true })).toBeTruthy();
  });
});
