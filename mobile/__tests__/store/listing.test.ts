// Task 11 (Plano 5): fichas das lojas. Os limites são os da App Store Connect e da Play Console.
import fs from 'fs';
import path from 'path';
import { TERMS } from '@/content/termos';

const repo = path.resolve(__dirname, '../../..');
const storeDir = path.join(repo, 'store');
const read = (f: string) => fs.readFileSync(path.join(storeDir, f), 'utf8');
type AppStoreListing = {
  name: string;
  subtitle: string;
  promotionalText: string;
  description: string;
  keywords: string;
  whatsNew: string;
  supportUrl: string;
  privacyPolicyUrl: string;
};
type PlayListing = {
  title: string;
  shortDescription: string;
  fullDescription: string;
  releaseNotes: string;
  privacyPolicyUrl: string;
  accountDeletionUrl: string;
};
const listing = JSON.parse(read('listing.pt-PT.json')) as { appStore: AppStoreListing; googlePlay: PlayListing };
const share = JSON.parse(fs.readFileSync(path.join(repo, 'mobile/share.config.json'), 'utf8')) as { host: string };
const { appStore: apple, googlePlay: play } = listing;

const storeTexts = (): { file: string; text: string }[] => {
  const files = ['listing.pt-PT.json', 'privacidade-lojas.md', 'capturas.md'];
  return files.map((file) => ({ file, text: read(file) }));
};

describe('limites da App Store', () => {
  it('name e subtitle até 30 caracteres, com os valores combinados', () => {
    expect(apple.name).toBe('S360');
    expect(apple.subtitle).toBe('Agenda, prognósticos e MVP');
    expect(apple.name.length).toBeLessThanOrEqual(30);
    expect(apple.subtitle.length).toBeLessThanOrEqual(30);
  });

  it('promotionalText até 170 e description até 4000', () => {
    expect(apple.promotionalText.length).toBeLessThanOrEqual(170);
    expect(apple.description.length).toBeLessThanOrEqual(4000);
    expect(apple.whatsNew.length).toBeLessThanOrEqual(4000);
  });

  it('keywords até 100 bytes e sem espaço depois das vírgulas', () => {
    expect(Buffer.byteLength(apple.keywords, 'utf8')).toBeLessThanOrEqual(100);
    expect(apple.keywords).not.toMatch(/,\s|\s,/);
    expect(apple.keywords).not.toMatch(/\s/);
  });
});

describe('limites da Google Play', () => {
  it('title até 30, shortDescription até 80, fullDescription até 4000, releaseNotes até 500', () => {
    expect(play.title.length).toBeLessThanOrEqual(30);
    expect(play.shortDescription.length).toBeLessThanOrEqual(80);
    expect(play.fullDescription.length).toBeLessThanOrEqual(4000);
    expect(play.releaseNotes.length).toBeLessThanOrEqual(500);
  });
});

describe('conteúdo', () => {
  it('a descrição diz no primeiro parágrafo que é não oficial e sem ligação ao Sporting', () => {
    for (const d of [apple.description, play.fullDescription]) {
      const first = d.split('\n\n')[0] ?? '';
      expect(first).toContain('não oficial');
      expect(first).toContain('Sporting Clube de Portugal');
    }
  });

  it('as descrições não prometem notificações push', () => {
    const all = JSON.stringify(listing).toLowerCase();
    expect(all).not.toMatch(/push|notifica/);
  });

  it('a Comunidade Leonina (escondida no lançamento) não aparece em nenhum texto das lojas', () => {
    for (const { file, text } of storeTexts()) {
      expect({ file, hit: /comunidade/i.test(text) }).toEqual({ file, hit: false });
    }
  });

  it('nenhum texto tem travessão (U+2014) nem meia-risca (U+2013)', () => {
    for (const { file, text } of storeTexts()) {
      expect({ file, hit: /[—–]/.test(text) }).toEqual({ file, hit: false });
    }
  });

  it('os URLs usam o host do share.config.json', () => {
    const base = `https://${share.host}`;
    expect(apple.privacyPolicyUrl).toBe(`${base}/privacidade`);
    expect(play.privacyPolicyUrl).toBe(`${base}/privacidade`);
    expect(play.accountDeletionUrl).toBe(`${base}/apagar-conta`);
    expect(apple.supportUrl.startsWith(`${base}/`)).toBe(true);
  });

  it('whatsNew e releaseNotes descrevem a 7.0.0 como app nova', () => {
    for (const t of [apple.whatsNew, play.releaseNotes]) {
      expect(t).toContain('7.0.0');
      expect(t).toMatch(/ranking/i);
      expect(t).toMatch(/do zero/);
    }
  });
});

describe('privacidade-lojas.md', () => {
  const md = read('privacidade-lojas.md');

  it('diagnóstico não ligado ao utilizador e análise só com consentimento', () => {
    expect(md).toMatch(/Diagnóstico[\s\S]*não ligad/);
    expect(md).toMatch(/só com consentimento/);
    expect(md).toContain('interesse legítimo');
  });

  it('declara sem rastreio, sem publicidade e sem venda de dados', () => {
    expect(md).toMatch(/Rastreio: não/);
    expect(md).toMatch(/Publicidade: não/);
    expect(md).toMatch(/Venda de dados: não/);
  });

  it('os prazos de conservação são os dos Termos', () => {
    const retention = TERMS.find((s) => s.title === '8. CONSERVAÇÃO')?.body ?? '';
    for (const p of ['90 dias', '2 meses', '30 dias']) {
      expect(retention).toContain(p);
      expect(md).toContain(p);
    }
    expect(md).toContain('enquanto a conta existir');
  });

  it('aponta a eliminação na app e na página web', () => {
    expect(md).toContain(play.accountDeletionUrl);
    expect(md).toContain('Definições');
  });
});

describe('capturas.md', () => {
  const md = read('capturas.md');

  it('lista os tamanhos obrigatórios', () => {
    for (const s of ['1320x2868', '1284x2778', '1080x1920', '1024x500']) expect(md).toContain(s);
  });

  it('lista os ecrãs previstos', () => {
    for (const s of ['Home', 'Agenda', 'Detalhe ao vivo', 'Prognóstico', 'MVP', 'Ranking', 'Notícias', 'Perfil']) {
      expect(md).toContain(s);
    }
  });

  it('não usa o emblema do Sporting nem logótipos do Clube no gráfico de destaque', () => {
    expect(md).toMatch(/sem emblema/i);
  });
});

describe('gráfico de destaque da Play', () => {
  it('é um PNG de 1024x500', () => {
    const buf = fs.readFileSync(path.join(storeDir, 'feature-graphic-1024x500.png'));
    expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(buf.readUInt32BE(16)).toBe(1024);
    expect(buf.readUInt32BE(20)).toBe(500);
  });
});
