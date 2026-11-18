// Task 15: leitor VSports. WebView e expo-screen-orientation vêm dos mocks em __mocks__.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Video } from '@/data/schemas';

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View {...props} /> };
});

import { isAllowedEmbed, shouldLoad, VideoPlayer } from '@/components/VideoPlayer';

const { LANDSCAPE, PORTRAIT_UP } = ScreenOrientation.OrientationLock;
const lockAsync = ScreenOrientation.lockAsync as jest.Mock;
const webView = WebView as unknown as jest.Mock;

const video = (over: Partial<Video> = {}): Video => ({
  id: 'v1',
  title: 'GOLO! Sporting, Geny aos 1\'',
  minute: '1',
  type: 'golo',
  thumbnail: 'https://cdn.vsports.pt/t/1.jpg',
  embedSrc: 'https://www.vsports.pt/embed/1',
  publishedAt: new Date('2026-04-06T19:01:00Z'),
  ...over,
});

const REAL = 'https://sporting.vsports.pt/embd/100020/m/19776/scp/abc';
let openURL: jest.SpyInstance;

beforeEach(() => {
  lockAsync.mockClear();
  webView.mockClear();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(() => openURL.mockRestore());

const lastWebViewProps = () => webView.mock.calls[webView.mock.calls.length - 1][0] as Record<string, unknown>;

describe('isAllowedEmbed', () => {
  it.each([
    'https://vsports.pt/embed/1',
    'https://www.vsports.pt/embed/1?autoplay=1',
    'https://player.cdn.vsports.pt/e/9',
    'HTTPS://WWW.VSPORTS.PT/embed/1',
    `${REAL}?autostart=false`,
  ])('aceita %s', (u) => expect(isAllowedEmbed(u)).toBe(true));

  it.each([
    'http://www.vsports.pt/embed/1',
    'https://evil.com/x',
    'https://vsports.pt.evil.com/x',
    'https://evilvsports.pt/x',
    'https://evil.com/?h=vsports.pt',
    'https://vsports.pt@evil.com/x',
    'javascript:alert(1)//vsports.pt',
    'data:text/html,<script>1</script>',
    'file:///etc/passwd',
    '//www.vsports.pt/embed/1',
    '',
    'não é url',
  ])('recusa %s', (u) => expect(isAllowedEmbed(u)).toBe(false));
});

describe('shouldLoad', () => {
  it.each([
    ['topo em vsports.pt', { url: 'https://www.vsports.pt/embed/1', isTopFrame: true }, true],
    ['topo no host real', { url: `${REAL}?autostart=true`, isTopFrame: true }, true],
    ['topo noutro host', { url: 'https://evil.com/x', isTopFrame: true }, false],
    ['topo com host parecido', { url: 'https://vsports.pt.evil.com/x', isTopFrame: true }, false],
    ['topo em http', { url: 'http://www.vsports.pt/embed/1', isTopFrame: true }, false],
    ['topo javascript:', { url: 'javascript:alert(1)', isTopFrame: true }, false],
    ['Android sem isTopFrame, vsports', { url: 'https://www.vsports.pt/embed/1' }, true],
    ['Android sem isTopFrame, outro host', { url: 'https://evil.com/x' }, false],
    ['Android sem isTopFrame, intent:', { url: 'intent://x#Intent;end' }, false],
    ['iframe iOS https noutro host', { url: 'https://cdn.example/player', isTopFrame: false }, true],
    ['iframe iOS about:blank', { url: 'about:blank', isTopFrame: false }, true],
    ['iframe iOS blob:', { url: 'blob:https://www.vsports.pt/1', isTopFrame: false }, true],
    ['iframe iOS data:', { url: 'data:text/html,x', isTopFrame: false }, true],
    ['iframe iOS http', { url: 'http://cdn.example/player', isTopFrame: false }, false],
    ['iframe iOS javascript:', { url: 'javascript:alert(1)', isTopFrame: false }, false],
    ['iframe iOS itms-apps:', { url: 'itms-apps://x', isTopFrame: false }, false],
    ['iframe iOS tel:', { url: 'tel:123', isTopFrame: false }, false],
  ])('%s', (_name, req, ok) => {
    expect(shouldLoad(req)).toBe(ok);
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe('VideoPlayer', () => {
  it('miniatura com play, título e minuto; sem WebView antes do toque', async () => {
    await render(<VideoPlayer video={video()} />);
    expect(screen.getByTestId('video-thumbnail')).toBeTruthy();
    expect(screen.getByTestId('video-play-icon')).toBeTruthy();
    expect(screen.getByText('GOLO! Sporting, Geny aos 1\'')).toBeTruthy();
    expect(screen.getByText("1'")).toBeTruthy();
    expect(screen.queryByTestId('webview')).toBeNull();
    expect(lockAsync).not.toHaveBeenCalled();
  });

  it('toque abre logo o WebView em ecrã total só com o embedSrc, sem html, e roda para horizontal', async () => {
    await render(<VideoPlayer video={video()} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    expect(screen.getByTestId('webview')).toBeTruthy();
    const p = lastWebViewProps();
    expect(p.source).toEqual({ uri: 'https://www.vsports.pt/embed/1?autostart=true' });
    expect((p.source as Record<string, unknown>).html).toBeUndefined();
    expect(p.allowsFullscreenVideo).toBe(true);
    expect(p.allowsInlineMediaPlayback).toBe(true);
    expect(p.mediaPlaybackRequiresUserAction).toBe(false);
    expect(p.injectedJavaScript).toBeUndefined();
    expect(p.injectedJavaScriptBeforeContentLoaded).toBeUndefined();
    expect(p.allowFileAccess).toBe(false);
    expect(p.allowFileAccessFromFileURLs).toBe(false);
    expect(p.allowUniversalAccessFromFileURLs).toBe(false);
    expect(p.setSupportMultipleWindows).toBe(false);
    expect(lockAsync).toHaveBeenCalledTimes(1);
    expect(lockAsync).toHaveBeenLastCalledWith(LANDSCAPE);
  });

  it('o Modal deixa rodar (iOS precisa de supportedOrientations)', async () => {
    await render(<VideoPlayer video={video()} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    const modal = screen.getByTestId('video-modal');
    expect(modal.props.supportedOrientations).toEqual(expect.arrayContaining(['portrait', 'landscape-left', 'landscape-right']));
  });

  it('originWhitelist ["*"] e shouldLoad ligado: o WebView nunca abre nada fora (Linking)', async () => {
    await render(<VideoPlayer video={video()} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    const p = lastWebViewProps();
    expect(p.originWhitelist).toEqual(['*']);
    expect(p.onShouldStartLoadWithRequest).toBe(shouldLoad);
    const should = p.onShouldStartLoadWithRequest as typeof shouldLoad;
    expect(should({ url: 'https://evil.com/phish', isTopFrame: true })).toBe(false);
    expect(should({ url: 'intent://x#Intent;end', isTopFrame: false })).toBe(false);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('forma real: abre com autostart=true, o embedSrc guardado não muda', async () => {
    const v = video({ embedSrc: `${REAL}?autostart=false` });
    await render(<VideoPlayer video={v} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    expect(lastWebViewProps().source).toEqual({ uri: `${REAL}?autostart=true` });
    expect(v.embedSrc).toBe(`${REAL}?autostart=false`);
  });

  it('"Fechar" fecha e volta a vertical', async () => {
    await render(<VideoPlayer video={video()} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    await fireEvent.press(screen.getByText('Fechar'));
    expect(screen.queryByTestId('webview')).toBeNull();
    expect(lockAsync).toHaveBeenLastCalledWith(PORTRAIT_UP);
    expect(lockAsync.mock.calls.map((c) => c[0])).toEqual([LANDSCAPE, PORTRAIT_UP]);
  });

  it('voltar do Android (onRequestClose) fecha e volta a vertical', async () => {
    await render(<VideoPlayer video={video()} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    await act(async () => {
      (screen.getByTestId('video-modal').props.onRequestClose as () => void)();
    });
    expect(screen.queryByTestId('webview')).toBeNull();
    expect(lockAsync).toHaveBeenLastCalledWith(PORTRAIT_UP);
  });

  it('desmontar com o vídeo aberto volta a vertical', async () => {
    const r = await render(<VideoPlayer video={video()} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    await r.unmount();
    expect(lockAsync).toHaveBeenLastCalledWith(PORTRAIT_UP);
  });

  it('erro do WebView mostra o erro, volta a vertical e "Fechar" continua a fechar', async () => {
    await render(<VideoPlayer video={video()} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    await act(async () => {
      (lastWebViewProps().onError as () => void)();
    });
    expect(screen.getByText('Não foi possível abrir o vídeo.')).toBeTruthy();
    expect(screen.queryByTestId('webview')).toBeNull();
    expect(lockAsync).toHaveBeenLastCalledWith(PORTRAIT_UP);
    await fireEvent.press(screen.getByText('Fechar'));
    expect(screen.queryByTestId('video-modal')).toBeNull();
  });

  it('erro HTTP do WebView também mostra o erro', async () => {
    await render(<VideoPlayer video={video()} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    await act(async () => {
      (lastWebViewProps().onHttpError as () => void)();
    });
    expect(screen.getByText('Não foi possível abrir o vídeo.')).toBeTruthy();
    expect(lockAsync).toHaveBeenLastCalledWith(PORTRAIT_UP);
  });

  it('embedSrc fora de vsports.pt: estado de erro, nunca o WebView nem rotação', async () => {
    await render(<VideoPlayer video={video({ embedSrc: 'https://evil.com/x' })} />);
    expect(screen.getByText('Não foi possível abrir o vídeo.')).toBeTruthy();
    expect(screen.queryByTestId('video-open')).toBeNull();
    expect(webView).not.toHaveBeenCalled();
    expect(lockAsync).not.toHaveBeenCalled();
  });

  it('sem miniatura nem minuto: só o título, o play continua', async () => {
    await render(<VideoPlayer video={video({ thumbnail: null, minute: null, title: 'Resumo do jogo' })} />);
    expect(screen.getByText('Resumo do jogo')).toBeTruthy();
    expect(screen.queryByTestId('video-thumbnail')).toBeNull();
    expect(screen.getByTestId('video-play-icon')).toBeTruthy();
    expect(screen.queryByText(/'$/)).toBeNull();
  });

  it('lockAsync a falhar não rebenta', async () => {
    lockAsync.mockImplementationOnce(() => Promise.reject(new Error('unsupported')));
    await render(<VideoPlayer video={video()} />);
    await fireEvent.press(screen.getByTestId('video-open'));
    await act(async () => {});
    expect(screen.getByTestId('webview')).toBeTruthy();
  });
});
