import { validGameId } from "../../src/callables/validation";

describe("validGameId", () => {
  it("accepts normal ids", () => expect(validGameId("m1")).toBe(true));
  it.each(["", "a/b", "none", 5, null, undefined])("rejects %p", (v) => expect(validGameId(v)).toBe(false));
});
