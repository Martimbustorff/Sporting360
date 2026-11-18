/** Id do Sporting CP na API-Football. */
export const SPORTING_TEAM_ID = 228;

/**
 * Emblema de 2026 do Sporting. Substitui o logótipo da API para a equipa 228 em tudo o que a
 * ingestão escreve. O ficheiro vive no repositório em brand/sporting-cp-2026.png; as Tasks 20/21
 * têm de o publicar neste URL (Hosting).
 */
export const SPORTING_CREST_URL = "https://scp360-37a74.web.app/brand/sporting-cp-2026.png";

/**
 * Logótipo a gravar nas outras modalidades (API-Sports): o emblema novo para o Sporting da modalidade
 * (`sportingTeamId`, id próprio de cada API), o da API para os restantes. Id nulo = por confirmar: nunca coincide.
 */
export function crestForSportTeam(sportingTeamId: number | null, teamId: number | string, apiLogo: string | null): string | null {
  return sportingTeamId !== null && Number(teamId) === sportingTeamId ? SPORTING_CREST_URL : apiLogo;
}

/** Logótipo a gravar: o emblema novo para o Sporting, o da API para os restantes. */
export function crestFor(teamId: number | string, apiLogo: string | null): string | null {
  return Number(teamId) === SPORTING_TEAM_ID ? SPORTING_CREST_URL : apiLogo;
}
