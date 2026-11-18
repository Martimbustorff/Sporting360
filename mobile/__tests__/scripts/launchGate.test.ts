import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { launchGateProblems } = require('../../scripts/launchGate') as { launchGateProblems: (root: string) => string[] };

function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'gate-'));
  mkdirSync(join(root, 'src/content'), { recursive: true });
  for (const [p, c] of Object.entries(files)) writeFileSync(join(root, p), c);
  return root;
}

describe('launchGateProblems', () => {
  it('reports the deadlines marker with file and text', () => {
    const root = project({ 'src/content/a.ts': "export const x = '[A DEFINIR PELO MARTIM: prazos]';\n" });
    const problems = launchGateProblems(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('src/content/a.ts');
    expect(problems[0]).toContain('[A DEFINIR PELO MARTIM: prazos]');
  });

  it('reports a file that declares STADIUM_TODOS', () => {
    const root = project({ 'src/content/b.ts': 'export const STADIUM_TODOS = [];\n' });
    const problems = launchGateProblems(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('STADIUM_TODOS');
  });

  it('walks subfolders', () => {
    const root = project({});
    mkdirSync(join(root, 'src/content/sub'));
    writeFileSync(join(root, 'src/content/sub/c.ts'), "// [A DEFINIR PELO MARTIM: x]\n");
    expect(launchGateProblems(root)).toHaveLength(1);
  });

  it('returns [] when nothing is pending', () => {
    expect(launchGateProblems(project({ 'src/content/ok.ts': 'export const X = 1;\n' }))).toEqual([]);
  });

  it('returns [] when src/content does not exist', () => {
    expect(launchGateProblems(mkdtempSync(join(tmpdir(), 'gate-')))).toEqual([]);
  });
});

describe('launchGate CLI', () => {
  const run = (profile: string | undefined) =>
    spawnSync('node', [join(__dirname, '../../scripts/launchGate.js')], {
      encoding: 'utf8',
      env: { ...process.env, EAS_BUILD_PROFILE: profile ?? '' },
    });

  it('exits 0 outside production even with pending items', () => {
    expect(run('development').status).toBe(0);
    expect(run(undefined).status).toBe(0);
  });
});
