// Plano 8, Task 6: link pendente (em memória) para o utilizador sem sessão que abre /e/{id} ou /j.
import { pendingLinkRoute, setPendingLink, takePendingLink } from '@/lib/pendingLink';

beforeEach(() => {
  takePendingLink();
});

describe('pendingLink', () => {
  it('guarda /e/{id} e entrega-o uma só vez', () => {
    setPendingLink('/e/abc123');
    expect(takePendingLink()).toBe('/e/abc123');
    expect(takePendingLink()).toBeNull();
  });

  it('guarda /j com ou sem query', () => {
    setPendingLink('/j?src=share&game=1001');
    expect(takePendingLink()).toBe('/j?src=share&game=1001');
    setPendingLink('/j');
    expect(takePendingLink()).toBe('/j');
  });

  it.each(['/', '/welcome', '/jogo/1001', '/jogos', '/e', '/e/', '/e/a/b', '/e/../x', '//evil.com/e/x', 'https://x.pt/e/abc', '/gamebox/g1', '/jx?a=1', '/e/abc?x=<'])(
    'ignora %s',
    (href) => {
      setPendingLink(href);
      expect(takePendingLink()).toBeNull();
    },
  );

  it('um caminho inválido não apaga o pendente anterior', () => {
    setPendingLink('/e/abc');
    setPendingLink('/welcome');
    expect(takePendingLink()).toBe('/e/abc');
  });

  it('pendingLinkRoute: /e/{id} abre /emprestimo/{id}; /j fica igual', () => {
    expect(pendingLinkRoute('/e/abc')).toBe('/emprestimo/abc');
    expect(pendingLinkRoute('/j?game=1')).toBe('/j?game=1');
  });
});
