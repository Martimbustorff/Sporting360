// Plano 8, Task 6: sem sessão o guarda de (app) guarda o link (/e/{id}, /j); depois de entrar, (auth) abre-o.
jest.unmock('expo-router');
jest.mock('@/components/AnalyticsConsentSheet', () => ({ AnalyticsConsentSheet: () => null }));
jest.mock('@/providers/BiometricGate', () => ({ BiometricGate: ({ children }: { children: unknown }) => children }));
jest.mock('@/providers/PushSetup', () => ({ PushSetup: () => null }));
const mockSession: { current: { status: 'signedOut' | 'signedIn'; user: unknown } } = { current: { status: 'signedOut', user: null } };
jest.mock('@/providers/SessionProvider', () => ({ useSession: () => mockSession.current }));
jest.mock('@/services/analytics', () => ({ getAnalyticsConsent: jest.fn(() => Promise.resolve('granted')) }));

import { renderRouter } from 'expo-router/testing-library';
import { setPendingLink, takePendingLink } from '@/lib/pendingLink';
import AuthLayout from '../../app/(auth)/_layout';
import AppLayout from '../../app/(app)/_layout';

const ROUTES = {
  '(auth)/_layout': AuthLayout,
  '(auth)/welcome': () => null,
  '(app)/_layout': AppLayout,
  '(app)/index': () => null,
  '(app)/e/[id]': () => null, // Task 7
  '(app)/j': () => null,
  '(app)/emprestimo/[id]': () => null,
  '(app)/jogo/[id]': () => null,
};

beforeEach(() => {
  takePendingLink();
  mockSession.current = { status: 'signedOut', user: null };
});

describe('link pendente', () => {
  it('sem sessão, /e/{id} guarda o link e vai para /welcome', async () => {
    const r = await renderRouter(ROUTES, { initialUrl: '/e/abc123' });
    expect(r.getPathname()).toBe('/welcome');
    expect(takePendingLink()).toBe('/e/abc123');
  });

  it('sem sessão, /j guarda também a query', async () => {
    await renderRouter(ROUTES, { initialUrl: '/j?src=share&game=1001' });
    expect(takePendingLink()).toBe('/j?src=share&game=1001');
  });

  it('caminhos fora de /e/ e /j não se guardam', async () => {
    await renderRouter(ROUTES, { initialUrl: '/jogo/1001' });
    expect(takePendingLink()).toBeNull();
    await renderRouter(ROUTES, { initialUrl: '/' });
    expect(takePendingLink()).toBeNull();
  });

  it('depois de entrar abre /emprestimo/{id} e o pendente fica consumido', async () => {
    setPendingLink('/e/abc123');
    mockSession.current = { status: 'signedIn', user: { uid: 'u1' } };
    const r = await renderRouter(ROUTES, { initialUrl: '/welcome' });
    expect(r.getPathname()).toBe('/emprestimo/abc123');
    expect(takePendingLink()).toBeNull();
  });

  it('depois de entrar, um /j pendente abre-se com a query', async () => {
    setPendingLink('/j?src=share&game=1001');
    mockSession.current = { status: 'signedIn', user: { uid: 'u1' } };
    const r = await renderRouter(ROUTES, { initialUrl: '/welcome' });
    expect(r.getPathname()).toBe('/j');
    expect(r).toHaveSearchParams({ src: 'share', game: '1001' });
  });

  it('sem pendente vai para a Home', async () => {
    mockSession.current = { status: 'signedIn', user: { uid: 'u1' } };
    const r = await renderRouter(ROUTES, { initialUrl: '/welcome' });
    expect(r.getPathname()).toBe('/');
  });
});
