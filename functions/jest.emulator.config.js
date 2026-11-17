module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test/emulator"],
  testTimeout: 30000,
  passWithNoTests: true,
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }] },
};
