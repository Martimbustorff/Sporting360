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
    useGlobalSearchParams: () => ({}),
    usePathname: () => '/',
    useIsFocused: () => true,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('react-native-gesture-handler/jestSetup');

// Reanimated 4 / Worklets precisam do módulo nativo (o mock oficial também falha em Jest): mock mínimo à mão.
// Cobre só o que os componentes usam; estender aqui quando outra tarefa precisar de mais.
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, Text } = require('react-native');
  const sv = <T,>(v: T) => { let cur = v; return { get: () => cur, set: (n: T) => { cur = n; } }; };
  return {
    __esModule: true,
    default: { View, ScrollView, Text, createAnimatedComponent: (c: unknown) => c },
    View,
    Text,
    // O handler corre no JS dos testes: o onScroll do worklet é passado tal e qual ao ScrollView.
    useAnimatedScrollHandler: (h: any) => {
      const fn = typeof h === 'function' ? h : h.onScroll;
      return (e: any) => fn(e.nativeEvent ?? e);
    },
    useSharedValue: (v: unknown) => require('react').useRef(sv(v)).current,
    useAnimatedStyle: (fn: () => object) => fn(),
    useReducedMotion: jest.fn(() => false),
    useEvent: () => () => {},
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
    makeMutable: (v: unknown) => ({ get: () => v, set: () => {} }),
    withSpring: jest.fn((v: unknown) => v),
    withTiming: jest.fn((v: unknown) => v),
    withRepeat: jest.fn((v: unknown) => v),
    withSequence: jest.fn((...v: unknown[]) => v[v.length - 1]),
    withDelay: jest.fn((_d: number, v: unknown) => v),
    useDerivedValue: (fn: () => unknown) => ({ get: fn, set: () => {} }),
    useAnimatedReaction: () => {},
    interpolateColor: (_v: number, _i: number[], out: string[]) => out[out.length - 1],
    Easing: { out: (f: unknown) => f, inOut: (f: unknown) => f, cubic: (t: number) => t, linear: (t: number) => t },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    // Animações de layout (entering/layout): objetos encadeáveis que os testes ignoram.
    ...Object.fromEntries(
      ['FlipInXDown', 'FadeIn', 'FadeOut', 'FadeInDown', 'FadeInUp', 'FadeOutUp', 'FadeOutDown', 'LinearTransition', 'SlideInDown', 'SlideInUp', 'ZoomIn'].map((k) => {
        const chain: Record<string, unknown> = {};
        for (const m of ['duration', 'delay', 'springify', 'damping', 'stiffness', 'easing', 'reduceMotion', 'withInitialValues']) chain[m] = () => chain;
        return [k, chain];
      }),
    ),
    LayoutAnimationConfig: ({ children }: { children: unknown }) => children,
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: (v: number, input: number[], output: number[]) => {
      const lo = input[0] as number;
      const hi = input[input.length - 1] as number;
      const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
      return (output[0] as number) + t * ((output[output.length - 1] as number) - (output[0] as number));
    },
  };
});

// react-native-keyboard-controller: mock oficial do pacote (KeyboardAvoidingView -> View, KeyboardProvider -> host).
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
