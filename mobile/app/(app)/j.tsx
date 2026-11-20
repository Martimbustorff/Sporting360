// SEM FIGMA: entrada do link partilhado (Task 17), sem interface: com a app instalada, o link do cartão
// "S360 MATCHDAY" (https://<host de share.config.json>/j?src=share&game=...) abre aqui pelos universal links / app links
// (app.json). Com `game` válido mede `share_open` e abre o jogo na tab Prognóstico; sem `game` vai para a Home.
// Sem sessão, o guarda de (app)/_layout guarda o link (lib/pendingLink, Plano 8 Task 6) e manda para /welcome; depois de
// entrar, o guarda de (auth) abre-o aqui outra vez.
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
  return <Redirect href={{ pathname: '/jogo/[id]', params: { id: game, tab: 'sumario' } }} />;
}
