// Task 20: ecrã das Notícias. Hooks mockados (sem rede); o browser interno é o mock de expo-web-browser.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

type L =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: unknown; fromCache?: boolean };

const mockNews: { current: L } = { current: { status: 'loading' } };
const mockNow: { current: Date } = { current: new Date('2026-11-18T12:00:00Z') };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/data/user', () => ({ useNews: jest.fn(() => mockNews.current) }));
jest.mock('@/data/clock', () => ({ useNow: jest.fn(() => mockNow.current) }));
jest.mock('@/lib/report', () => ({ reportCode: jest.fn() }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { useNow } from '@/data/clock';
import { reportCode } from '@/lib/report';
import { useNews } from '@/data/user';
import Noticias from '../../app/(app)/noticias';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <Noticias />
    </SafeAreaProvider>,
  );
const ready = (data: unknown, fromCache?: boolean): L => ({ status: 'ready', data, fromCache });
const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Título ${id}`,
  image: `https://img.exemplo.pt/${id}.jpg`,
  summary: `Resumo ${id}`,
  source: 'Record',
  url: `https://www.record.pt/${id}`,
  sport: 'football',
  publishedAt: new Date('2026-11-18T09:00:00Z'),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockNews.current = ready([item('a'), item('b', { url: 'https://www.record.pt/b' })]);
  mockNow.current = new Date('2026-11-18T12:00:00Z');
});

describe('Notícias: filtro', () => {
  it('abre em Todas (useNews(null)) e cada modalidade filtra no servidor', async () => {
    await renderScreen();
    expect(useNews).toHaveBeenLastCalledWith(null);
    await fireEvent.press(screen.getByRole('tab', { name: 'Andebol' }));
    expect(useNews).toHaveBeenLastCalledWith('handball');
    await fireEvent.press(screen.getByRole('tab', { name: 'Todas' }));
    expect(useNews).toHaveBeenLastCalledWith(null);
  });

  it('o filtro tem Todas e as 6 modalidades', async () => {
    await renderScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
  });
});

describe('Notícias: lista', () => {
  it('mostra título, resumo, fonte e há X tempo, sem repetir chaves', async () => {
    await renderScreen();
    expect(screen.getByText('Título a')).toBeTruthy();
    expect(screen.getByText('Resumo a')).toBeTruthy();
    expect(screen.getAllByText(/Record · há 3 horas/)).toHaveLength(2);
    expect(screen.getAllByTestId('news-image')).toHaveLength(2);
  });

  it('o tempo relativo avança com o relógio (useNow a cada minuto)', async () => {
    await renderScreen();
    expect(useNow).toHaveBeenCalledWith(60_000);
  });

  it('o conteúdo do artigo nunca é lido nem mostrado', async () => {
    mockNews.current = ready([item('a', { content: '<p>CORPO SECRETO</p>' })]);
    await renderScreen();
    expect(screen.queryByText(/CORPO SECRETO/)).toBeNull();
  });

  it('título longo ocupa no máximo duas linhas', async () => {
    mockNews.current = ready([item('a', { title: 'Muito '.repeat(60) })]);
    await renderScreen();
    expect(screen.getByText(/^Muito/).props.numberOfLines).toBe(2);
  });
});

describe('Notícias: abrir o artigo', () => {
  it('toque abre openBrowserAsync com o url (browser interno)', async () => {
    await renderScreen();
    await fireEvent.press(screen.getAllByRole('link')[0]!);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://www.record.pt/a');
  });

  it.each(['', 'http://www.record.pt/x', 'javascript:alert(1)', 'intent://x', 'mailto:a@b.pt', '//record.pt/x', 'record.pt/x'])(
    'não abre o url %s (só https)',
    async (url) => {
      mockNews.current = ready([item('a', { url })]);
      await renderScreen();
      await fireEvent.press(screen.getAllByRole('link')[0]!);
      expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    },
  );

  it('falha do browser não rebenta o ecrã', async () => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockRejectedValueOnce(new Error('sem browser'));
    await renderScreen();
    await fireEvent.press(screen.getAllByRole('link')[0]!);
    expect(screen.getByText('Título a')).toBeTruthy();
    await waitFor(() => expect(reportCode).toHaveBeenCalledWith('OPEN_LINK_FAILED https://www.record.pt/a', expect.any(Error)));
  });
});

describe('Notícias: estados', () => {
  it('vazio em Todas e numa modalidade', async () => {
    mockNews.current = ready([]);
    await renderScreen();
    expect(screen.getByText('Sem notícias por agora.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Andebol' }));
    expect(screen.getByText('Sem notícias de andebol por agora.')).toBeTruthy();
  });

  it('leitura falhada mostra erro, nunca a mensagem de vazio', async () => {
    mockNews.current = { status: 'error', error: new Error('x') };
    await renderScreen();
    expect(screen.getByText('Não foi possível carregar as notícias.')).toBeTruthy();
    expect(screen.queryByText(/Sem notícias/)).toBeNull();
  });

  it('a carregar não mostra vazio nem erro', async () => {
    mockNews.current = { status: 'loading' };
    await renderScreen();
    expect(screen.queryByTestId('empty-state')).toBeNull();
    expect(screen.getByTestId('noticias-loading')).toBeTruthy();
  });

  it('fromCache mostra o OfflineBanner; sem cache não', async () => {
    mockNews.current = ready([item('a')], true);
    await renderScreen();
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });

  it('sem fromCache não há OfflineBanner', async () => {
    mockNews.current = ready([item('a')], false);
    await renderScreen();
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });
});
