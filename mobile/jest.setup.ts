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

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('react-native-gesture-handler/jestSetup');

// Reanimated 4 / Worklets precisam do módulo nativo (o mock oficial também falha em Jest): mock mínimo à mão.
// Cobre só o que os componentes usam; estender aqui quando outra tarefa precisar de mais.
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const sv = <T,>(v: T) => { let cur = v; return { get: () => cur, set: (n: T) => { cur = n; } }; };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => require('react').useRef(sv(v)).current,
    useAnimatedStyle: (fn: () => object) => fn(),
    useReducedMotion: () => false,
    useEvent: () => () => {},
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
    makeMutable: (v: unknown) => ({ get: () => v, set: () => {} }),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
  };
});
