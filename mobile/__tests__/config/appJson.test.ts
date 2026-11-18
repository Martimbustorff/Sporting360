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
  });

  it('registers the orientation and web-browser plugins and keeps kotlin 2.4.0', () => {
    expect(expo.plugins).toContain('expo-screen-orientation');
    expect(expo.plugins).toContain('expo-web-browser');
    const bp = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-build-properties');
    expect(bp[1].android.kotlinVersion).toBe('2.4.0');
  });
});

describe('mobile/firebase.json', () => {
  it('turns analytics collection off by default', () => {
    const fb = read('firebase.json');
    expect(fb['react-native'].analytics_auto_collection_enabled).toBe(false);
    expect(fb['react-native'].google_analytics_adid_collection_enabled).toBe(false);
  });
});
