import fs from 'fs';
import path from 'path';

const eas = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../eas.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
const gitignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf8').split('\n');

const ver = (v: string) => v.split('.').map(Number) as [number, number, number];
const gte = (a: string, b: string) => {
  const [x, y] = [ver(a), ver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! > y[i]!;
  return true;
};

describe('eas.json', () => {
  const profiles = Object.entries<{ node?: string }>(eas.build);

  it('has the four profiles', () => {
    expect(Object.keys(eas.build).sort()).toEqual(['development', 'development-emulator', 'preview', 'production']);
  });

  it('uses the same node in every profile, at least the engines minimum', () => {
    const min = String(pkg.engines.node).replace('>=', '') + '.0';
    const nodes = new Set(profiles.map(([, p]) => p.node));
    expect(nodes.size).toBe(1);
    const node = [...nodes][0]!;
    expect(node).toBe('22.18.0');
    expect(gte(node, min)).toBe(true);
  });

  it('keeps remote versioning and production autoIncrement', () => {
    expect(eas.cli.appVersionSource).toBe('remote');
    expect(eas.build.production.autoIncrement).toBe(true);
  });

  it('keeps the iOS submit settings', () => {
    expect(eas.submit.production.ios).toEqual({
      appleTeamId: '5U6HWPNTZ3',
      bundleIdentifier: 'com.scp360',
      language: 'pt-PT',
      ascAppId: '6450608023',
    });
  });

  it('submits Android to the internal track with a service account outside git', () => {
    expect(eas.submit.production.android).toEqual({
      serviceAccountKeyPath: './google-play-service-account.json',
      track: 'internal',
    });
    expect(gitignore).toContain('google-play-service-account.json');
    expect(gitignore).toContain('*.p8');
  });

  it('runs the launch gate on the EAS server', () => {
    expect(pkg.scripts['eas-build-pre-install']).toBe('node scripts/launchGate.js');
  });
});
