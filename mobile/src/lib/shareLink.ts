// Task 17: link único do cartão "S360 MATCHDAY". A página /j vive no Firebase Hosting (hosting/public/j); com a app
// instalada o sistema abre-a diretamente (universal links / app links, app.json), senão a página manda para a loja.
// `src=share` e `game` servem para medir as partilhas (share_open na app, campanha/referrer nas lojas).
// O domínio vem de share.config.json (também usado pelo app.config.ts); os ficheiros .well-known não dependem dele.

import share from '../../share.config.json';

export const SHARE_HOST = `https://${share.host}`;

/** Link curto em texto no cartão, para as apps que largam a mensagem (Instagram stories, alguns casos do WhatsApp). */
export const SHARE_SHORT_TEXT = `${share.host}/j`;

export function shareLink(gameId: string): string {
  return `${SHARE_HOST}/j?src=share&game=${encodeURIComponent(gameId)}`;
}

/** Link do empréstimo de GameBox (Plano 8): o mesmo que o servidor devolve em createLoan (LOAN_URL_BASE). */
export const loanLink = (loanId: string): string => `${SHARE_HOST}/e/${loanId}`;
