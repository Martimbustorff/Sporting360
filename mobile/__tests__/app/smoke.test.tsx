import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Task 5: a Home lê dados; aqui só se confirma que monta (o comportamento está em home.test).
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: null, providers: ['password'] } }),
}));
jest.mock('@/data/hooks', () => ({
  useMyUser: () => ({ status: 'loading' }),
  usePublicProfile: () => ({ status: 'loading' }),
  useAppConfig: () => ({ status: 'loading' }),
}));
jest.mock('@/data/user', () => ({ useMyGameboxes: () => ({ status: 'loading' }) }));
jest.mock('@/data/sports', () => ({ useNextFootballMatch: () => ({ status: 'loading' }) }));

import Home from '../../app/(app)/index';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

describe('app shell', () => {
  it('renders the S360 home screen', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <GestureHandlerRootView>
          <Home />
        </GestureHandlerRootView>
      </SafeAreaProvider>,
    );
    expect(screen.getByText('S360')).toBeTruthy();
  });
});
