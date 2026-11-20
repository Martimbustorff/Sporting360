import * as fs from "fs";
import * as path from "path";
import type { FetchFn } from "../../src/sources/http";

type Spec = { status: number; body?: unknown; headers?: Record<string, string> };
// Ficheiros servidos em bytes (não relidos como UTF-8), para os testes apanharem charsets reais.
type Value = string | object | Spec;
type Route = Value | Value[] | ((url: string, n: number) => Value);

const FIXTURES = path.join(__dirname, "..", "fixtures");

const isSpec = (v: unknown): v is Spec =>
  typeof v === "object" && v !== null && typeof (v as Spec).status === "number";

function toResponse(v: Value): Response {
  if (isSpec(v)) {
    const body = v.body === undefined ? "" : typeof v.body === "string" ? v.body : v.body instanceof Uint8Array ? v.body : JSON.stringify(v.body);
    return new Response(body, { status: v.status, headers: v.headers });
  }
  if (typeof v === "string") {
    return new Response(fs.readFileSync(path.join(FIXTURES, v)), { status: 200 });
  }
  return new Response(JSON.stringify(v), { status: 200 });
}

/**
 * Fetch falso para testes. Cada rota é [regex do URL, resposta].
 * A resposta é: caminho relativo a test/fixtures (string), objeto JSON, { status, body, headers },
 * um array (servido por ordem; a última repete) ou uma função (url, n) => resposta (n conta a partir de 0).
 * Sem rota correspondente lança erro: nunca há rede real.
 */
export function fakeFetch(routes: Array<[RegExp, Route]>): FetchFn & { calls: string[]; inits: RequestInit[] } {
  const counters = routes.map(() => 0);
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fn.calls.push(url);
    fn.inits.push(init ?? {});
    const i = routes.findIndex(([re]) => re.test(url));
    if (i < 0) throw new Error(`fakeFetch: sem rota para ${url}`);
    const n = counters[i]++;
    const route = routes[i][1];
    const value = typeof route === "function" ? route(url, n) : Array.isArray(route) ? route[Math.min(n, route.length - 1)] : route;
    return toResponse(value);
  }) as FetchFn & { calls: string[]; inits: RequestInit[] };
  fn.calls = [];
  fn.inits = [];
  return fn;
}
