import { playerUri } from '@/lib/vsports';

const REAL = 'https://sporting.vsports.pt/embd/100020/m/19776/scp/abc';

describe('playerUri', () => {
  it('autostart=false passa a autostart=true (forma real)', () => {
    expect(playerUri(`${REAL}?autostart=false`)).toBe(`${REAL}?autostart=true`);
  });
  it('sem query acrescenta ?autostart=true', () => {
    expect(playerUri(REAL)).toBe(`${REAL}?autostart=true`);
    expect(playerUri(`${REAL}?`)).toBe(`${REAL}?autostart=true`);
  });
  it('mantém os outros parâmetros e a ordem; substitui autostart onde estiver', () => {
    expect(playerUri(`${REAL}?a=1&b=2`)).toBe(`${REAL}?a=1&b=2&autostart=true`);
    expect(playerUri(`${REAL}?a=1&autostart=0&b=2`)).toBe(`${REAL}?a=1&b=2&autostart=true`);
    expect(playerUri(`${REAL}?autostart&a=1`)).toBe(`${REAL}?a=1&autostart=true`);
    expect(playerUri(`${REAL}?autostart=true`)).toBe(`${REAL}?autostart=true`);
  });
  it('não confunde parâmetros parecidos e mantém o fragmento', () => {
    expect(playerUri(`${REAL}?noautostart=1`)).toBe(`${REAL}?noautostart=1&autostart=true`);
    expect(playerUri(`${REAL}?autostart=false#t=10`)).toBe(`${REAL}?autostart=true#t=10`);
  });
});
