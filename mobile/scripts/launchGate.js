// Guarda do build de produção: bloqueia enquanto houver pendentes de lançamento em src/content.
// Usado pelo app.config.ts (falha no `eas build` antes de subir) e pelo hook eas-build-pre-install (servidor da EAS).
// CommonJS e sem dependências, para correr em node simples. Texto em pt-PT, sem travessões.
const fs = require('node:fs');
const path = require('node:path');

const MARK = '[A DEFINIR PELO MARTIM';
const STADIUM = /\b(?:const|let|var)\s+STADIUM_TODOS\b/;

function tsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(p));
    else if (e.isFile() && p.endsWith('.ts')) out.push(p);
  }
  return out.sort();
}

/** Uma linha por ocorrência da marca e uma por ficheiro que declare STADIUM_TODOS. */
function launchGateProblems(root) {
  const problems = [];
  for (const file of tsFiles(path.join(root, 'src', 'content'))) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      let at = line.indexOf(MARK);
      while (at !== -1) {
        const end = line.indexOf(']', at);
        problems.push(`${rel}:${i + 1} ${line.slice(at, end === -1 ? undefined : end + 1)}`);
        at = line.indexOf(MARK, at + 1);
      }
      if (STADIUM.test(line)) problems.push(`${rel}:${i + 1} STADIUM_TODOS por resolver`);
    });
  }
  return problems;
}

module.exports = { launchGateProblems };

if (require.main === module) {
  const problems =
    process.env.EAS_BUILD_PROFILE === 'production' ? launchGateProblems(path.resolve(__dirname, '..')) : [];
  if (problems.length > 0) {
    console.error('Build de produção bloqueado:\n' + problems.map((p) => `  ${p}`).join('\n'));
    process.exit(1);
  }
}
