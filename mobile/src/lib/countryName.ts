// Nacionalidade da API (nome do país em inglês) em pt-PT. Usa Intl.DisplayNames('pt-PT') quando existe (o Hermes pode
// não o ter) e cai no mapa; país desconhecido devolve null e o ecrã esconde-o, nunca mostra o inglês.
// Inglaterra não tem código de região ISO (GB seria "Reino Unido"), por isso fica só no mapa.

type Country = { code: string | null; pt: string };

const COUNTRIES: Record<string, Country> = {
  portugal: { code: 'PT', pt: 'Portugal' },
  spain: { code: 'ES', pt: 'Espanha' },
  brazil: { code: 'BR', pt: 'Brasil' },
  england: { code: null, pt: 'Inglaterra' },
  france: { code: 'FR', pt: 'França' },
  argentina: { code: 'AR', pt: 'Argentina' },
  italy: { code: 'IT', pt: 'Itália' },
  germany: { code: 'DE', pt: 'Alemanha' },
  netherlands: { code: 'NL', pt: 'Países Baixos' },
  belgium: { code: 'BE', pt: 'Bélgica' },
  uruguay: { code: 'UY', pt: 'Uruguai' },
  colombia: { code: 'CO', pt: 'Colômbia' },
  croatia: { code: 'HR', pt: 'Croácia' },
  denmark: { code: 'DK', pt: 'Dinamarca' },
  sweden: { code: 'SE', pt: 'Suécia' },
  norway: { code: 'NO', pt: 'Noruega' },
  switzerland: { code: 'CH', pt: 'Suíça' },
  poland: { code: 'PL', pt: 'Polónia' },
  greece: { code: 'GR', pt: 'Grécia' },
  morocco: { code: 'MA', pt: 'Marrocos' },
  usa: { code: 'US', pt: 'Estados Unidos' },
  'united states': { code: 'US', pt: 'Estados Unidos' },
};

type DisplayNamesLike = { of(code: string): string | undefined };
let display: DisplayNamesLike | null | undefined;

function displayNames(): DisplayNamesLike | null {
  if (display !== undefined) return display;
  try {
    const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: 'region' }) => DisplayNamesLike }).DisplayNames;
    display = DN ? new DN(['pt-PT'], { type: 'region' }) : null;
  } catch {
    display = null;
  }
  return display;
}

/** Nome do país em pt-PT, ou null se não for conhecido. */
export function countryNamePt(raw: string | null | undefined): string | null {
  const key = (raw ?? '').trim().toLowerCase();
  const c = COUNTRIES[key];
  if (!c) return null;
  if (c.code) {
    try {
      const name = displayNames()?.of(c.code);
      if (name && name !== c.code) return name;
    } catch {
      // cai no mapa
    }
  }
  return c.pt;
}

/** Só para testes: esquece o Intl.DisplayNames guardado. */
export function resetCountryNameCacheForTests(): void {
  display = undefined;
}
