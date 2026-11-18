module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test/unit"],
  // jose is ESM-only: transpile it to CommonJS for jest (Node itself loads it via require(esm)).
  transform: { "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "tsconfig.test.json" }] },
  transformIgnorePatterns: ["/node_modules/(?!jose/)"],
};
