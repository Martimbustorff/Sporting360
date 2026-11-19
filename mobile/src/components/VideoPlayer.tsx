// SEM FIGMA: leitor VSports sem frame vetorial; referência na imagem "Appstore S360" 818:20891 (get_design_context):
// miniatura 16:9 a toda a largura com cantos arredondados e o título por baixo (texto `body` branco). Composto com
// tokens: ícone de play por cima da miniatura, minuto (`minute`) antes do título, e o ecrã total (Modal preto com a
// barra "Fechar" em cima, WebView por baixo). Erro: texto centrado no mesmo espaço.
//
// Segurança: só se carrega `embedSrc` (https em vsports.pt ou num subdomínio, com `autostart=true` por `playerUri`),
// nunca HTML. `originWhitelist={['*']}` para o react-native-webview nunca abrir nada fora (`Linking`); o único filtro
// é `shouldLoad`: o topo fica em vsports.pt, os subframes do iOS só https/about/blob/data; o resto é recusado. Orientação (preflight P3): abrir trava em horizontal; fechar, desmontar ou erro voltam sempre a
// PORTRAIT_UP (a raiz trava PORTRAIT_UP no arranque).
import { useCallback, useEffect, useState } from 'react';
import { Modal, StatusBar, View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { Video } from '@/data/schemas';
import { playerUri } from '@/lib/vsports';
import { Body, Display, Text71 } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

export const VIDEO_ERROR = 'Não foi possível abrir o vídeo.';
const ORIGINS = ['*'];
const SUBFRAME_SCHEMES = /^(https|about|blob|data):/i;
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

/**
 * Único filtro de navegação do WebView. Topo (`isTopFrame` diferente de `false`; o Android não o envia): só
 * `isAllowedEmbed`. Subframes do iOS (`isTopFrame === false`): só https, about, blob e data. O resto é recusado
 * em silêncio, sem abrir nada fora da app.
 */
export function shouldLoad(req: { url: string; isTopFrame?: boolean }): boolean {
  if (req.isTopFrame === false) return SUBFRAME_SCHEMES.test(req.url);
  return isAllowedEmbed(req.url);
}

/** Duração em segundos para "4:12"; sem valor válido não há duração. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

function lock(o: ScreenOrientation.OrientationLock) {
  ScreenOrientation.lockAsync(o).catch(() => {});
}

function Frame({ children, row }: { children?: React.ReactNode; row?: boolean }) {
  return (
    <View
      style={{
        ...(row
          ? { width: layout.videoRowThumb.width, height: layout.videoRowThumb.height, flexShrink: 0 }
          : { width: '100%', aspectRatio: layout.videoAspect }),
        borderRadius: row ? layout.videoRowRadius : layout.videoRadius,
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

/**
 * `variant`: 'default' (miniatura a toda a largura, minuto e título) ou, no Figma V7.1 4947:8624, 'featured' (16:9 com
 * duração, rótulo do tipo em Eyebrow 13 e título em Body 14 por baixo) e 'row' (miniatura 132x74 à esquerda, rótulo e
 * título à direita). `kind` é o rótulo do tipo; a duração só aparece se `video.duration` existir.
 */
export function VideoPlayer({ video, variant = 'default', kind }: { video: Video; variant?: 'default' | 'featured' | 'row'; kind?: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const uri = playerUri(video.embedSrc);
  const allowed = isAllowedEmbed(video.embedSrc) && isAllowedEmbed(uri);

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

  const duration = formatDuration(video.duration);
  const v71 = variant !== 'default';
  const row = variant === 'row';
  const label = v71 ? (
    <View style={{ flex: row ? 1 : undefined, minWidth: 0, gap: layout.videoLabelGap, marginTop: row ? 0 : layout.videoGap }}>
      {kind ? (
        <Text71 testID="video-type" variant="eyebrow13" color="primaryOnDark" numberOfLines={1}>{kind}</Text71>
      ) : null}
      <Text71 variant="body14" numberOfLines={row ? 2 : 3}>{video.title}</Text71>
    </View>
  ) : null;
  const durationChip = duration ? (
    <View
      testID="video-duration"
      style={{
        position: 'absolute',
        right: layout.videoDurationInset,
        bottom: layout.videoDurationInset,
        paddingHorizontal: spacing.xs,
        paddingVertical: 1,
        borderRadius: layout.videoDurationRadius,
        backgroundColor: colors.bg,
      }}
    >
      <Text71 variant="badge11">{duration}</Text71>
    </View>
  ) : null;
  const playSize = row ? layout.videoPlayCircleSmall : layout.videoPlayCircle;
  const playBadge = (
    <View
      testID="video-play-icon"
      style={{
        width: playSize,
        height: playSize,
        borderRadius: playSize / 2,
        backgroundColor: colors.scrimV71,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name="play" size={playSize / 2} color={colors.white} />
    </View>
  );

  if (!allowed) {
    if (v71) {
      return (
        <View testID="video-error" style={row ? { flexDirection: 'row', gap: spacing.sm } : undefined}>
          <Frame row={row}>
            <Text71 variant="caption12" style={{ textAlign: 'center' }}>{VIDEO_ERROR}</Text71>
          </Frame>
          {label}
        </View>
      );
    }
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
      <Touchable
        testID="video-open"
        accessibilityRole="button"
        accessibilityLabel={`Ver vídeo: ${video.title}`}
        onPress={show}
        style={row ? { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' } : undefined}
      >
        <Frame row={row}>
          {video.thumbnail ? (
            <Image
              testID="video-thumbnail"
              source={{ uri: video.thumbnail }}
              contentFit="cover"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              accessible={false}
            />
          ) : null}
          {v71 ? playBadge : (
            <Feather testID="video-play-icon" name="play-circle" size={layout.videoPlayIcon} color={colors.white} />
          )}
          {v71 ? durationChip : null}
        </Frame>
        {v71 ? label : caption}
      </Touchable>
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
              <Touchable
                accessibilityRole="button"
                onPress={close}
                hitSlop={spacing.sm}
                style={{ alignSelf: 'flex-start', minHeight: layout.minTouch, justifyContent: 'center' }}
              >
                <Body variant="strip">Fechar</Body>
              </Touchable>
            </View>
            {failed ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
                <Body variant="body" style={{ textAlign: 'center' }}>{VIDEO_ERROR}</Body>
              </View>
            ) : (
              <WebView
                style={{ flex: 1, backgroundColor: colors.black }}
                source={{ uri }}
                originWhitelist={ORIGINS}
                onShouldStartLoadWithRequest={shouldLoad}
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
