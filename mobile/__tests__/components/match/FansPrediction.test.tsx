// Plano 10 (Figma 52a/52b/52c): previsão dos sportinguistas.
import { render, screen } from '@testing-library/react-native';
import type { GameStatus, Match } from '@/data/schemas';

type L = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; data: unknown };
const mockDoc: { current: L } = { current: { status: 'missing' } };
jest.mock('@/data/sports', () => ({ useFansPrediction: jest.fn(() => mockDoc.current) }));

import { FansPrediction } from '@/components/match/FansPrediction';

const match = (status: GameStatus) => ({ id: '1001', status }) as unknown as Match;
const ready = (data: object): L => ({ status: 'ready', data: { gameId: '1001', ...data } });

describe('FansPrediction', () => {
  it('antes do apito, com 50 ou mais: título e o número de palpites com separador de milhares, sem frases', async () => {
    mockDoc.current = ready({ total: 1234 });
    await render(<FansPrediction match={match('NS')} />);
    expect(screen.getByText('Previsão dos sportinguistas')).toBeTruthy();
    expect(screen.getByText('1.234')).toBeTruthy();
    expect(screen.getByText('Palpites')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('abaixo de 50 não mostra nada', async () => {
    mockDoc.current = ready({ total: 49 });
    await render(<FansPrediction match={match('NS')} />);
    expect(screen.queryByTestId('fans-prediction')).toBeNull();
  });

  it('ao vivo: vitória/empate/derrota em percentagem, a maior destacada', async () => {
    mockDoc.current = ready({ total: 100, win: 68, draw: 21, loss: 11 });
    await render(<FansPrediction match={match('LIVE')} />);
    expect(screen.getByText('68%')).toBeTruthy();
    expect(screen.getByText('21%')).toBeTruthy();
    expect(screen.getByText('11%')).toBeTruthy();
    for (const l of ['Vitória', 'Empate', 'Derrota']) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.getByTestId('fans-col-0').props.accessibilityLabel).toBe('Vitória 68%');
    expect(screen.queryByText('Palpites')).toBeNull();
  });

  it('terminado: as percentagens continuam', async () => {
    mockDoc.current = ready({ total: 100, win: 10, draw: 20, loss: 70 });
    await render(<FansPrediction match={match('FT')} />);
    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('a carregar, sem documento ou com erro: nada', async () => {
    for (const s of [{ status: 'loading' }, { status: 'missing' }, { status: 'error' }] as L[]) {
      mockDoc.current = s;
      const r = await render(<FansPrediction match={match('NS')} />);
      expect(screen.queryByTestId('fans-prediction')).toBeNull();
      r.unmount();
    }
  });
});
