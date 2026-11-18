// Task 5: cada rota de (app) monta com o router real (expo-router/testing-library), sessão aberta.
// Mockados: sessão, BiometricGate, hooks de dados e os serviços dos ecrãs já existentes.
jest.unmock('expo-router');

jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: 'ze@x.pt', providers: ['password'] } }),
}));
jest.mock('@/providers/BiometricGate', () => ({ BiometricGate: ({ children }: { children: unknown }) => children }));
jest.mock('@/data/hooks', () => ({
  useMyUser: () => ({ status: 'loading' }),
  usePublicProfile: () => ({ status: 'loading' }),
  useAppConfig: () => ({ status: 'loading' }),
}));
// expo-router/testing-library troca o mock de Reanimated pelo oficial, que falha em Jest: a folha (Sheet) fica de fora.
jest.mock('@/components/HomeGameboxSheet', () => ({ HomeGameboxSheet: () => null, useGameboxSheetCollapsedHeight: () => 116 }));
// Task 6: a folha de consentimento (também uma Sheet) tem o mesmo problema; testada em AnalyticsConsentSheet.test.
jest.mock('@/components/AnalyticsConsentSheet', () => ({ AnalyticsConsentSheet: () => null }));
jest.mock('@/data/sports', () => ({
  useNextFootballMatch: () => ({ status: 'ready', data: null }),
  // Task 7: a Agenda lê as duas listas da modalidade escolhida.
  useUpcomingMatches: () => ({ status: 'ready', data: [] }),
  useResultMatches: () => ({ status: 'ready', data: [] }),
  // Task 8: o detalhe do jogo lê o documento do jogo (aqui fica no esqueleto).
  useMatch: () => ({ status: 'loading' }),
  // Task 13: o ecrã da competição lê o documento da competição (aqui fica a carregar).
  useCompetition: () => ({ status: 'loading' }),
  useCompetitionData: () => ({ status: 'loading' }),
  // Task 14: equipa e jogador (aqui ficam a carregar).
  useTeamData: () => ({ status: 'loading' }),
  usePlayerStats: () => ({ status: 'loading' }),
  useTeamStats: () => ({ status: 'loading' }),
  useSeasonFootballCompetitions: () => ({ status: 'loading' }),
}));
// Task 19: o Ranking lê o top 100 e a entrada do próprio; Task 20: as Notícias leem a lista (aqui ficam a carregar).
jest.mock('@/data/user', () => ({
  useNews: () => ({ status: 'loading' }),
  useLeaderboard: () => ({ status: 'loading' }),
  useMyLeaderboardEntry: () => ({ status: 'loading' }),
  fetchMyPosition: jest.fn(),
}));
jest.mock('@/services/firebase', () => ({ authInstance: jest.fn(), fns: jest.fn(), db: jest.fn() }));
jest.mock('@/services/auth', () => ({ signOut: jest.fn() }));
jest.mock('@/services/biometrics', () => ({ setBiometricEnabled: jest.fn() }));
jest.mock('@/services/profile', () => ({ updateDisplayName: jest.fn() }));
jest.mock('@/services/social', () => ({
  linkAppleToCurrentUser: jest.fn(),
  reauthenticateWithApple: jest.fn(),
  reauthenticateWithGoogle: jest.fn(),
  APPLE_IN_USE_MESSAGE: 'x',
  NEEDS_EXISTING_LOGIN_MESSAGE: 'x',
}));
jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('expo-apple-authentication', () => {
  const { View } = require('react-native');
  return {
    AppleAuthenticationButton: View,
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
    isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  };
});

import { renderRouter, screen } from 'expo-router/testing-library';

const ROUTES = {
  '(app)/_layout': require('../../app/(app)/_layout').default,
  '(app)/index': require('../../app/(app)/index').default,
  '(app)/agenda': require('../../app/(app)/agenda').default,
  '(app)/jogo/[id]': require('../../app/(app)/jogo/[id]').default,
  '(app)/competicao/[key]': require('../../app/(app)/competicao/[key]').default,
  '(app)/equipa/index': require('../../app/(app)/equipa/index').default,
  '(app)/equipa/jogador/[id]': require('../../app/(app)/equipa/jogador/[id]').default,
  '(app)/noticias': require('../../app/(app)/noticias').default,
  '(app)/ranking': require('../../app/(app)/ranking').default,
  '(app)/perfil/index': require('../../app/(app)/perfil/index').default,
  '(app)/perfil/editar': require('../../app/(app)/perfil/editar').default,
  '(app)/perfil/notificacoes': require('../../app/(app)/perfil/notificacoes').default,
  '(app)/perfil/nome': require('../../app/(app)/perfil/nome').default,
  '(app)/definicoes/index': require('../../app/(app)/definicoes/index').default,
  '(app)/definicoes/conta': require('../../app/(app)/definicoes/conta').default,
  '(app)/definicoes/password': require('../../app/(app)/definicoes/password').default,
  '(app)/definicoes/termos': require('../../app/(app)/definicoes/termos').default,
  '(app)/gamebox/index': require('../../app/(app)/gamebox/index').default,
  '(app)/gamebox/[id]': require('../../app/(app)/gamebox/[id]').default,
  '(app)/gamebox/ler': require('../../app/(app)/gamebox/ler').default,
  '(app)/estadio': require('../../app/(app)/estadio').default,
  '(app)/sites': require('../../app/(app)/sites').default,
  '(app)/comunidade': require('../../app/(app)/comunidade').default,
  '(app)/apagar-conta': require('../../app/(app)/apagar-conta').default,
  '(app)/ligar-apple': require('../../app/(app)/ligar-apple').default,
  '(app)/j': require('../../app/(app)/j').default,
};

// [url, pathname esperado]
const URLS: [string, string][] = [
  ['/', '/'],
  ['/agenda', '/agenda'],
  ['/jogo/1001', '/jogo/1001'],
  ['/jogo/1001?tab=stats', '/jogo/1001'],
  ['/competicao/football_94_2026', '/competicao/football_94_2026'],
  ['/equipa', '/equipa'],
  ['/equipa/jogador/7', '/equipa/jogador/7'],
  ['/noticias', '/noticias'],
  ['/ranking', '/ranking'],
  ['/perfil', '/perfil'],
  ['/perfil/editar', '/perfil/editar'],
  ['/perfil/notificacoes', '/perfil/notificacoes'],
  ['/perfil/nome', '/perfil/nome'],
  ['/definicoes', '/definicoes'],
  ['/definicoes/conta', '/definicoes/conta'],
  ['/definicoes/password', '/definicoes/password'],
  ['/definicoes/termos', '/definicoes/termos'],
  ['/gamebox', '/gamebox'],
  ['/gamebox/nova', '/gamebox/nova'],
  ['/gamebox/abc', '/gamebox/abc'],
  ['/gamebox/ler', '/gamebox/ler'],
  ['/estadio', '/estadio'],
  ['/sites', '/sites'],
  ['/comunidade', '/comunidade'],
  ['/apagar-conta', '/apagar-conta'],
  ['/ligar-apple', '/ligar-apple'],
  // Task 17: /j sem jogo vai para a Home; com jogo abre o detalhe na tab Prognóstico.
  ['/j', '/'],
  ['/j?src=share&game=1001', '/jogo/1001'],
];

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

it.each(URLS)('%s monta sem erro', async (url, pathname) => {
  await renderRouter(ROUTES, { initialUrl: url });
  expect(screen).toHavePathname(pathname);
  expect(screen.queryByText(/Unmatched Route|This screen doesn't exist/i)).toBeNull();
  expect(errorSpy).not.toHaveBeenCalled();
});
