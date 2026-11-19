import fs from "fs";
import path from "path";
import { APP_STORE_URL, PLAY_STORE_URL } from "../../src/http/storeUrls";
import { loanRedirectHandler } from "../../src/http/loanRedirect";

// O módulo importa o index? Não: o handler é puro, sem Firestore. Segredos/ambiente não são precisos.
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ID = "AbCdEfGhIjKlMnOpQrSt_-";

function run(opts: { method?: string; path?: string; ua?: string }) {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    set(k: string, v: string) {
      headers[k.toLowerCase()] = v;
      return res;
    },
    status(c: number) {
      res.statusCode = c;
      return res;
    },
    redirect(c: number, url: string) {
      res.statusCode = c;
      headers.location = url;
    },
    send(b?: unknown) {
      res.body = b;
    },
  };
  const req = { method: opts.method ?? "GET", path: opts.path ?? `/e/${ID}`, get: (h: string) => (h.toLowerCase() === "user-agent" ? opts.ua : undefined) };
  loanRedirectHandler(req as never, res as never);
  return { res, headers };
}

describe("loanRedirect", () => {
  it("iPhone e iPad: App Store sem referrer", () => {
    for (const ua of [IPHONE, IPAD]) {
      const { res, headers } = run({ ua });
      expect(res.statusCode).toBe(302);
      expect(headers.location).toBe(APP_STORE_URL);
    }
  });

  it("Android: Play Store com &referrer=loan%3D{id}", () => {
    const { res, headers } = run({ ua: ANDROID });
    expect(res.statusCode).toBe(302);
    expect(headers.location).toBe(`${PLAY_STORE_URL}&referrer=loan%3D${ID}`);
  });

  it("outros dispositivos e sem User-Agent: App Store", () => {
    expect(run({ ua: DESKTOP }).headers.location).toBe(APP_STORE_URL);
    expect(run({ ua: undefined }).headers.location).toBe(APP_STORE_URL);
  });

  it.each(["/e/curto", `/e/${ID}x`, "/e/", "/e", "/e/../x", "/e/a b", `/e/${ID}/extra`])("id inválido %j: loja sem referrer", (p) => {
    const android = run({ path: p, ua: ANDROID });
    expect(android.res.statusCode).toBe(302);
    expect(android.headers.location).toBe(PLAY_STORE_URL);
    expect(android.headers.location).not.toContain("referrer");
    expect(run({ path: p, ua: IPHONE }).headers.location).toBe(APP_STORE_URL);
  });

  it("aceita a barra final", () => {
    expect(run({ path: `/e/${ID}/`, ua: ANDROID }).headers.location).toContain(`loan%3D${ID}`);
  });

  it("Cache-Control: no-store em todas as respostas", () => {
    expect(run({ ua: ANDROID }).headers["cache-control"]).toBe("no-store");
    expect(run({ path: "/e/x", ua: IPHONE }).headers["cache-control"]).toBe("no-store");
    expect(run({ method: "POST" }).headers["cache-control"]).toBe("no-store");
  });

  it.each(["POST", "PUT", "DELETE", "PATCH"])("%s: 405 com Allow GET, sem redirecionar", (method) => {
    const { res, headers } = run({ method, ua: ANDROID });
    expect(res.statusCode).toBe(405);
    expect(headers.allow).toBe("GET, HEAD");
    expect(headers.location).toBeUndefined();
  });

  it("não regista o id nem o User-Agent", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    run({ ua: ANDROID });
    run({ ua: IPHONE, path: "/e/curto" });
    expect(spies.flatMap((s) => s.mock.calls)).toEqual([]);
    spies.forEach((s) => s.mockRestore());
  });

  it("o módulo não importa Firestore nem admin", () => {
    const src = fs.readFileSync(path.join(__dirname, "../../src/http/loanRedirect.ts"), "utf8");
    expect(src).not.toMatch(/firestore|firebase-admin/i);
  });
});

describe("URLs das lojas: paridade com a página /j", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const j = require(path.join(__dirname, "../../../hosting/public/j/redirect.js")) as { APP_STORE: string; PLAY: string };
  it("Play Store igual; App Store igual à de /j sem a campanha ct=share", () => {
    expect(PLAY_STORE_URL).toBe(j.PLAY);
    expect(j.APP_STORE.split("?")[0]).toBe(APP_STORE_URL);
  });
  it("index.html de /j usa as mesmas lojas", () => {
    const html = fs.readFileSync(path.join(__dirname, "../../../hosting/public/j/index.html"), "utf8");
    expect(html).toContain(APP_STORE_URL);
    expect(html).toContain(PLAY_STORE_URL);
  });
});
