import { logger } from "firebase-functions";
import { fromZonedTime } from "date-fns-tz";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { listFootballWindow } from "../football/fixturesSync";
import { vsportsSeasonId, type VsportsClient, type VsportsRoundsResponse, type VsportsVideosResponse } from "../sources/vsports";
import { legacyCollection, writeDocs, type DocWrite } from "../store/writer";

export const VSPORTS_ROUNDS = ["1", "7", "9"] as const;
export const VSPORTS_SPORTING_ID = "6";

const HOUR = 3_600_000;
const BACK_MS = 48 * HOUR;
const FAST_MS = 6 * HOUR;
const CHAMPIONS_ID = "2";
/** Filtro do legado (services/videos.ts): id API-Football do jogo, não o id do vídeo. */
const LEGACY_MIN_MATCH_ID = 1210619;

export type VideoType = "golo" | "resumo" | "flash_interview" | "outro";

/** URL https do player: o próprio valor, ou o `src` do primeiro iframe; `null` se não houver ou não for https. */
export function embedSrc(embed: string): string | null {
  const raw = (embed ?? "").trim();
  let url: string | null;
  if (!raw.includes("<")) url = raw;
  else url = /<iframe\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(raw)?.slice(1).find((g) => g !== undefined) ?? null;
  if (!url) return null;
  url = url.replace(/&amp;/g, "&").trim();
  if (url.startsWith("//")) url = `https:${url}`;
  return /^https:\/\/\S+$/i.test(url) ? url : null;
}

export function videoType(t: string): VideoType {
  switch (t) {
    case "goal":
      return "golo";
    case "resume":
      return "resumo";
    case "flash":
      return "flash_interview";
    default:
      return "outro";
  }
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", day: "numeric", month: "numeric", year: "numeric" });

/** Dia em Europe/Lisbon como `D/M/YYYY` sem zeros à esquerda (o `dt` da VSports). */
export function lisbonDayKey(d: Date): string {
  const p = Object.fromEntries(dayFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.day)}/${Number(p.month)}/${p.year}`;
}

/** `dt` da VSports normalizado para `D/M/YYYY` (aceita também `YYYY-MM-DD`). */
function normalizeDt(dt: string): string {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dt ?? "");
  return iso ? `${Number(iso[3])}/${Number(iso[2])}/${iso[1]}` : (dt ?? "").trim();
}

/** `dt` de um vídeo ("2026-11-22 22:30:00", hora de Lisboa); `null` se não for válido. */
function publishedAt(dt: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(dt ?? "")) return null;
  const d = fromZonedTime(dt.replace(" ", "T"), "Europe/Lisbon");
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface VideosDeps {
  db: Firestore;
  vs: VsportsClient;
  now: () => Date;
  prefix?: string;
  /** Override do id de época da VSports (param VSPORTS_SEASON_ID). */
  seasonId?: number;
  /** Só para o preenchimento manual (scripts/backfill-videos.ts): janela para trás em vez das 48 h, sem cadência. */
  backMs?: number;
}

type Out = { count: number; failed: number };

/**
 * Vídeos da VSports (golos, resumo, flash interviews) dos jogos das últimas 48 h, fora da Champions.
 * Cadência: de 5 em 5 min até 6 h depois do início, depois de hora a hora. Um round que falha não
 * descarta os outros; um jogo que falha não bloqueia os outros. `count` = vídeos processados.
 */
export async function syncVideos(d: VideosDeps): Promise<Out> {
  const now = d.now();
  const back = d.backMs ?? BACK_MS;
  const window = await listFootballWindow(d.db, new Date(now.getTime() - back), now);
  const games = window.filter(
    (m) => m.competition.id !== CHAMPIONS_ID && (d.backMs !== undefined || now.getTime() - m.kickoff.getTime() <= (now.getUTCMinutes() === 0 ? BACK_MS : FAST_MS)),
  );
  if (games.length === 0) return { count: 0, failed: 0 };

  const seasonId = vsportsSeasonId(now, d.seasonId);
  const rounds: VsportsRoundsResponse["matches"] = [];
  let failed = 0;
  let roundsOk = 0;
  for (const cp of VSPORTS_ROUNDS) {
    try {
      rounds.push(...((await d.vs.rounds(cp, seasonId)).matches ?? []));
      roundsOk++;
    } catch (e) {
      failed++;
      logger.warn(`syncVideos: round ${cp} falhou: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (roundsOk === 0) throw new Error("syncVideos: todos os rounds falharam");

  const cache = new Map<string, VsportsVideosResponse | null>();
  const fetchVideos = async (id: string): Promise<VsportsVideosResponse | null> => {
    if (!cache.has(id)) {
      try {
        cache.set(id, await d.vs.videosByMatch(id));
      } catch (e) {
        failed++;
        cache.set(id, null);
        logger.warn(`syncVideos: vídeos do jogo VSports ${id} falharam: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return cache.get(id) ?? null;
  };

  let count = 0;
  for (const game of games) {
    const day = lisbonDayKey(game.kickoff);
    const found = rounds.filter((x) => normalizeDt(x.dt) === day && (x.hteam?.id === VSPORTS_SPORTING_ID || x.ateam?.id === VSPORTS_SPORTING_ID));
    const legacy = Number.parseInt(game.id, 10) >= LEGACY_MIN_MATCH_ID;
    const writes: DocWrite[] = [];
    for (const vm of new Map(found.map((x) => [x.id, x])).values()) {
      const res = await fetchVideos(vm.id);
      if (!res) continue;
      const teams = res.match?.hteam?.name && res.match?.ateam?.name ? { home: res.match.hteam.name, away: res.match.ateam.name } : null;
      for (const v of res.vdos ?? []) {
        const src = embedSrc(v.links?.embed ?? "");
        const type = videoType(v.type);
        if (src) {
          const data: DocumentData = {
            id: String(v.id),
            title: v.title,
            minute: v.minute ? String(v.minute) : null,
            type,
            thumbnail: v.bigpic,
            embedSrc: src,
            videoUrl: v.links.embed,
            publishedAt: publishedAt(v.dt),
          };
          if (teams) data.teams = teams;
          writes.push({ path: `matches/${game.id}/videos/${v.id}`, data });
          count++;
        } else logger.warn(`syncVideos: vídeo ${v.id} sem embed https; ignorado`);
        // Contrato antigo (IVideos), tal como o legado: só golo/resumo/flash, `videoUrl` = links.embed original.
        if (legacy && type !== "outro") {
          writes.push({
            path: `${legacyCollection("videos", d.prefix)}/${v.id}`,
            data: { title: v.title, videoUrl: v.links.embed, minute: v.minute, GameId: game.id, bigpicture: v.bigpic, id: String(v.id) },
            legacy: true,
          });
        }
      }
    }
    if (writes.length > 0) await writeDocs(d.db, writes, { stateKey: `videos_${game.id}` });
  }
  if (failed > 0) logger.warn(`syncVideos: ${failed} chamadas VSports falharam`);
  return { count, failed };
}
