import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// O script resolve a raiz a partir da sua própria localização (../), por isso
// copiamos para <tmp>/scripts/ e criamos <tmp>/app e <tmp>/src/theme.
function run(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'chk-'));
  mkdirSync(join(root, 'scripts'));
  copyFileSync(join(__dirname, '../../scripts/check-tokens.mjs'), join(root, 'scripts/check-tokens.mjs'));
  mkdirSync(join(root, 'app'));
  mkdirSync(join(root, 'src/theme'), { recursive: true });
  for (const [p, c] of Object.entries(files)) writeFileSync(join(root, p), c);
  return spawnSync('node', [join(root, 'scripts/check-tokens.mjs')], { encoding: 'utf8' });
}

describe('check-tokens', () => {
  it('fails on a planted hex in app/', () => {
    const r = run({ 'app/x.tsx': "export const c = '#FF0000';\n" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('app/x.tsx:1');
  });
  it('fails on a font name in src/', () => {
    expect(run({ 'src/a.ts': "const f = 'Poppins';\n" }).status).toBe(1);
  });
  it('allows the same values inside src/theme/', () => {
    expect(run({ 'src/theme/t.ts': "export const c = '#FF0000';\n" }).status).toBe(0);
  });
});
