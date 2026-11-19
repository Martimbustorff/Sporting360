// Plano 9: o histórico do perfil lê cada jogo uma só vez (getDoc), sem listener por linha e sem escrever nada.
import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { getDoc, onSnapshot } from '@react-native-firebase/firestore';
import { useMatchOnce } from '@/data/sports';

jest.mock('@react-native-firebase/app');
jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/crashlytics');

const getDocMock = getDoc as unknown as jest.Mock;
const raw = (id: string) => ({
  id,
  sport: 'football',
  competition: { key: 'k', id: '94', name: 'Liga', type: 'league', season: '2026', round: null, roundLabel: null },
  home: { id: '228', name: 'Sporting CP', logo: null },
  away: { id: '212', name: 'FC Porto', logo: null },
  sportingSide: 'home',
  kickoff: new Date('2026-11-12T20:00:00Z'),
  status: 'FT',
  elapsed: null,
  elapsedExtra: null,
  score: { home: 2, away: 1, halftime: null, extratime: null, penalty: null },
  finishedAt: null,
  venue: null,
  referee: null,
  source: { provider: 'api-football', id: id },
});
function Row({ id }: { id: string | null }) {
  const m = useMatchOnce(id);
  return <Text testID="r">{m === undefined ? 'loading' : m === null ? 'null' : `${m.home.name}-${m.away.name}`}</Text>;
}

beforeEach(() => {
  getDocMock.mockReset();
  (onSnapshot as unknown as jest.Mock).mockClear();
});

it('lê o jogo uma vez, sem listener, e reaproveita a leitura nas linhas seguintes', async () => {
  getDocMock.mockResolvedValue({ exists: () => true, data: () => raw('mo1') });
  await render(<Row id="mo1" />);
  await act(async () => {});
  expect(screen.getByTestId('r').props.children).toBe('Sporting CP-FC Porto');
  await render(<Row id="mo1" />);
  await act(async () => {});
  expect(getDocMock).toHaveBeenCalledTimes(1);
  expect(onSnapshot).not.toHaveBeenCalled();
});

it('jogo em falta ou inválido dá null', async () => {
  getDocMock.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
  await render(<Row id="mo-missing" />);
  await act(async () => {});
  expect(screen.getByTestId('r').props.children).toBe('null');
  getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ nope: true }) });
  const view = await render(<Row id="mo-bad" />);
  await act(async () => {});
  expect(view.toJSON()).toBeTruthy();
});

it('leitura falhada dá null e a próxima linha tenta outra vez', async () => {
  getDocMock.mockRejectedValueOnce(new Error('offline'));
  await render(<Row id="mo-fail" />);
  await act(async () => {});
  expect(screen.getByTestId('r').props.children).toBe('null');
  getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => raw('mo-fail') });
  await render(<Row id="mo-fail" />);
  await act(async () => {});
  expect(getDocMock).toHaveBeenCalledTimes(2);
});

it('sem id não lê nada', async () => {
  await render(<Row id={null} />);
  expect(getDocMock).not.toHaveBeenCalled();
  expect(screen.getByTestId('r').props.children).toBe('null');
});
