// A Live Activity não pode importar os tokens (a função é serializada para a extensão): as cores estão escritas no
// ficheiro. Este teste confirma que são as mesmas de src/theme/tokens.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { colors } from '@/theme/tokens';

const src = readFileSync(join(__dirname, '../../widgets/MatchActivity.tsx'), 'utf8');
const hex = (name: string) => new RegExp(`\\b${name}: '(#[0-9A-F]{6,8})'`).exec(src)?.[1];

it.each([
  ['primary', colors.primary],
  ['primaryOnDark', colors.primaryOnDark],
  ['white', colors.white],
  ['ink', colors.bg],
])('%s igual ao token', (name, token) => {
  expect(hex(name)?.slice(0, 7).toUpperCase()).toBe(token.toUpperCase());
});

it('nome da atividade igual ao do servidor', () => {
  expect(src).toContain("export const MATCH_ACTIVITY = 'MatchActivity';");
});
