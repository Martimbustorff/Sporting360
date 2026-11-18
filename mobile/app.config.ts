import type { ConfigContext, ExpoConfig } from 'expo/config';

import share from './share.config.json';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { launchGateProblems } = require('./scripts/launchGate') as { launchGateProblems: (root: string) => string[] };

// Os domínios do link de partilha vivem só em share.config.json. Aqui geram-se os universal links (iOS) e os
// app links (Android) a partir do app.json. Mudar de domínio exige um build nativo novo.
export default ({ config }: ConfigContext): ExpoConfig => {
  // Guarda de lançamento: um build de produção falha aqui, antes de subir, enquanto houver pendentes em src/content.
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    const problems = launchGateProblems(__dirname);
    if (problems.length > 0) throw new Error('Build de produção bloqueado: ' + problems.join('; '));
  }
  const hosts = [...new Set([share.host, ...share.extraHosts])];
  return {
    ...config,
    name: config.name ?? 'S360',
    slug: config.slug ?? 's3602027',
    ios: {
      ...config.ios,
      associatedDomains: hosts.map((h) => `applinks:${h}`),
    },
    android: {
      ...config.android,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: hosts.map((host) => ({ scheme: 'https', host, pathPrefix: '/j' })),
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
};
