import { onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { APP_STORE_URL, PLAY_STORE_URL } from "./storeUrls";

// Link de empréstimo de GameBox: https://<host>/e/{id}. Sem a app, o Hosting entrega o pedido a esta função, que manda
// direto para a loja (decisão do Martim: não há página web). Com a app instalada o sistema abre a app e isto nem corre.
// Sem leituras à base de dados e sem logs: nem o id nem o User-Agent são registados. O id só vai no referrer da Play Store
// (o Android lê-o uma vez no primeiro arranque; no iPhone a pessoa volta a tocar no link depois de instalar).
const LOAN_ID = /^[A-Za-z0-9_-]{22}$/;
const PATH = /^\/e\/([^/]+)\/?$/;

export function loanRedirectHandler(req: Pick<Request, "method" | "path" | "get">, res: Pick<Response, "set" | "status" | "redirect" | "send">): void {
  res.set("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.set("Allow", "GET, HEAD");
    res.status(405).send("");
    return;
  }
  const id = PATH.exec(req.path ?? "")?.[1];
  const valid = id !== undefined && LOAN_ID.test(id);
  const ua = req.get("user-agent") ?? "";
  if (/Android/i.test(ua)) {
    res.redirect(302, valid ? `${PLAY_STORE_URL}&referrer=loan%3D${id}` : PLAY_STORE_URL);
    return;
  }
  // iPhone, iPad e qualquer outro dispositivo (o iPad com Safari "de computador" também cai aqui).
  res.redirect(302, APP_STORE_URL);
}

export const loanRedirect = onRequest({ region: "europe-west1", maxInstances: 20 }, (req, res) => loanRedirectHandler(req, res));
