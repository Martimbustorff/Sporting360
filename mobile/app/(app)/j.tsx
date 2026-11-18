// SEM FIGMA: entrada do link partilhado (Task 17), sem interface: com a app instalada, o link do cartão
// "S360 MATCHDAY" (https://scp360-37a74.web.app/j?src=share&game=...) abre aqui pelos universal links / app links
// (app.json). Com `game` válido mede `share_open` e abre o jogo na tab Prognóstico; sem `game` vai para a Home.
// Sem sessão, o guarda de (app)/_layout manda para /welcome e o jogo perde-se (preflight F29: aceite na Entrega 1).
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { track } from '@/services/analytics';

/** Ids de jogo: só letras, números, `_` e `-` (nunca um caminho). */
const GAME_ID = /^[\w-]{1,64}$/;
/** Origem da medição, curta e sem caracteres estranhos (limite de valor do Analytics). */
const SRC = /^[\w-]{1,40}$/;

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default function LinkPartilhado() {
  const params = useLocalSearchParams<{ game?: string | string[]; src?: string | string[] }>();
  const rawGame = first(params.game);
  const rawSrc = first(params.src);
  const game = rawGame && GAME_ID.test(rawGame) ? rawGame : null;
  const src = rawSrc && SRC.test(rawSrc) ? rawSrc : null;

  useEffect(() => {
    if (game) track('share_open', src ? { game, src } : { game });
  }, [game, src]);

  if (!game) return <Redirect href="/" />;
  return <Redirect href={{ pathname: '/jogo/[id]', params: { id: game, tab: 'prognostico' } }} />;
}
