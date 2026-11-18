import { render } from '@testing-library/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

import RootLayout from '../../app/_layout';

jest.mock('../../global.css', () => ({}));
jest.mock('../../src/providers/SessionProvider', () => ({
  SessionProvider: ({ children }: { children?: React.ReactNode }) => children,
  useSession: () => ({ status: 'loading' }),
}));
jest.mock('../../src/providers/UpdateGate', () => ({
  UpdateGate: ({ children }: { children?: React.ReactNode }) => children,
}));
jest.mock('../../src/services/firebase', () => ({ initFirebase: jest.fn() }));
jest.mock('../../src/services/legacyCleanup', () => ({ legacyCleanup: jest.fn() }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

describe('RootLayout orientation', () => {
  it('locks to portrait once at startup', async () => {
    const view = await render(<RootLayout />);
    await view.rerender(<RootLayout />);
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledTimes(1);
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  });
});
