// Task 17: entrada do link partilhado (/j?src=share&game=...). Router real; destino e Home são ecrãs vazios.
jest.unmock('expo-router');
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));

import { renderRouter, screen } from 'expo-router/testing-library';
import { track } from '@/services/analytics';

const ROUTES = {
  index: () => null,
  'jogo/[id]': () => null,
  j: require('../../app/(app)/j').default,
};

beforeEach(() => jest.clearAllMocks());

describe('/j', () => {
  it('com game abre o jogo na tab Prognóstico e mede a abertura', async () => {
    await renderRouter(ROUTES, { initialUrl: '/j?game=1001&src=share' });
    expect(screen).toHavePathname('/jogo/1001');
    expect(screen).toHaveSearchParams({ id: '1001', tab: 'sumario' });
    expect(track).toHaveBeenCalledWith('share_open', { game: '1001', src: 'share' });
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('sem src mede só o jogo', async () => {
    await renderRouter(ROUTES, { initialUrl: '/j?game=1001' });
    expect(screen).toHavePathname('/jogo/1001');
    expect(track).toHaveBeenCalledWith('share_open', { game: '1001' });
  });

  it('sem game vai para a Home sem medir', async () => {
    await renderRouter(ROUTES, { initialUrl: '/j?src=share' });
    expect(screen).toHavePathname('/');
    expect(track).not.toHaveBeenCalled();
  });

  it('game inválido vai para a Home', async () => {
    await renderRouter(ROUTES, { initialUrl: '/j?game=..%2Fdefinicoes' });
    expect(screen).toHavePathname('/');
    expect(track).not.toHaveBeenCalled();
  });
});
