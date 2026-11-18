// Converte uma captura de ecrã (PNG) nos tamanhos das lojas, sem deformar: a imagem mantém a proporção e as
// margens que sobrarem levam a cor de fundo da app (token `bg`). Com --fit cover corta em vez de deixar margens.
// Uso: NODE_PATH=<pasta com sharp>/node_modules node store/scripts/resize.mjs <captura.png> [pasta-de-saída] [--fit contain|cover]
// Saídas: <nome>-ios-6.9-1320x2868.png, <nome>-ios-6.5-1284x2778.png, <nome>-play-1080x1920.png.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const TARGETS = [
  { id: 'ios-6.9', width: 1320, height: 2868 },
  { id: 'ios-6.5', width: 1284, height: 2778 },
  { id: 'play', width: 1080, height: 1920 },
];

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

function backgroundFromTokens() {
  const tokens = fs.readFileSync(path.join(repo, 'mobile/src/theme/tokens.ts'), 'utf8');
  const m = /^\s*bg:\s*'(#[0-9A-Fa-f]{6})'/m.exec(tokens);
  if (!m) throw new Error('token de cor em falta: bg');
  return m[1];
}

export async function resizeAll(sharp, input, outDir, fit = 'contain') {
  const base = path.basename(input, path.extname(input));
  const background = backgroundFromTokens();
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const t of TARGETS) {
    const file = path.join(outDir, `${base}-${t.id}-${t.width}x${t.height}.png`);
    await sharp(input)
      .resize({ width: t.width, height: t.height, fit, position: 'top', background })
      .flatten({ background }) // as lojas não aceitam transparência
      .png()
      .toFile(file);
    const meta = await sharp(file).metadata();
    if (meta.width !== t.width || meta.height !== t.height) throw new Error(`tamanho errado em ${file}`);
    written.push(file);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const fitAt = args.indexOf('--fit');
  const fit = fitAt >= 0 ? args.splice(fitAt, 2)[1] : 'contain';
  const [input, outDir = path.join(repo, 'store/capturas-out')] = args;
  if (!input || !['contain', 'cover'].includes(fit)) {
    console.error('Uso: node store/scripts/resize.mjs <captura.png> [pasta-de-saída] [--fit contain|cover]');
    process.exit(1);
  }
  const require = createRequire(import.meta.url);
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp não encontrado. Instala-o ou define NODE_PATH para a pasta node_modules que o tem.');
    process.exit(1);
  }
  for (const f of await resizeAll(sharp, input, outDir, fit)) console.log(path.relative(process.cwd(), f));
}
