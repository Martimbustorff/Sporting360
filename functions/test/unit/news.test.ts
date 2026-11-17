import { detectSport, isSportingCPArticle, slugifyUrl, summarize } from "../../src/news/newsSync";
import type { FeedItem } from "../../src/sources/rss";

const item = (o: Partial<FeedItem>): FeedItem => ({ title: "", link: "https://x.pt/a", pubDate: "2026-11-22T10:00:00Z", summary: "", image: "", source: "Record", ...o });

describe("detectSport", () => {
  it("pelo URL primeiro", () => {
    expect(detectSport(item({ link: "https://www.record.pt/modalidades/futsal/sporting-x", title: "Sporting vence no andebol" }))).toBe("futsal");
    expect(detectSport(item({ link: "https://www.record.pt/modalidades/andebol/x" }))).toBe("handball");
    expect(detectSport(item({ link: "https://www.record.pt/modalidades/hoquei-em-patins/x" }))).toBe("roller_hockey");
    expect(detectSport(item({ link: "https://www.record.pt/modalidades/voleibol/x" }))).toBe("volleyball");
    expect(detectSport(item({ link: "https://www.record.pt/modalidades/basquetebol/x" }))).toBe("basketball");
  });
  it("pelas palavras no título e resumo", () => {
    expect(detectSport(item({ title: "Sporting vence no andebol" }))).toBe("handball");
    expect(detectSport(item({ title: "Hóquei: Sporting goleia" }))).toBe("roller_hockey");
    expect(detectSport(item({ title: "Hoquei em patins" }))).toBe("roller_hockey");
    expect(detectSport(item({ summary: "A equipa de voleibol ganhou" }))).toBe("volleyball");
    expect(detectSport(item({ summary: "Vitória no basquete" }))).toBe("basketball");
    expect(detectSport(item({ title: "Sporting no futsal" }))).toBe("futsal");
  });
  it("futebol por omissão", () => {
    expect(detectSport(item({ title: "Sporting vence o dérbi", link: "https://www.record.pt/futebol/sporting/x" }))).toBe("football");
  });
});

describe("isSportingCPArticle", () => {
  it("rejeita falsos positivos", () => {
    expect(isSportingCPArticle(item({ title: "Sporting de Braga vence", link: "https://x.pt/a" }))).toBe(false);
    expect(isSportingCPArticle(item({ title: "Sporting Braga vence", link: "https://x.pt/a" }))).toBe(false);
    expect(isSportingCPArticle(item({ title: "Sporting Kansas City", link: "https://x.pt/a" }))).toBe(false);
  });
  it("aceita /sporting/ no URL e a palavra no texto", () => {
    expect(isSportingCPArticle(item({ title: "Mercado", link: "https://maisfutebol.iol.pt/sporting/mercado/x" }))).toBe(true);
    expect(isSportingCPArticle(item({ title: "Sporting vence", link: "https://x.pt/a" }))).toBe(true);
    expect(isSportingCPArticle(item({ title: "Benfica vence", link: "https://x.pt/a" }))).toBe(false);
  });
});

describe("slugifyUrl", () => {
  it("tal como o legado", () => {
    expect(slugifyUrl("https://www.record.pt/futebol/sporting/exemplo-1")).toBe("www-record-pt-futebol-sporting-exemplo-1");
    expect(slugifyUrl("http://a.pt/x?y=1&z=2/")).toBe("a-pt-x-y-1-z-2");
    expect(slugifyUrl("https://a.pt/" + "b".repeat(400))).toHaveLength(300);
  });
});

describe("summarize", () => {
  it("texto curto fica igual", () => {
    expect(summarize("olá mundo")).toBe("olá mundo");
  });
  it("600 caracteres → ≤ 401 e acaba em …, cortando numa palavra inteira", () => {
    const text = Array.from({ length: 100 }, () => "palavr").join(" ");
    expect(text.length).toBeGreaterThanOrEqual(600);
    const s = summarize(text.slice(0, 600));
    expect(s.length).toBeLessThanOrEqual(401);
    expect(s.endsWith("…")).toBe(true);
    expect(s.slice(0, -1).split(" ").every((w) => w === "palavr")).toBe(true);
  });
  it("sem espaços corta em max", () => {
    expect(summarize("a".repeat(600), 10)).toBe("a".repeat(10) + "…");
  });
});
