import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('no Pressable style function', () => {
  it('no .tsx under app/ or src/ uses style={({ pressed', () => {
    const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))];
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => /style=\{\(\{\s*pressed/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
