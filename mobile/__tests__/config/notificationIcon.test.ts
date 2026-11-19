// Plano 6 (fix I2): ícone pequeno das notificações no Android, a partir do ícone monocromático, com a cor primária.
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const ICON = './assets/images/android-icon-monochrome.png';
const COLOR = '#00835B';

type Meta = { $: Record<string, string> };

describe('ícone das notificações no Android', () => {
  const { expo } = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

  it('app.json passa o ícone e a cor ao plugin do messaging e regista o plugin local', () => {
    const rnfb = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === '@react-native-firebase/messaging');
    expect(rnfb[1]).toEqual({ android: { notificationIcon: ICON, notificationColor: COLOR } });
    const local = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === './plugins/withNotificationIcon');
    expect(local[1]).toEqual({ icon: ICON, color: COLOR });
    expect(expo.plugins).not.toContain('@react-native-firebase/messaging');
  });

  it('expo config --type introspect: meta-data do FCM e cor notification_icon_color', () => {
    const out = execFileSync('npx', ['expo', 'config', '--type', 'introspect', '--json'], { cwd: root, encoding: 'utf8', env: { ...process.env, EXPO_NO_TELEMETRY: '1' } });
    const cfg = JSON.parse(out);
    const android = cfg._internal.modResults.android;
    const meta: Meta[] = android.manifest.manifest.application[0]['meta-data'] ?? [];
    const byName = (n: string) => meta.find((m) => m.$['android:name'] === n)?.$;
    expect(byName('com.google.firebase.messaging.default_notification_icon')?.['android:resource']).toBe('@drawable/notification_icon');
    expect(byName('com.google.firebase.messaging.default_notification_color')?.['android:resource']).toBe('@color/notification_icon_color');
    const colors: { $: { name: string }; _: string }[] = android.colors.resources.color ?? [];
    expect(colors.find((c) => c.$.name === 'notification_icon_color')?._).toBe(COLOR);
  }, 60000);

  it('gera notification_icon.png em cada densidade, a partir do ícone monocromático', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeNotificationIcons, NOTIFICATION_ICON_SIZES } = require('../../plugins/withNotificationIcon');
    const res = fs.mkdtempSync(path.join(os.tmpdir(), 'res-'));
    await writeNotificationIcons(root, res, ICON);
    expect(NOTIFICATION_ICON_SIZES).toEqual({ mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 });
    for (const [density, size] of Object.entries(NOTIFICATION_ICON_SIZES as Record<string, number>)) {
      const png = fs.readFileSync(path.join(res, `drawable-${density}`, 'notification_icon.png'));
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  }, 60000);
});
