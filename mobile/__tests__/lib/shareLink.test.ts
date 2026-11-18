// Task 17: link único partilhado no cartão "S360 MATCHDAY" (Firebase Hosting, universal links / app links).
import { SHARE_HOST, SHARE_SHORT_TEXT, shareLink } from '@/lib/shareLink';

describe('shareLink', () => {
  it('aponta para /j no domínio do Hosting com a origem e o jogo', () => {
    expect(SHARE_HOST).toBe('https://s360-prognostico-download.web.app');
    expect(shareLink('1001')).toBe('https://s360-prognostico-download.web.app/j?src=share&game=1001');
  });

  it('codifica o id do jogo', () => {
    expect(shareLink('a b&c')).toBe('https://s360-prognostico-download.web.app/j?src=share&game=a%20b%26c');
  });

  it('link curto em texto para o cartão', () => {
    expect(SHARE_SHORT_TEXT).toBe('s360-prognostico-download.web.app/j');
  });
});
