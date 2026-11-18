// URL do leitor VSports. Os `embedSrc` reais trazem `?autostart=false` e o leitor espera por um segundo toque;
// a app força `autostart=true` ao abrir (Martim: "toque toca logo"). O `embedSrc` guardado não muda.

/** `embedSrc` com `autostart=true`: substitui qualquer `autostart`, mantém os outros parâmetros e o `#`. */
export function playerUri(embedSrc: string): string {
  const hashAt = embedSrc.indexOf('#');
  const base = hashAt < 0 ? embedSrc : embedSrc.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : embedSrc.slice(hashAt);
  const q = base.indexOf('?');
  const path = q < 0 ? base : base.slice(0, q);
  const params = (q < 0 ? '' : base.slice(q + 1))
    .split('&')
    .filter((p) => p !== '' && !/^autostart(=|$)/i.test(p));
  params.push('autostart=true');
  return `${path}?${params.join('&')}${hash}`;
}
