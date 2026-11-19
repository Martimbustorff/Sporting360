// Task 6: folha de consentimento e o seu encaixe em (app)/_layout (depois do BiometricGate abrir).
import { StyleSheet } from 'react-native';
import { layout } from '@/theme/tokens';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('@react-native-firebase/analytics');
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: 'a@b.pt', providers: ['password'] } }),
}));
jest.mock('@/providers/BiometricGate', () => ({ BiometricGate: ({ children }: { children: unknown }) => children }));

import { setAnalyticsCollectionEnabled } from '@react-native-firebase/analytics';
import { CONSENT_POINTS, CONSENT_POLICY, CONSENT_TEXT, CONSENT_TITLE } from '@/components/AnalyticsConsentSheet';
import AppLayout from '../../app/(app)/_layout';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <GestureHandlerRootView>{ui}</GestureHandlerRootView>
  </SafeAreaProvider>
);
const store = SecureStore as unknown as typeof SecureStore & { __reset: () => void };

afterEach(() => {
  store.__reset();
  jest.clearAllMocks();
});

describe('AnalyticsConsentSheet no layout', () => {
  it('sem escolha gravada a folha aparece com o texto e os dois botões', async () => {
    await render(wrap(<AppLayout />));
    expect(await screen.findByText(CONSENT_TITLE)).toBeTruthy();
    expect(screen.getByText(CONSENT_TEXT)).toBeTruthy();
    for (const p of CONSENT_POINTS) expect(screen.getByText(p)).toBeTruthy();
    // O id interno vai para a análise (setUserId): o texto não promete anonimato total.
    expect(screen.getByText('Só dados de utilização da app.')).toBeTruthy();
    expect(screen.queryByText(/sem te identificar/)).toBeNull();
    expect(screen.getByRole('link', { name: CONSENT_POLICY })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeTruthy();
  });

  it('a folha é modal para o leitor de ecrã e respeita o indicador de início', async () => {
    await render(wrap(<AppLayout />));
    await screen.findByText(CONSENT_TITLE);
    const overlay = screen.getByTestId('consent-overlay');
    expect(overlay.props.accessibilityViewIsModal).toBe(true);
    const sheet = overlay.children[0] as unknown as { props: { style: object } };
    expect(StyleSheet.flatten(sheet.props.style) as { paddingBottom: number }).toMatchObject({ paddingBottom: layout.homeIndicator + layout.consentBottomExtra });
  });

  it('o título não é um botão (a folha não se fecha sem escolha) e é anunciado como cabeçalho', async () => {
    await render(wrap(<AppLayout />));
    await screen.findByText(CONSENT_TITLE);
    expect(screen.queryByRole('button', { name: CONSENT_TITLE })).toBeNull();
    expect(screen.getByRole('header', { name: CONSENT_TITLE })).toBeTruthy();
  });

  it('Aceitar grava granted, ativa a recolha e fecha a folha', async () => {
    await render(wrap(<AppLayout />));
    await screen.findByText(CONSENT_TITLE);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }));
    });
    expect(await store.getItemAsync('s360.analyticsConsent')).toBe('granted');
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), true);
    expect(screen.queryByText(CONSENT_TITLE)).toBeNull();
  });

  it('Agora não grava denied, não liga a recolha e a folha não volta', async () => {
    const first = await render(wrap(<AppLayout />));
    await screen.findByText(CONSENT_TITLE);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Agora não' }));
    });
    expect(await store.getItemAsync('s360.analyticsConsent')).toBe('denied');
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(expect.anything(), false);
    expect(screen.queryByText(CONSENT_TITLE)).toBeNull();
    first.unmount();
    await render(wrap(<AppLayout />));
    await act(async () => {});
    expect(screen.queryByText(CONSENT_TITLE)).toBeNull();
  });

  it('com escolha já gravada a folha não aparece', async () => {
    await store.setItemAsync('s360.analyticsConsent', 'granted');
    await render(wrap(<AppLayout />));
    await act(async () => {});
    expect(screen.queryByText(CONSENT_TITLE)).toBeNull();
  });
});
