// Plano 8, Task 7: /e/{id} na app (dentro de (app), para o guarda e o link pendente) e leitura do referrer no arranque.
jest.unmock('expo-router');
jest.mock('@/components/AnalyticsConsentSheet', () => ({ AnalyticsConsentSheet: () => null }));
jest.mock('@/providers/BiometricGate', () => ({ BiometricGate: ({ children }: { children: unknown }) => children }));
jest.mock('@/providers/PushSetup', () => ({ PushSetup: () => null }));
const mockSession: { current: { status: 'loading' | 'signedOut' | 'signedIn'; user: unknown } } = { current: { status: 'signedIn', user: { uid: 'u1' } } };
jest.mock('@/providers/SessionProvider', () => ({ useSession: () => mockSession.current }));
jest.mock('@/services/analytics', () => ({ getAnalyticsConsent: jest.fn(() => Promise.resolve('granted')) }));
const mockRead = jest.fn();
jest.mock('@/lib/installReferrer', () => ({ readLoanReferrerOnce: () => mockRead() }));

import { act } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { LoanReferrerGate } from '@/components/LoanReferrerGate';
import { setPendingLink, takePendingLink } from '@/lib/pendingLink';
import AuthLayout from '../../app/(auth)/_layout';
import AppLayout from '../../app/(app)/_layout';
import LinkEmprestimo from '../../app/(app)/e/[id]';

const ID = 'AbCdEfGhIjKlMnOpQrSt_-';
const ROUTES = {
  '(auth)/_layout': AuthLayout,
  '(auth)/welcome': () => null,
  '(app)/_layout': AppLayout,
  '(app)/index': () => null,
  '(app)/e/[id]': LinkEmprestimo,
  '(app)/emprestimo/[id]': () => null,
  _layout: () => {
    const { Slot } = require('expo-router');
    return (
      <>
        <Slot />
        <LoanReferrerGate />
      </>
    );
  },
};
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  takePendingLink();
  mockRead.mockReset();
  mockRead.mockResolvedValue(null);
  mockSession.current = { status: 'signedIn', user: { uid: 'u1' } };
});

describe('/e/{id}', () => {
  it('id válido abre /emprestimo/{id}', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: `/e/${ID}` });
    expect(r.getPathname()).toBe(`/emprestimo/${ID}`);
  });

  it('id inválido vai para /', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: '/e/curto' });
    expect(r.getPathname()).toBe('/');
  });

  it('sem sessão passa pelo guarda: guarda o link e vai para /welcome', async () => {
    mockSession.current = { status: 'signedOut', user: null };
    const r = await renderRouter(ROUTES, { initialUrl: `/e/${ID}` });
    expect(r.getPathname()).toBe('/welcome');
    expect(takePendingLink()).toBe(`/e/${ID}`);
  });
});

describe('referrer da Play Store no arranque', () => {
  it('com sessão aberta abre o empréstimo diretamente', async () => {
    mockRead.mockResolvedValue(ID);
    const r = await renderRouter(ROUTES, { initialUrl: '/' });
    await flush();
    expect(r.getPathname()).toBe(`/emprestimo/${ID}`);
    expect(takePendingLink()).toBeNull();
  });

  it('sem sessão guarda /e/{id} em setPendingLink (o guarda de (auth) abre o empréstimo depois de entrar)', async () => {
    mockSession.current = { status: 'signedOut', user: null };
    mockRead.mockResolvedValue(ID);
    const r = await renderRouter(ROUTES, { initialUrl: '/' });
    await flush();
    expect(r.getPathname()).toBe('/welcome');
    expect(takePendingLink()).toBe(`/e/${ID}`);
  });

  it('com a sessão a carregar espera por ela antes de decidir', async () => {
    mockSession.current = { status: 'loading', user: null };
    mockRead.mockResolvedValue(ID);
    await renderRouter(ROUTES, { initialUrl: '/' });
    await flush();
    expect(takePendingLink()).toBeNull();
  });

  it('sem referrer não navega', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: '/' });
    await flush();
    expect(r.getPathname()).toBe('/');
  });

  it('lê o referrer uma só vez por arranque', async () => {
    await renderRouter(ROUTES, { initialUrl: '/' });
    await flush();
    expect(mockRead).toHaveBeenCalledTimes(1);
  });
});
