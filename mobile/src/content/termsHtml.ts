// Task 11 (Plano 5): os Termos e a Política de Privacidade (`TERMS`) como página HTML para o Firebase Hosting
// (https://{host}/privacidade, o URL que as lojas pedem). hosting/public/privacidade/index.html é exatamente
// `termsToHtml(TERMS)`; o teste reescreve o ficheiro com UPDATE_LEGAL=1. Cores só dos tokens, CSS inline.
import { colors } from '@/theme/tokens';
import type { TermsSection } from './termos';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** Folha de estilo partilhada pelas páginas públicas (privacidade e apagar conta). */
export const PAGE_CSS = [
  `body{margin:0;background:${colors.bg};color:${colors.white};font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.6}`,
  'main{max-width:720px;margin:0 auto;padding:32px 20px 64px}',
  `h1,h2{color:${colors.primary};text-transform:uppercase;line-height:1.2}`,
  'h1{font-size:28px;margin:0 0 24px}',
  'h2{font-size:18px;margin:32px 0 8px}',
  'p,li{margin:0 0 12px}',
  `a{color:${colors.primary}}`,
  `.muted{color:${colors.textMuted}}`,
].join('');

export function pageHtml(title: string, bodyHtml: string): string {
  return [
    '<!doctype html>',
    '<html lang="pt-PT">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${PAGE_CSS}</style>`,
    '</head>',
    '<body>',
    '<main>',
    bodyHtml,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export function termsToHtml(sections: TermsSection[]): string {
  const body = [
    '<h1>S360: Termos e Política de Privacidade</h1>',
    ...sections.flatMap((s) => [`<h2>${escapeHtml(s.title)}</h2>`, ...(s.body ? [`<p>${escapeHtml(s.body)}</p>`] : [])]),
  ].join('\n');
  return pageHtml('S360: Termos e Política de Privacidade', body);
}
