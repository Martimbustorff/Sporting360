// Task 17: link único do cartão "S360 MATCHDAY". A página /j vive no Firebase Hosting (hosting/public/j); com a app
// instalada o sistema abre-a diretamente (universal links / app links, app.json), senão a página manda para a loja.
// `src=share` e `game` servem para medir as partilhas (share_open na app, campanha/referrer nas lojas).
// Domínio por omissão do Hosting; domínio próprio mais tarde (muda aqui, no app.json e nos ficheiros .well-known).

export const SHARE_HOST = 'https://scp360-37a74.web.app';

/** Link curto em texto no cartão, para as apps que largam a mensagem (Instagram stories, alguns casos do WhatsApp). */
export const SHARE_SHORT_TEXT = 'scp360-37a74.web.app/j';

export function shareLink(gameId: string): string {
  return `${SHARE_HOST}/j?src=share&game=${encodeURIComponent(gameId)}`;
}
