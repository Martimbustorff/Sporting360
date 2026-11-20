import type { Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { MatchDoc, Sport } from "../model/types";
import type { FetchFn } from "../sources/http";
import { opponentSlug, slugId, type CrestRef, type NormalizedMatch } from "../sources/free/common";
import { hoqueipatinsCrest } from "../sources/free/hoqueipatins";

/**
 * Emblemas dos adversários das fontes gratuitas (20/11, Martim: "ir guardando, fazer cache para reutilizar sem
 * chamadas"). `teamCrests/{sport}_{slug}` guarda o URL de cada equipa: cada emblema pede-se à fonte uma vez e serve
 * todos os jogos e execuções seguintes. Sem emblema na fonte fica `url: null` e só se volta a perguntar passados
 * `CREST_RETRY_MS`. Coleção só do servidor (as regras não a abrem); a app recebe o URL no `logo` do jogo.
 */
export const CREST_RETRY_MS = 30 * 24 * 3600_000;
/** Teto de equipas novas por execução (2 pedidos cada no hoqueipatins): a primeira vez chega em 2 ou 3 execuções. */
export const MAX_CREST_LOOKUPS = 12;

export const crestKey = (sport: Sport, name: string) => `${sport}_${slugId(opponentSlug(name)) || slugId(name)}`;

type Resolver = (f: FetchFn, ref: CrestRef) => Promise<string | null>;
const RESOLVERS: Record<CrestRef["provider"], Resolver> = {
  hoqueipatins: (f, ref) => hoqueipatinsCrest(f, ref.teamId),
};

/** Onde cada equipa tem emblema, pelas listas normalizadas das fontes (as que falharam ficam de fora). */
export function crestRefsOf(sport: Sport, lists: Array<NormalizedMatch[] | Error>): Map<string, CrestRef> {
  const out = new Map<string, CrestRef>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      for (const side of ["home", "away"] as const) {
        const ref = m.crestRefs?.[side];
        if (ref && m[side].id !== "sporting") out.set(crestKey(sport, m[side].name), ref);
      }
    }
  }
  return out;
}

/**
 * Põe o emblema guardado nas equipas sem `logo` (o Sporting já leva o de 2026). Equipas sem entrada e com fonte que
 * sabe o emblema: pede-o (até `MAX_CREST_LOOKUPS`) e guarda o resultado, mesmo null. Nunca lança: um emblema que
 * falha não pode travar a gravação dos jogos.
 */
export async function applyCrests(
  d: { db: Firestore; fetch: FetchFn; now: Date },
  sport: Sport,
  matches: MatchDoc[],
  refs: Map<string, CrestRef>,
): Promise<{ applied: number; looked: number }> {
  const teams = matches.flatMap((m) => [m.home, m.away]).filter((t) => t.id !== "sporting" && !t.logo);
  const keys = [...new Set(teams.map((t) => crestKey(sport, t.name)))];
  if (keys.length === 0) return { applied: 0, looked: 0 };
  const found = new Map<string, string>();
  let looked = 0;
  try {
    const snaps = await d.db.getAll(...keys.map((k) => d.db.doc(`teamCrests/${k}`)));
    for (const [i, snap] of snaps.entries()) {
      const key = keys[i];
      const data = snap.data() as { url?: string | null; checkedAt?: { toDate(): Date } } | undefined;
      if (typeof data?.url === "string") {
        found.set(key, data.url);
        continue;
      }
      const ref = refs.get(key);
      const checked = data?.checkedAt?.toDate().getTime() ?? null;
      if (!ref || looked >= MAX_CREST_LOOKUPS || (checked !== null && d.now.getTime() - checked < CREST_RETRY_MS)) continue;
      looked++;
      let url: string | null = null;
      try {
        url = await RESOLVERS[ref.provider](d.fetch, ref);
      } catch (e) {
        logger.warn(`teamCrests: ${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
      const name = teams.find((t) => crestKey(sport, t.name) === key)?.name ?? key;
      await d.db.doc(`teamCrests/${key}`).set({ sport, name, url, provider: ref.provider, providerId: ref.teamId, checkedAt: d.now });
      if (url) found.set(key, url);
    }
  } catch (e) {
    logger.warn(`teamCrests: ${sport}: ${e instanceof Error ? e.message : String(e)}`);
  }
  let applied = 0;
  for (const t of teams) {
    const url = found.get(crestKey(sport, t.name));
    if (url) {
      t.logo = url;
      applied++;
    }
  }
  return { applied, looked };
}
