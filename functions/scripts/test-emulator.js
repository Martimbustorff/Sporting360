// Runs the emulator test suite against a demo project. Extra args are passed to jest
// (e.g. `npm run test:emulator -- rules.phase2`).
const { spawnSync } = require("node:child_process");
const extra = process.argv.slice(2).map((a) => JSON.stringify(a)).join(" ");
const jest = `jest -c jest.emulator.config.js --runInBand ${extra}`.trim();
const win = process.platform === "win32";
// With shell:true (needed on Windows to resolve npx.cmd) args are not auto-quoted, so quote the jest command.
const jestArg = win ? `"${jest.replace(/"/g, '\\"')}"` : jest;
const res = spawnSync(
  "npx",
  ["firebase", "emulators:exec", "--project", "demo-scp360", "--only", "firestore,auth,functions", jestArg],
  { stdio: "inherit", shell: win },
);
process.exit(res.status ?? 1);
