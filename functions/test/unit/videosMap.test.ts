import { embedSrc, lisbonDayKey, videoType } from "../../src/videos/videosSync";

describe("embedSrc", () => {
  it("extrai o src do primeiro iframe e decodifica &amp;", () => {
    expect(embedSrc('<div><iframe src="https://x.pt/e/1?a=1&amp;b=2"></iframe><script>…</script></div>')).toBe("https://x.pt/e/1?a=1&b=2");
  });
  it("URL simples fica igual", () => {
    expect(embedSrc("https://x.pt/e/1")).toBe("https://x.pt/e/1");
  });
  it("sem iframe devolve null", () => {
    expect(embedSrc("<div></div>")).toBeNull();
  });
  it("só aceita https: http, javascript: e vazio dão null", () => {
    expect(embedSrc("http://x.pt/e/1")).toBeNull();
    expect(embedSrc('<iframe src="http://x.pt/e/1"></iframe>')).toBeNull();
    expect(embedSrc('<iframe src="javascript:alert(1)"></iframe>')).toBeNull();
    expect(embedSrc("")).toBeNull();
  });
  it("src com aspas simples e src protocol-relative", () => {
    expect(embedSrc("<iframe class='a' src='https://x.pt/e/2'></iframe>")).toBe("https://x.pt/e/2");
    expect(embedSrc('<iframe src="//x.pt/e/3"></iframe>')).toBe("https://x.pt/e/3");
  });
});

describe("videoType", () => {
  it("mapeia os tipos da VSports", () => {
    expect(videoType("goal")).toBe("golo");
    expect(videoType("resume")).toBe("resumo");
    expect(videoType("flash")).toBe("flash_interview");
    expect(videoType("pressconf")).toBe("outro");
  });
});

describe("lisbonDayKey", () => {
  it("D/M/YYYY sem zeros, em Europe/Lisbon", () => {
    expect(lisbonDayKey(new Date("2026-11-08T23:30:00Z"))).toBe("8/11/2026");
    expect(lisbonDayKey(new Date("2026-08-01T23:30:00Z"))).toBe("2/8/2026");
  });
});
