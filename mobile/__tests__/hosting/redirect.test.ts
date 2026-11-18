// Task 17: página do link único no Firebase Hosting (não publicada nesta task) e ficheiros de associação.
import fs from 'fs';
import path from 'path';

const repo = path.resolve(__dirname, '../../..');
const pub = path.join(repo, 'hosting/public');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { storeUrlFor } = require(path.join(pub, 'j/redirect.js')) as {
  storeUrlFor: (ua: string, game: string | null) => string | null;
};

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

describe('storeUrlFor', () => {
  it('iPhone → App Store com a campanha share', () => {
    expect(storeUrlFor(IPHONE, '1001')).toBe('https://apps.apple.com/app/id6450608023?ct=share');
  });

  it('Android → Google Play com o referrer do jogo', () => {
    const url = storeUrlFor(ANDROID, '1001')!;
    expect(url).toBe(
      'https://play.google.com/store/apps/details?id=com.scp360&referrer=' +
        encodeURIComponent('utm_source=share&utm_campaign=game_1001'),
    );
    expect(decodeURIComponent(url.split('referrer=')[1] ?? '')).toContain('game_1001');
  });

  it('Android sem jogo → referrer só com a origem', () => {
    expect(storeUrlFor(ANDROID, null)).toBe(
      'https://play.google.com/store/apps/details?id=com.scp360&referrer=' + encodeURIComponent('utm_source=share'),
    );
  });

  it('desktop → null (a página mostra os dois botões)', () => {
    expect(storeUrlFor(DESKTOP, '1001')).toBeNull();
  });
});

describe('hosting/public', () => {
  const read = (f: string) => fs.readFileSync(path.join(pub, f), 'utf8');

  it('index.html carrega o redirect.js por caminho absoluto e tem o texto para desktop', () => {
    const html = read('j/index.html');
    expect(html).toContain('src="/j/redirect.js"');
    expect(html).toContain('Abre este link no telemóvel.');
    expect(html).toContain('https://apps.apple.com/app/id6450608023?ct=share');
    expect(html).toContain('https://play.google.com/store/apps/details?id=com.scp360');
  });

  it('apple-app-site-association associa /j* à app iOS', () => {
    expect(JSON.parse(read('.well-known/apple-app-site-association'))).toEqual({
      applinks: { details: [{ appIDs: ['5U6HWPNTZ3.com.scp360'], components: [{ '/': '/j*' }] }] },
    });
  });

  it('assetlinks.json associa o domínio à app Android com as chaves de assinatura da Play', () => {
    expect(JSON.parse(read('.well-known/assetlinks.json'))).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.scp360',
          sha256_cert_fingerprints: [
            '40:01:41:D8:98:C9:D6:DE:26:89:35:CC:6A:28:AD:D4:57:F9:0E:AB:BB:43:AE:21:14:81:16:70:81:52:24:9F',
            '6C:FF:45:8A:D3:95:19:FC:EB:36:39:98:C9:08:21:54:53:5E:54:62:69:78:E7:30:7E:84:DB:C6:AF:95:24:DF',
            'C3:7B:10:D1:52:34:37:3C:0D:C0:04:3B:86:EB:56:65:D4:A1:4B:54:B0:60:68:5B:3C:1E:F0:7B:1E:14:C2:2B',
          ],
        },
      },
    ]);
  });
});

// Revisão da Task 17: functions/src/config/brand.ts (SPORTING_CREST_URL) aponta para /brand/sporting-cp-2026.png no
// Hosting; o deploy substitui o site todo, por isso o emblema tem de estar nesta pasta. Fonte: brand/sporting-cp-2026.png
// (a que o runbook do Plano 2 indica, docs/superpowers/notes/2026-12-01-publicacao-plano2.md secção 7).
describe('emblema do Sporting no Hosting', () => {
  it('existe em /brand/sporting-cp-2026.png e é igual ao ficheiro do repositório', () => {
    const served = path.join(pub, 'brand/sporting-cp-2026.png');
    expect(fs.existsSync(served)).toBe(true);
    expect(fs.readFileSync(served).equals(fs.readFileSync(path.join(repo, 'brand/sporting-cp-2026.png')))).toBe(true);
  });

  it('o caminho é o do SPORTING_CREST_URL das functions', () => {
    const brand = fs.readFileSync(path.join(repo, 'functions/src/config/brand.ts'), 'utf8');
    expect(brand).toContain('"https://scp360-37a74.web.app/brand/sporting-cp-2026.png"');
  });
});

describe('firebase.json hosting', () => {
  const fb = JSON.parse(fs.readFileSync(path.join(repo, 'firebase.json'), 'utf8'));

  it('serve hosting/public com URLs limpos e sem esconder o .well-known', () => {
    expect(fb.hosting.public).toBe('hosting/public');
    expect(fb.hosting.cleanUrls).toBe(true);
    expect(fb.hosting.trailingSlash).toBe(false);
    expect(fb.hosting.ignore).not.toContain('**/.*');
  });

  it('serve o apple-app-site-association como application/json', () => {
    const rule = fb.hosting.headers.find((h: { source: string }) => h.source === '/.well-known/apple-app-site-association');
    expect(rule.headers).toEqual([{ key: 'Content-Type', value: 'application/json' }]);
  });

  it('mantém functions, firestore e emuladores', () => {
    expect(fb.functions[0].codebase).toBe('v2027');
    expect(fb.firestore.rules).toBe('firestore.rules');
    expect(fb.emulators.functions.port).toBe(5001);
  });
});
