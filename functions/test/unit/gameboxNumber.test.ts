import { readGameboxNumber } from "../../src/loans/gameboxNumber";

// Textos gerados com o crypto-js da app (encryptGameboxNumber), uid "alice".
const A1 = "U2FsdGVkX1/vd1DTYimXqOeGA+i/5z4NUrPxrQBzVOs="; // 123456
const A2 = "U2FsdGVkX19liQxttLz4O060jf8EJnATmLGdShr22Xg="; // 123456, outro sal
const B = "U2FsdGVkX1+QuCRwjCR1Tnxd8/1kNV0FtKlekKh2Sx8="; // 99887766

describe("readGameboxNumber", () => {
  it("decifra o formato da V2, com qualquer sal", () => {
    expect(readGameboxNumber(A1, "alice")).toBe("123456");
    expect(readGameboxNumber(A2, "alice")).toBe("123456");
    expect(readGameboxNumber(B, "alice")).toBe("99887766");
  });
  it("em claro (V2 antiga) devolve o número; uid errado, lixo e vazio devolvem ''", () => {
    expect(readGameboxNumber("2665 7127 6572", "alice")).toBe("266571276572");
    expect(readGameboxNumber(A1, "bob")).toBe("");
    expect(readGameboxNumber("cifrado", "alice")).toBe("");
    expect(readGameboxNumber("", "alice")).toBe("");
    expect(readGameboxNumber(undefined, "alice")).toBe("");
    expect(readGameboxNumber({}, "alice")).toBe("");
  });
});
