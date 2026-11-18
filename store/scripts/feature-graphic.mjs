// Gráfico de destaque da Google Play (1024x500), sem emblema nem logótipo do Clube: a app é não oficial.
// Cores lidas de mobile/src/theme/tokens.ts e fontes de mobile/assets/fonts (as mesmas da app).
// Uso: NODE_PATH=<pasta com sharp>/node_modules node store/scripts/feature-graphic.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const fontsDir = path.join(repo, 'mobile/assets/fonts');
const out = path.join(repo, 'store/feature-graphic-1024x500.png');

// O librsvg só vê as fontes do sistema: aponta o fontconfig para as fontes da app antes de carregar o sharp.
const conf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 's360-fonts-')), 'fonts.conf');
fs.writeFileSync(conf, `<?xml version="1.0"?><fontconfig><dir>${fontsDir}</dir><cachedir>${path.dirname(conf)}</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE = conf;

const tokens = fs.readFileSync(path.join(repo, 'mobile/src/theme/tokens.ts'), 'utf8');
const colour = (name) => {
  const m = new RegExp(`^\\s*${name}:\\s*'([^']+)'`, 'm').exec(tokens);
  if (!m) throw new Error(`token de cor em falta: ${name}`);
  return m[1];
};
const bg = colour('bg');
const primary = colour('primary');
const white = colour('white');
const muted = colour('textMuted');
const surface = colour('surface10');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="${bg}"/>
  <g fill="none" stroke="${primary}" stroke-opacity="0.35" stroke-width="2">
    <circle cx="850" cy="250" r="110"/>
    <circle cx="850" cy="250" r="190"/>
    <circle cx="850" cy="250" r="270"/>
  </g>
  <rect x="64" y="318" width="96" height="6" rx="3" fill="${primary}"/>
  <text x="58" y="296" font-family="Barlow Condensed" font-weight="700" font-size="230" letter-spacing="2"><tspan fill="${primary}">S</tspan><tspan fill="${white}">360</tspan></text>
  <text x="64" y="378" font-family="Poppins" font-weight="500" font-size="36" fill="${white}">Agenda, prognósticos e MVP</text>
  <rect x="64" y="418" width="330" height="40" rx="20" fill="${surface}"/>
  <text x="84" y="445" font-family="Poppins" font-size="19" fill="${muted}">App de adeptos não oficial</text>
</svg>`;

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp não encontrado. Instala-o ou define NODE_PATH para a pasta node_modules que o tem.');
  process.exit(1);
}
await sharp(Buffer.from(svg)).png().toFile(out);
const meta = await sharp(out).metadata();
if (meta.width !== 1024 || meta.height !== 500) throw new Error(`tamanho errado: ${meta.width}x${meta.height}`);
console.log(`${path.relative(repo, out)} ${meta.width}x${meta.height}`);
