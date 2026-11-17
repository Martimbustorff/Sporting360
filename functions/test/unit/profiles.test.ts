import { publicName } from "../../src/data/profiles";

describe("publicName", () => {
  it("usa displayName aparado", () => {
    expect(publicName({ displayName: "  Leão 77 " }, "u1")).toBe("Leão 77");
  });
  it("usa name em Title Case pt-PT", () => {
    expect(publicName({ name: "MARTIM BUSTORFF" }, "u1")).toBe("Martim Bustorff");
    expect(publicName({ name: "ÉVORA  silva" }, "u1")).toBe("Évora Silva");
  });
  it("displayName vazio cai para name", () => {
    expect(publicName({ displayName: "   ", name: "ana pinto" }, "u1")).toBe("Ana Pinto");
  });
  it("name com @ é tratado como inexistente (nunca expõe email)", () => {
    expect(publicName({ name: "joao@mail.com" }, "abcd1234")).toBe("Sportinguista #1234");
  });
  it("sem nada devolve Sportinguista #<últimos 4 do uid>", () => {
    expect(publicName({}, "abcd1234")).toBe("Sportinguista #1234");
    expect(publicName({ displayName: null, name: null }, "abcd1234")).toBe("Sportinguista #1234");
  });
});
