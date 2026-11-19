import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

describe('app.json', () => {
  const { expo } = read('app.json');

  it('allows rotation by default (the app locks portrait at startup)', () => {
    expect(expo.orientation).toBe('default');
  });

  it('configures the camera plugin with a pt-PT permission text', () => {
    const entry = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-camera');
    expect(entry).toBeTruthy();
    expect(entry[1].cameraPermission).toBe('A S360 usa a câmara para ler o código da tua GameBox.');
    expect(entry[1].recordAudioAndroid).toBe(false);
    // The app never records audio: no microphone permission on iOS either.
    expect(entry[1].microphonePermission).toBe(false);
  });

  it('registers the orientation and web-browser plugins and keeps kotlin 2.4.0', () => {
    expect(expo.plugins).toContain('expo-screen-orientation');
    expect(expo.plugins).toContain('expo-web-browser');
    const bp = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-build-properties');
    expect(bp[1].android.kotlinVersion).toBe('2.4.0');
  });
});

describe('app.config.ts share link (Plano 5, Task 6)', () => {
  const appJson = read('app.json');
  const HOST = 's360-prognostico-download.web.app';

  // Corre o app.config.ts com o share.config.json real, ou com um simulado (doMock).
  function build(share?: { host: string; extraHosts: string[] }) {
    jest.resetModules();
    if (share) jest.doMock('../../share.config.json', () => share);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const makeConfig = require('../../app.config').default;
    return makeConfig({ config: appJson.expo });
  }

  afterEach(() => {
    jest.dontMock('../../share.config.json');
    jest.resetModules();
  });

  it('associates the Hosting domain for iOS universal links', () => {
    expect(build().ios.associatedDomains).toEqual([`applinks:${HOST}`]);
  });

  it('verifies the Hosting domain for Android app links on /j and /e/ (Plano 8, Task 7)', () => {
    expect(build().android.intentFilters).toEqual([
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: HOST, pathPrefix: '/j' },
          { scheme: 'https', host: HOST, pathPrefix: '/e/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ]);
  });

  it('keeps the rest of app.json untouched', () => {
    const cfg = build();
    expect(cfg.name).toBe(appJson.expo.name);
    expect(cfg.ios.bundleIdentifier).toBe('com.scp360');
    expect(cfg.android.package).toBe('com.scp360');
  });

  it('adds one applinks and one data entry per host (main + extraHosts)', () => {
    const cfg = build({ host: 's360-download.app', extraHosts: ['scp360-37a74.web.app'] });
    expect(cfg.ios.associatedDomains).toEqual(['applinks:s360-download.app', 'applinks:scp360-37a74.web.app']);
    expect(cfg.android.intentFilters[0].data).toEqual([
      { scheme: 'https', host: 's360-download.app', pathPrefix: '/j' },
      { scheme: 'https', host: 's360-download.app', pathPrefix: '/e/' },
      { scheme: 'https', host: 'scp360-37a74.web.app', pathPrefix: '/j' },
      { scheme: 'https', host: 'scp360-37a74.web.app', pathPrefix: '/e/' },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require('../../src/lib/shareLink').shareLink('1001')).toBe('https://s360-download.app/j?src=share&game=1001');
  });

  it('does not repeat a host listed in extraHosts', () => {
    const cfg = build({ host: HOST, extraHosts: [HOST] });
    expect(cfg.ios.associatedDomains).toEqual([`applinks:${HOST}`]);
  });

  it('app.json no longer carries any web.app host', () => {
    expect(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).not.toContain('web.app');
  });
});

describe('push (Plano 6)', () => {
  const { expo } = read('app.json');
  it('regista o plugin de messaging e o push no iOS', () => {
    expect(expo.plugins.some((p: unknown) => (Array.isArray(p) ? p[0] : p) === '@react-native-firebase/messaging')).toBe(true);
    expect(expo.ios.entitlements['aps-environment']).toBe('production');
    expect(expo.ios.infoPlist.UIBackgroundModes).toEqual(['remote-notification']);
  });
  it('o app.config.ts mantém o entitlement', () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cfg = require('../../app.config').default({ config: expo });
    expect(cfg.ios.entitlements['aps-environment']).toBe('production');
  });
  it('firebase.json mostra notificações com a app aberta no iOS', () =>
    expect(read('firebase.json')['react-native'].messaging_ios_foreground_presentation_options).toEqual(['badge', 'sound', 'list', 'banner']));
  it('o messaging tem a mesma versão dos outros módulos RNFirebase', () => {
    const deps = read('package.json').dependencies as Record<string, string>;
    expect(deps['@react-native-firebase/messaging']).toBe(deps['@react-native-firebase/app']);
  });
});

describe('mobile/firebase.json', () => {
  it('turns analytics collection off by default', () => {
    const fb = read('firebase.json');
    expect(fb['react-native'].analytics_auto_collection_enabled).toBe(false);
    expect(fb['react-native'].google_analytics_adid_collection_enabled).toBe(false);
  });
});

describe('app.config.ts production gate (Plano 5, Task 8)', () => {
  const appJson = read('app.json');
  const OLD = process.env.EAS_BUILD_PROFILE;

  function build(profile: string, problems: string[]) {
    jest.resetModules();
    process.env.EAS_BUILD_PROFILE = profile;
    jest.doMock('../../scripts/launchGate', () => ({ launchGateProblems: () => problems }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../app.config').default({ config: appJson.expo });
  }

  afterEach(() => {
    if (OLD === undefined) delete process.env.EAS_BUILD_PROFILE;
    else process.env.EAS_BUILD_PROFILE = OLD;
    jest.dontMock('../../scripts/launchGate');
    jest.resetModules();
  });

  it('blocks a production build while there are launch todos', () => {
    expect(() => build('production', ['src/content/a.ts:1 [A DEFINIR PELO MARTIM: x]'])).toThrow(
      /Build de produção bloqueado: src\/content\/a\.ts:1/,
    );
  });

  it('lets a production build through when nothing is pending', () => {
    expect(build('production', []).name).toBe(appJson.expo.name);
  });

  it('does not block other profiles', () => {
    expect(build('development', ['x']).name).toBe(appJson.expo.name);
    expect(build('preview', ['x']).name).toBe(appJson.expo.name);
  });
});

// Apple ITMS-90683: o react-native-share referencia a biblioteca de fotografias; sem estas chaves o upload falha.
describe('iOS purpose strings', () => {
  it('declares the photo library purpose strings in pt-PT', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8'));
    const ip = raw.expo.ios.infoPlist as Record<string, unknown>;
    expect(typeof ip.NSPhotoLibraryUsageDescription).toBe('string');
    expect(typeof ip.NSPhotoLibraryAddUsageDescription).toBe('string');
    expect(String(ip.NSPhotoLibraryUsageDescription)).toMatch(/S360/);
    expect(String(ip.NSPhotoLibraryAddUsageDescription)).toMatch(/S360/);
  });
});
