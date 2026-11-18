// Task 11 (Plano 5): páginas públicas exigidas pelas lojas (política de privacidade e apagar conta).
import fs from 'fs';
import path from 'path';
import { TERMS } from '@/content/termos';
import { PAGE_CSS, termsToHtml } from '@/content/termsHtml';
import { colors } from '@/theme/tokens';

const repo = path.resolve(__dirname, '../../..');
const pub = path.join(repo, 'hosting/public');
const read = (f: string) => fs.readFileSync(path.join(pub, f), 'utf8');

describe('termsToHtml', () => {
  it('um <h2> por título e um <p> por parágrafo, com o texto escapado', () => {
    const html = termsToHtml([
      { title: '1. A & B', body: 'Texto com <tag> e "aspas".' },
      { title: 'SÓ TÍTULO', body: '' },
    ]);
    expect(html).toContain('<h2');
    expect(html).toContain('1. A &amp; B');
    expect(html).toContain('Texto com &lt;tag&gt; e &quot;aspas&quot;.');
    expect(html.match(/<h2/g)).toHaveLength(2);
    expect(html.match(/<p[ >]/g)).toHaveLength(1);
    expect(html).not.toContain('<tag>');
  });

  it('é pt-PT e usa as cores do tema', () => {
    const html = termsToHtml(TERMS);
    expect(html).toContain('lang="pt-PT"');
    expect(html).toContain(colors.bg);
    expect(html).toContain(colors.primary);
  });
});

describe('hosting/public/privacidade', () => {
  it('é exatamente termsToHtml(TERMS) (UPDATE_LEGAL=1 reescreve)', () => {
    const file = path.join(pub, 'privacidade/index.html');
    const expected = termsToHtml(TERMS);
    if (process.env.UPDATE_LEGAL === '1') fs.writeFileSync(file, expected);
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
  });

  it('não tem pendentes por definir', () => {
    expect(read('privacidade/index.html')).not.toContain('[A DEFINIR');
  });
});

describe('hosting/public/apagar-conta', () => {
  const html = read('apagar-conta/index.html');

  it('tem o contacto para pedir a eliminação sem a app', () => {
    expect(html).toContain('app.scp360@gmail.com');
  });

  it('usa os nomes reais do menu da app', () => {
    expect(html).toContain('Definições');
    expect(html).toContain('Apagar conta');
    expect(html).toContain('APAGAR');
  });

  it('lista o que o servidor apaga e os prazos de conservação dos Termos', () => {
    for (const t of ['GameBox', 'prognósticos', 'votos', 'ranking', 'nome público', 'email']) {
      expect(html.toLowerCase()).toContain(t.toLowerCase());
    }
    for (const p of ['90 dias', '30 dias']) expect(html).toContain(p);
  });

  it('é pt-PT, sem travessões nem pendentes', () => {
    expect(html).toContain('lang="pt-PT"');
    expect(html).not.toMatch(/[—–]/);
    expect(html).not.toContain('[A DEFINIR');
  });

  it('usa a folha de estilo (e as cores do tema) das outras páginas públicas', () => {
    expect(html).toContain(PAGE_CSS);
    expect(html).toContain(colors.bg);
    expect(html).toContain(colors.primary);
  });
});

describe('firebase.json serve as duas páginas', () => {
  const fb = JSON.parse(fs.readFileSync(path.join(repo, 'firebase.json'), 'utf8')) as {
    hosting: { rewrites?: { source: string }[]; redirects?: { source: string }[] };
  };

  it.each(['/privacidade', '/apagar-conta'])('nenhum rewrite ou redirect apanha %s', (p) => {
    const rules = [...(fb.hosting.rewrites ?? []), ...(fb.hosting.redirects ?? [])];
    for (const r of rules) {
      const src = r.source;
      // Firebase usa globs: "**" apanha tudo, "/j*" só o prefixo /j.
      const re = new RegExp('^' + src.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
      expect({ p, src, hit: re.test(p) }).toEqual({ p, src, hit: false });
    }
  });

  it.each(['privacidade', 'apagar-conta'])('%s/index.html existe em hosting/public', (d) => {
    expect(fs.existsSync(path.join(pub, d, 'index.html'))).toBe(true);
  });
});
