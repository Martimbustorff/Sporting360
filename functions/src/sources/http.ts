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

async function request(f: FetchFn, url: string, o: RequestOptions): Promise<{ text: string; headers: Headers }> {
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
      return { text: await res.text(), headers: res.headers };
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

export async function getText(f: FetchFn, url: string, o: RequestOptions): Promise<{ body: string; headers: Headers }> {
  const { text, headers } = await request(f, url, o);
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
