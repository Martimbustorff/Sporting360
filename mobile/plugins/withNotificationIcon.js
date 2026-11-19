// Plano 6: ícone pequeno das notificações no Android (o FCM usa @drawable/notification_icon e
// @color/notification_icon_color, que o plugin do @react-native-firebase/messaging declara no manifest).
// Sem isto o Android desenha o ícone da app como um quadrado branco na barra de estado.
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidColors, withDangerousMod } = require('expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');

/** 24 dp por densidade. */
const NOTIFICATION_ICON_SIZES = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };

async function writeNotificationIcons(projectRoot, resRoot, icon) {
  for (const [density, size] of Object.entries(NOTIFICATION_ICON_SIZES)) {
    const { source } = await generateImageAsync(
      { projectRoot, cacheType: 'android-notification-icon' },
      { src: path.resolve(projectRoot, icon), width: size, height: size, resizeMode: 'contain', backgroundColor: 'transparent' },
    );
    const dir = path.join(resRoot, `drawable-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'notification_icon.png'), source);
  }
}

function withNotificationIcon(config, { icon, color }) {
  config = withAndroidColors(config, (c) => {
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: 'notification_icon_color', value: color });
    return c;
  });
  return withDangerousMod(config, [
    'android',
    async (c) => {
      await writeNotificationIcons(c.modRequest.projectRoot, path.join(c.modRequest.platformProjectRoot, 'app/src/main/res'), icon);
      return c;
    },
  ]);
}

module.exports = withNotificationIcon;
module.exports.writeNotificationIcons = writeNotificationIcons;
module.exports.NOTIFICATION_ICON_SIZES = NOTIFICATION_ICON_SIZES;
