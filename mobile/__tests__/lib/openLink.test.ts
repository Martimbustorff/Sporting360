// Task 26 (minor da Task 25): uma só forma de abrir ligações externas (estádio, sites, comunidade).
import * as WebBrowser from 'expo-web-browser';

jest.mock('@react-native-firebase/crashlytics');

import { recordError } from '@react-native-firebase/crashlytics';
import { openLink } from '@/lib/openLink';

beforeEach(() => jest.clearAllMocks());

describe('openLink', () => {
  it('https abre no browser da app', async () => {
    await openLink('https://lojaverde.sporting.pt/pt');
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://lojaverde.sporting.pt/pt');
  });

  it.each(['http://x.pt', 'javascript:alert(1)', '', null, undefined])('%p não abre', async (url) => {
    await openLink(url);
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it('falha ao abrir vai ao Crashlytics sem a query nem o fragmento, e não lança', async () => {
    (WebBrowser.openBrowserAsync as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'ERR_X' }));
    await expect(openLink('https://www.youtube.com/watch?v=abc&token=s3cr3t#t=1')).resolves.toBeUndefined();
    expect(recordError).toHaveBeenCalledTimes(1);
    const msg = ((recordError as jest.Mock).mock.calls[0][1] as Error).message;
    expect(msg).toContain('OPEN_LINK_FAILED');
    expect(msg).toContain('https://www.youtube.com/watch');
    expect(msg).not.toMatch(/abc|s3cr3t|\?|#/);
  });
});
