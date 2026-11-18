// Paridade com o servidor: a app duplica a lógica de nomes públicos de functions/. Se um lado mudar sem o outro, falha aqui.
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** Corpo completo (assinatura incluída) de `function <name>`, sem comentários nem espaços. */
function body(src: string, name: string): string {
  const start = src.search(new RegExp(`(export\\s+)?function\\s+${name}\\b`));
  if (start < 0) throw new Error(`function ${name} not found`);
  // Fim da lista de parâmetros (os tipos dos parâmetros podem ter chavetas), depois o `{` do corpo.
  let paren = 0;
  let i = src.indexOf('(', start);
  for (; i < src.length; i++) {
    if (src[i] === '(') paren++;
    else if (src[i] === ')' && --paren === 0) break;
  }
  let depth = 0;
  for (i = src.indexOf('{', i); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) {
      return src
        .slice(start, i + 1)
        .replace(/^export\s+/, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\s+/g, '');
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const mobile = readFileSync(join(__dirname, '..', '..', 'src', 'lib', 'publicName.ts'), 'utf8');
const profiles = read('functions/src/data/profiles.ts');
const validation = read('functions/src/callables/validation.ts');

describe('mobile/server parity (publicName, titleCasePt, validateDisplayName, validAvatarId)', () => {
  it.each([
    ['publicName', profiles],
    ['titleCasePt', profiles],
    ['validateDisplayName', validation],
    ['validAvatarId', validation],
  ])('%s is identical on both sides', (name, serverSrc) => {
    const a = body(mobile, name);
    const b = body(serverSrc, name);
    expect(a.length).toBeGreaterThan(40);
    expect(a).toBe(b);
  });
});
