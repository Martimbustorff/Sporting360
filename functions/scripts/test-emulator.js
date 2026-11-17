// Runs the emulator test suite against a demo project. Extra args are passed to jest
// (e.g. `npm run test:emulator -- rules.phase1`).
const { spawnSync } = require("node:child_process");
const extra = process.argv.slice(2).map((a) => JSON.stringify(a)).join(" ");
const jest = `jest -c jest.emulator.config.js --runInBand ${extra}`.trim();
const res = spawnSync(
  "npx",
  ["firebase", "emulators:exec", "--project", "demo-scp360", "--only", "firestore,auth,functions", jest],
  { stdio: "inherit" },
);
process.exit(res.status ?? 1);
