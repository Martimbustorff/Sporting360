export type FetchFn = typeof fetch;

export type SourceErrorKind = "http" | "api" | "parse" | "timeout";

export class SourceError extends Error {
  source: string;
  kind: SourceErrorKind;
  status?: number;
  constructor(source: string, kind: SourceErrorKind, message: string, status?: number) {
    super(`[${source}] ${message}`);
    this.name = "SourceError";
    this.source = source;
    this.kind = kind;
    this.status = status;
  }
}

export interface RequestOptions {
  source: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** Contador partilhado pelos clientes com quota (chamadas feitas e pedidos restantes). */
export class Quota {
  calls = 0;
  remaining: number | null = null;
  note(headers: Headers): void {
    this.calls += 1;
    const v = headers.get("x-ratelimit-requests-remaining");
    if (v !== null && v.trim() !== "" && Number.isFinite(Number(v))) this.remaining = Number(v);
  }
}

async function request(f: FetchFn, url: string, o: RequestOptions, decode: (bytes: Uint8Array, headers: Headers) => string = utf8): Promise<{ text: string; headers: Headers }> {
  const timeoutMs = o.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // O temporizador próprio garante o timeout mesmo com um fetch que ignore o sinal.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SourceError(o.source, "timeout", `sem resposta em ${timeoutMs} ms`)), timeoutMs);
  });
  const work = (async () => {
    let res: Response;
    try {
      res = await f(url, { headers: o.headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new SourceError(o.source, "timeout", `sem resposta em ${timeoutMs} ms`);
      }
      throw new SourceError(o.source, "http", `falha de rede: ${(e as Error).message}`);
    }
    if (!res.ok) throw new SourceError(o.source, "http", `HTTP ${res.status}`, res.status);
    try {
      return { text: decode(new Uint8Array(await res.arrayBuffer()), res.headers), headers: res.headers };
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new SourceError(o.source, "timeout", `sem resposta em ${timeoutMs} ms`);
      }
      throw new SourceError(o.source, "http", `corpo ilegível: ${(e as Error).message}`);
    }
  })();
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    work.catch(() => undefined);
  }
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Charset do texto: o do `Content-Type`, senão o da declaração XML, senão UTF-8. O RSS do Record vem
 * em ISO-8859-1 (visto em produção a 20/11): lido como UTF-8, os acentos saíam como "�".
 */
export function decodeText(bytes: Uint8Array, headers: Headers): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(headers.get("content-type") ?? "")?.[1];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const fromXml = /^\s*<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1];
  for (const label of [fromHeader, fromXml]) {
    if (!label) continue;
    try {
      return new TextDecoder(label.toLowerCase()).decode(bytes);
    } catch {
      // charset desconhecido: tenta o seguinte
    }
  }
  return utf8(bytes);
}

export async function getText(f: FetchFn, url: string, o: RequestOptions): Promise<{ body: string; headers: Headers }> {
  const { text, headers } = await request(f, url, o, decodeText);
  return { body: text, headers };
}

export async function getJson<T>(f: FetchFn, url: string, o: RequestOptions): Promise<{ body: T; headers: Headers }> {
  const { text, headers } = await request(f, url, o);
  try {
    return { body: JSON.parse(text) as T, headers };
  } catch {
    throw new SourceError(o.source, "parse", "resposta não é JSON válido");
  }
}

/** Envelope comum a API-Football e API-Sports: `errors` vazio (array ou objeto) significa sucesso. */
export interface ApiEnvelope<T> {
  errors?: unknown[] | Record<string, unknown>;
  paging?: { current: number; total: number };
  response: T;
}

export function assertNoApiErrors(source: string, body: ApiEnvelope<unknown>): void {
  const e = body.errors;
  const has = Array.isArray(e) ? e.length > 0 : e !== null && typeof e === "object" && Object.keys(e).length > 0;
  if (has) throw new SourceError(source, "api", `erro da API: ${JSON.stringify(e).slice(0, 300)}`);
}
