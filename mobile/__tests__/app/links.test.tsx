// Task 25: Mapa do estádio, Sites do clube e Comunidade Leonina (escondida pela flag). Hooks mockados, browser = mock.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

type L = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: unknown };
const mockConfig: { current: L } = { current: { status: 'loading' } };

jest.mock('expo-router', () => {
  const { View } = require('react-native');
  return {
    useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
    Redirect: ({ href }: { href: string }) => <View testID="redirect" accessibilityLabel={href} />,
  };
});
jest.mock('@/data/hooks', () => ({ useAppConfig: jest.fn(() => mockConfig.current) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { CLUB_SITES, STADIUM_LINKS } from '@/content/clubLinks';
import Comunidade from '../../app/(app)/comunidade';
import Estadio from '../../app/(app)/estadio';
import Sites from '../../app/(app)/sites';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.JSX.Element) => <SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>;
const cfg = (flag: unknown, list: unknown[] = []): L => ({
  status: 'ready',
  data: { features: { comunidadeLeonina: flag }, comunidadeLeonina: list },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.current = { status: 'loading' };
});

describe('Sites do clube', () => {
  it('mostra as 4 ligações do Figma pela ordem e abre a Loja Verde no browser da app', async () => {
    await render(wrap(<Sites />));
    expect(CLUB_SITES.map((s) => s.label)).toEqual(['Site do Sporting', 'Sporting num Minuto', 'Loja Verde', 'Bilheteira Online']);
    expect(screen.getByText('Aqui podes encontrar ligações diretas para os sites oficiais do clube.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Loja Verde'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://lojaverde.sporting.pt/pt');
  });

  it('todas as ligações são https', async () => {
    for (const s of CLUB_SITES) expect(s.url).toMatch(/^https:\/\//);
  });
});

describe('Mapa do estádio', () => {
  it('o botão de zoom alterna o rótulo', async () => {
    await render(wrap(<Estadio />));
    expect(screen.getByLabelText('Ampliar mapa')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ampliar mapa'));
    expect(screen.getByLabelText('Reduzir mapa')).toBeTruthy();
    expect(screen.queryByLabelText('Ampliar mapa')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reduzir mapa'));
    expect(screen.getByLabelText('Ampliar mapa')).toBeTruthy();
  });

  it('abre Loja Verde e Bilheteira no browser da app; sem Museu', async () => {
    await render(wrap(<Estadio />));
    expect(STADIUM_LINKS.map((l) => l.id)).toEqual(['loja', 'bilheteira']);
    expect(screen.queryByLabelText('Museu Sporting')).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(Object.keys(require('@/content/clubLinks'))).not.toContain('STADIUM_TODOS');
    await fireEvent.press(screen.getByLabelText('Loja Verde'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith('https://lojaverde.sporting.pt/pt');
    await fireEvent.press(screen.getByLabelText('Bilheteira'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith('https://tickets.sporting.pt/');
  });
});

describe('Comunidade Leonina (escondida)', () => {
  it('com a flag a false redireciona para a Home', async () => {
    mockConfig.current = cfg(false, [{ name: 'X', links: { youtube: 'https://youtube.com/x' } }]);
    await render(wrap(<Comunidade />));
    expect(screen.getByTestId('redirect').props.accessibilityLabel).toBe('/');
    expect(screen.queryByText('X')).toBeNull();
  });

  it('config com erro também redireciona; a carregar mostra o Header com voltar e o estado a carregar, sem redirecionar', async () => {
    mockConfig.current = { status: 'loading' };
    const a = await render(wrap(<Comunidade />));
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.getByText('Comunidade Leonina')).toBeTruthy();
    expect(screen.getByLabelText('Voltar')).toBeTruthy();
    expect(screen.getByTestId('comunidade-loading')).toBeTruthy();
    expect(screen.queryByText('Aqui podes encontrar onde na web se fala sobre o Sporting')).toBeNull();
    await a.unmount();
    mockConfig.current = { status: 'error', error: new Error('x') };
    await render(wrap(<Comunidade />));
    expect(screen.getByTestId('redirect')).toBeTruthy();
  });

  it('com a flag a true e uma entrada só com youtube mostra só "Youtube"', async () => {
    mockConfig.current = cfg(true, [{ name: 'Spaces Sporting', links: { youtube: 'https://www.youtube.com/@spaces' } }]);
    await render(wrap(<Comunidade />));
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.getByText('Aqui podes encontrar onde na web se fala sobre o Sporting')).toBeTruthy();
    expect(screen.getByText('Spaces Sporting')).toBeTruthy();
    expect(screen.getByText('Youtube')).toBeTruthy();
    expect(screen.queryByText('Twitter')).toBeNull();
    expect(screen.queryByText('Patreon')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Youtube'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://www.youtube.com/@spaces');
  });

  it('ignora ligações que não são https', async () => {
    mockConfig.current = cfg(true, [{ name: 'A', links: { twitter: 'http://x.com/a', patreon: 'javascript:alert(1)' } }]);
    await render(wrap(<Comunidade />));
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByText('Twitter')).toBeNull();
    expect(screen.queryByText('Patreon')).toBeNull();
  });
});
