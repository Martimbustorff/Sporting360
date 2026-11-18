// SEM FIGMA: leitor VSports sem frame vetorial; referência na imagem "Appstore S360" 818:20891 (get_design_context):
// miniatura 16:9 a toda a largura com cantos arredondados e o título por baixo (texto `body` branco). Composto com
// tokens: ícone de play por cima da miniatura, minuto (`minute`) antes do título, e o ecrã total (Modal preto com a
// barra "Fechar" em cima, WebView por baixo). Erro: texto centrado no mesmo espaço.
//
// Segurança: só se carrega `embedSrc` (https em vsports.pt ou num subdomínio), nunca HTML; a navegação do topo não
// sai de vsports.pt. Orientação (preflight P3): abrir trava em horizontal; fechar, desmontar ou erro voltam sempre a
// PORTRAIT_UP (a raiz trava PORTRAIT_UP no arranque).
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StatusBar, View } from 'react-native';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { Video } from '@/data/schemas';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export const VIDEO_ERROR = 'Não foi possível abrir o vídeo.';
const ORIGINS = ['https://vsports.pt', 'https://*.vsports.pt'];
const ORIENTATIONS = ['portrait', 'landscape-left', 'landscape-right'] as const;

/**
 * `https:` e host `vsports.pt` ou terminado em `.vsports.pt`. Sem `URL` (o do RN não é fiável no `hostname`):
 * a autoridade não pode ter utilizador (`@`), porta, barras invertidas nem espaços.
 */
export function isAllowedEmbed(src: string): boolean {
  const m = /^https:\/\/([^/?#]*)(?:[/?#]|$)/i.exec(src);
  if (!m || /[\s\\]/.test(src)) return false;
  const host = (m[1] ?? '').toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  return host === 'vsports.pt' || host.endsWith('.vsports.pt');
}

/** Navegação do topo só em vsports.pt; os subframes do próprio player (iOS) não se cortam aqui. */
function allowNavigation(r: Pick<WebViewNavigation, 'url'> & { isTopFrame?: boolean }): boolean {
  return r.isTopFrame === false || isAllowedEmbed(r.url);
}

function lock(o: ScreenOrientation.OrientationLock) {
  ScreenOrientation.lockAsync(o).catch(() => {});
}

function Frame({ children }: { children?: React.ReactNode }) {
  return (
    <View
      style={{
        width: '100%',
        aspectRatio: layout.videoAspect,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.surface10,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

export function VideoPlayer({ video }: { video: Video }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const allowed = isAllowedEmbed(video.embedSrc);

  useEffect(() => {
    if (!open || failed) return;
    lock(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => lock(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, [open, failed]);

  const show = useCallback(() => {
    setFailed(false);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const fail = useCallback(() => setFailed(true), []);

  const caption = (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'baseline', marginTop: layout.videoGap }}>
      {video.minute ? <Display variant="minute">{`${video.minute}'`}</Display> : null}
      <Body variant="body" style={{ flex: 1 }} numberOfLines={3}>
        {video.title}
      </Body>
    </View>
  );

  if (!allowed) {
    return (
      <View testID="video-error">
        <Frame>
          <Body variant="body" style={{ textAlign: 'center' }}>{VIDEO_ERROR}</Body>
        </Frame>
        {caption}
      </View>
    );
  }

  return (
    <View>
      <Pressable
        testID="video-open"
        accessibilityRole="button"
        accessibilityLabel={`Ver vídeo: ${video.title}`}
        onPress={show}
        style={({ pressed }) => ({ opacity: pressed ? layout.pressedOpacity : 1 })}
      >
        <Frame>
          {video.thumbnail ? (
            <Image
              testID="video-thumbnail"
              source={{ uri: video.thumbnail }}
              contentFit="cover"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              accessible={false}
            />
          ) : null}
          <Feather testID="video-play-icon" name="play-circle" size={layout.videoPlayIcon} color={colors.white} />
        </Frame>
        {caption}
      </Pressable>
      {open ? (
        <Modal
          testID="video-modal"
          visible
          animationType="none"
          presentationStyle="fullScreen"
          supportedOrientations={[...ORIENTATIONS]}
          statusBarTranslucent
          onRequestClose={close}
        >
          <StatusBar hidden />
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }}>
            <View style={{ height: layout.videoCloseBarHeight, justifyContent: 'center', paddingHorizontal: spacing.md }}>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                hitSlop={spacing.sm}
                style={{ alignSelf: 'flex-start', minHeight: layout.minTouch, justifyContent: 'center' }}
              >
                <Body variant="strip">Fechar</Body>
              </Pressable>
            </View>
            {failed ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
                <Body variant="body" style={{ textAlign: 'center' }}>{VIDEO_ERROR}</Body>
              </View>
            ) : (
              <WebView
                style={{ flex: 1, backgroundColor: colors.black }}
                source={{ uri: video.embedSrc }}
                originWhitelist={ORIGINS}
                onShouldStartLoadWithRequest={allowNavigation}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowFileAccess={false}
                allowFileAccessFromFileURLs={false}
                allowUniversalAccessFromFileURLs={false}
                setSupportMultipleWindows={false}
                allowsLinkPreview={false}
                onError={fail}
                onHttpError={fail}
              />
            )}
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}
