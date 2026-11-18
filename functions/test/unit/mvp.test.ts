import { PlayerLine, mvpCandidates, officialMvpIds } from "../../src/game/mvp";

function line(
  playerId: string,
  name: string,
  overrides: Partial<Omit<PlayerLine, "playerId" | "name">> = {},
): PlayerLine {
  return {
    playerId,
    name,
    teamIsSporting: true,
    minutes: 90,
    rating: 7,
    ...overrides,
  };
}

describe("mvpCandidates", () => {
  it("exclui adversários e jogadores do Sporting com minutes 0 ou null", () => {
    const lines: PlayerLine[] = [
      line("s1", "Pote", { minutes: 45 }),
      line("a1", "Adversário", { teamIsSporting: false, minutes: 90 }),
      line("s2", "Banco", { minutes: 0 }),
      line("s3", "Não entrou", { minutes: null }),
    ];
    expect(mvpCandidates(lines).map((p) => p.playerId)).toEqual(["s1"]);
  });

  it("ordena os candidatos por nome com localeCompare pt", () => {
    const lines: PlayerLine[] = [
      line("p3", "Zeca"),
      line("p1", "Ábel"),
      line("p2", "Bruno"),
    ];
    expect(mvpCandidates(lines).map((p) => p.name)).toEqual(
      ["Ábel", "Bruno", "Zeca"].sort((a, b) => a.localeCompare(b, "pt")),
    );
    expect(mvpCandidates(lines).map((p) => p.playerId)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("officialMvpIds", () => {
  it("devolve o único jogador com o maior rating", () => {
    const lines: PlayerLine[] = [
      line("a", "Alpha", { rating: 7.2 }),
      line("b", "Bravo", { rating: 8.05 }),
      line("c", "Charlie", { rating: 6.9 }),
    ];
    expect(officialMvpIds(lines)).toEqual(["b"]);
  });

  it("empate no máximo devolve todos os empatados", () => {
    const lines: PlayerLine[] = [
      line("a", "Alpha", { rating: 7.5 }),
      line("b", "Bravo", { rating: 6.1 }),
      line("c", "Charlie", { rating: 7.5 }),
    ];
    expect(officialMvpIds(lines)).toEqual(["a", "c"]);
  });

  it("ignora ratings NaN", () => {
    const lines: PlayerLine[] = [
      line("a", "Alpha", { rating: NaN }),
      line("b", "Bravo", { rating: 6.4 }),
    ];
    expect(officialMvpIds(lines)).toEqual(["b"]);
    expect(officialMvpIds([line("a", "Alpha", { rating: NaN })])).toEqual([]);
  });

  it("ignora ratings null e considera só os restantes", () => {
    const lines: PlayerLine[] = [
      line("a", "Alpha", { rating: null }),
      line("b", "Bravo", { rating: 6.4 }),
      line("c", "Charlie", { rating: null }),
      line("d", "Delta", { rating: 6.8 }),
    ];
    expect(officialMvpIds(lines)).toEqual(["d"]);
  });

  it("com todos os ratings null devolve []", () => {
    const lines: PlayerLine[] = [
      line("a", "Alpha", { rating: null }),
      line("b", "Bravo", { rating: null }),
    ];
    expect(officialMvpIds(lines)).toEqual([]);
  });

  it("não considera adversários nem jogadores sem minutos, mesmo com rating máximo", () => {
    const lines: PlayerLine[] = [
      line("a", "Alpha", { rating: 7 }),
      line("adv", "Adversário", { teamIsSporting: false, rating: 9.9 }),
      line("banco", "Banco", { minutes: 0, rating: 9.5 }),
    ];
    expect(officialMvpIds(lines)).toEqual(["a"]);
  });

  it("devolve os ids pela ordem dos candidatos (ordenados por nome)", () => {
    const lines: PlayerLine[] = [
      line("z", "Zeca", { rating: 8 }),
      line("a", "Ábel", { rating: 8 }),
    ];
    expect(officialMvpIds(lines)).toEqual(["a", "z"]);
  });

  it("lista vazia devolve []", () => {
    expect(officialMvpIds([])).toEqual([]);
  });
});
