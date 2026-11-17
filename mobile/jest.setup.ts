import { Text } from 'react-native';
import React from 'react';

// expo-router is mocked globally so screens that use `Link` render without a
// navigation container. Tests that need real routing should unmock locally.
jest.mock('expo-router', () => {
  const ReactMock = require('react') as typeof React;
  const { Text: RNText } = require('react-native') as { Text: typeof Text };
  return {
    Link: ({ children }: { children?: React.ReactNode }) =>
      ReactMock.createElement(RNText, null, children),
    Stack: Object.assign(() => null, { Screen: () => null }),
    Slot: () => null,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({}),
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  };
});
