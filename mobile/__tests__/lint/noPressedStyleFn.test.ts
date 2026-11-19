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

// Só Pressable/Touchable aceitam função em style, por isso qualquer style={(...) =>} ou style={function ...} (a função de estilo perde-se no NativeWind).
const FN_STYLE = /\bstyle=\{\s*(?:\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>|function\b)/s;

describe('no Pressable style function', () => {
  it('no Pressable/Touchable in app/ or src/ gets a style function (style={({ pressed})', () => {
    const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))];
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => FN_STYLE.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});

describe('FN_STYLE detector', () => {
  it.each([
    '<Pressable style={({ pressed }) => ({})}>',
    '<Pressable\n  style={({ hovered, pressed }) => ({})}>',
    '<Touchable onPress={() => go()} style={(state) => ({})}>',
    '<Pressable style={state => x}>',
  ])('flags %s', (src) => expect(FN_STYLE.test(src)).toBe(true));
  it.each(['<Pressable style={{ a: 1 }}>', '<Touchable style={[a, b]}>'])('ignores %s', (src) =>
    expect(FN_STYLE.test(src)).toBe(false));
});
