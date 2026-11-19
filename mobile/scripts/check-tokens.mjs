// Falha se houver hex, rgb(a)() ou nomes de fonte em app/** e src/** fora de src/theme/.
// app.json / app.config.* ficam de fora (config nativa não importa TS).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const RULES = [
  [/#[0-9a-fA-F]{3,8}\b/, 'hex colour'],
  [/rgba?\(/, 'rgb(a) colour'],
  [/\b(Din(Condensed\w*)?|Poppins\w*|Barlow\w*|D-DIN\w*)\b/, 'font name'],
];

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const themeDir = join(root, 'src', 'theme') + sep;
const files = ['app', 'src']
  .flatMap((d) => { try { return walk(join(root, d)); } catch { return []; } })
  .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.startsWith(themeDir));

let bad = 0;
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const [re, what] of RULES) {
      if (re.test(line)) { console.error(`${relative(root, f)}:${i + 1}: ${what}: ${line.trim()}`); bad++; }
    }
  });
}
if (bad) { console.error(`check:tokens: ${bad} violation(s)`); process.exit(1); }
console.log(`check:tokens: ok (${files.length} files)`);
