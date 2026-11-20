// Ecrã do MVP (20/11): abre pela taça do jogo; mostra o resultado compacto e o conteúdo do MVP.
import { render, screen } from '@testing-library/react-native';

const mockMatch: { current: unknown } = { current: { status: 'loading' } };
jest.mock('@/data/sports', () => ({ useMatch: jest.fn(() => mockMatch.current) }));
jest.mock('@/components/match/MvpTab', () => {
  const { Text } = require('react-native');
  return { MvpTab: ({ match }: { match: { id: string } }) => <Text testID="mvp-content">{match.id}</Text> };
});
jest.mock('@/components/GameHeader', () => {
  const { View } = require('react-native');
  return { GameHeader: () => <View testID="compact-score" /> };
});
jest.mock('@/lib/matchVM', () => ({ toGameHeaderVM: () => ({}) }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: '1001' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

import MvpScreen from '../../app/(app)/mvp/[id]';

describe('ecrã do MVP', () => {
  it('a carregar: esqueleto', async () => {
    mockMatch.current = { status: 'loading' };
    await render(<MvpScreen />);
    expect(screen.getByTestId('mvp-screen-skeleton')).toBeTruthy();
  });
  it('com o jogo: resultado compacto e conteúdo do MVP desse jogo', async () => {
    mockMatch.current = { status: 'ready', data: { id: '1001' } };
    await render(<MvpScreen />);
    expect(screen.getByTestId('compact-score')).toBeTruthy();
    expect(screen.getByTestId('mvp-content').props.children).toBe('1001');
  });
  it('jogo que não existe', async () => {
    mockMatch.current = { status: 'missing' };
    await render(<MvpScreen />);
    expect(screen.getByText('Jogo não encontrado.')).toBeTruthy();
  });
});
