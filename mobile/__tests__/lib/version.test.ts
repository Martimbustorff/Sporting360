import { isVersionBelow, resolveStoreUrl, STORE_URLS } from '@/lib/version';

describe('isVersionBelow', () => {
  it.each([
    ['7.0.0', '7.0.1', true],
    ['7.10.0', '7.9.9', false],
    ['7.0', '7.0.0', false],
    ['6.1.2', '7.0.0', true],
    ['7.0.0', '7.0.0', false],
    ['7', '7.0.1', true],
    ['7.0.0', 'abc', false],
    ['7.0.0', '', false],
    ['7.0.0', '7.0.0.1', false],
    ['7.0.0-beta', '8.0.0', false],
    [null as unknown as string, '7.0.0', false],
    [undefined as unknown as string, '7.0.0', false],
    ['7.0.0', null as unknown as string, false],
  ])('(%p, %p) -> %p', (cur, min, expected) => {
    expect(isVersionBelow(cur, min)).toBe(expected);
  });
});

describe('resolveStoreUrl', () => {
  it('uses the defaults when there is no override', () => {
    expect(resolveStoreUrl('ios', undefined)).toBe(STORE_URLS.ios);
    expect(resolveStoreUrl('android', null)).toBe(STORE_URLS.android);
    expect(resolveStoreUrl('ios', { ios: null })).toBe(STORE_URLS.ios);
  });
  it('accepts an https override on the right store host', () => {
    expect(resolveStoreUrl('ios', { ios: 'https://apps.apple.com/pt/app/id1' })).toBe('https://apps.apple.com/pt/app/id1');
    expect(resolveStoreUrl('android', { android: 'https://play.google.com/store/apps/details?id=x' })).toBe(
      'https://play.google.com/store/apps/details?id=x',
    );
  });
  it.each([
    ['ios', 'https://evil.example.com/app'],
    ['ios', 'http://apps.apple.com/app/id1'],
    ['ios', 'https://apps.apple.com.evil.com/app/id1'],
    ['ios', 'https://evil.com/?https://apps.apple.com/'],
    ['ios', 'https://user@evil.com/apps.apple.com'],
    ['ios', 'https://play.google.com/store/apps/details?id=x'],
    ['android', 'https://apps.apple.com/app/id1'],
    ['android', 'javascript:alert(1)'],
    ['android', 'not a url'],
    ['android', ''],
  ] as const)('falls back for %s with %p', (os, url) => {
    expect(resolveStoreUrl(os, { [os]: url })).toBe(STORE_URLS[os]);
  });
});
