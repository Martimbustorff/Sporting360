import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-router', () => {
  const { Text: RNText } = require('react-native');
  const { createElement: h } = require('react');
  return {
    Link: (props: { children?: unknown }) => h(RNText, null, props.children),
    Redirect: (props: { href: string }) => h(RNText, { testID: 'redirect' }, `redirect:${props.href}`),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  };
});

import Galeria from '../../app/dev/galeria';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 0 } };
const renderGaleria = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <GestureHandlerRootView>
        <Galeria />
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );

const g = globalThis as unknown as { __DEV__: boolean };

describe('galeria', () => {
  const original = g.__DEV__;
  afterEach(() => {
    g.__DEV__ = original;
  });

  it('em desenvolvimento mostra uma secção por componente', async () => {
    g.__DEV__ = true;
    await renderGaleria();
    for (const name of [
      'Header', 'PrimaryButton', 'TextField', 'Tabs', 'GameHeader', 'CompetitionBadge',
      'EventRow', 'SectionBar', 'MenuRow', 'Sheet', 'NewsCard', 'RankingRow',
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it('mostra o GameHeader agendado e ao vivo', async () => {
    g.__DEV__ = true;
    await renderGaleria();
    expect(screen.getByText('Próximo')).toBeTruthy();
    expect(screen.getByText(/^Live/)).toBeTruthy();
  });

  it('inclui os casos extremos', async () => {
    g.__DEV__ = true;
    await renderGaleria();
    expect(screen.getAllByText('Sporting Clube de Portugal B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('16 avos de final').length).toBeGreaterThan(0);
    expect(screen.getByText('Maria Albuquerque Co')).toBeTruthy();
  });

  it('fora de desenvolvimento redireciona para /', async () => {
    g.__DEV__ = false;
    await renderGaleria();
    expect(screen.getByTestId('redirect').props.children).toBe('redirect:/');
    expect(screen.queryByText('PrimaryButton')).toBeNull();
  });
});
