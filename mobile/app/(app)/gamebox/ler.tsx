// Figma V7.1: 46 Ler código da GameBox (4951:9373). Câmara em ecrã inteiro com mira de quatro cantos (primary-on-dark), e por
// baixo a folha bg com raio 28 em cima: "Número lido" (Eyebrow 13 a text-subtle), o número em Title 24 (em grupos de quatro),
// Confirmar (botão Branco) e Corrigir (Contorno). Sem acesso à câmara: aviso e "Abrir definições" (nota 46).
// SEM FIGMA: o estado antes da leitura (dica sobre a câmara e "Inserir manualmente"), o aviso de código não reconhecido e o
// ecrã sem acesso (EmptyState).
// Task 24: aceita só o formato do cartão (6 a 20 algarismos, lib/gamebox). Depois da primeira leitura válida a câmara
// deixa de ler até "Corrigir". Confirmar (F12 revisto): com `from` válido (`nova` ou id do Firestore) volta ao formulário
// que abriu o leitor com `dismissTo` e o parâmetro `numero` (o formulário mantém o que já se escreveu e não fica outro na
// pilha); sem `from` (vindo da Home) ou com um `from` inválido, `replace('/gamebox/nova?numero=n')`.
// O número lido nunca vai para logs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Touchable } from '@/components/Touchable';
import { groupGameboxNumber, isGameboxRouteId, normalizeGameboxNumber } from '@/lib/gamebox';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const LER_TEXT = {
  title: 'Ler GameBox',
  hint: 'Aponta a câmara para o código da tua GameBox.',
  unknown: 'Código não reconhecido.',
  read: 'Número lido',
  confirm: 'Confirmar',
  retry: 'Corrigir',
  manual: 'Inserir manualmente',
  denied: 'Sem acesso à câmara.',
  deniedHint: 'Para ler o código da GameBox, dá acesso à câmara nas definições do telemóvel, ou insere o número à mão.',
  settings: 'Abrir definições',
} as const;

const BARCODE_TYPES = ['qr', 'code128', 'ean13', 'pdf417'] as const;
/** Quanto tempo fica "Código não reconhecido." depois da última leitura inválida. */
export const UNKNOWN_CLEAR_MS = 2000;
const single = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

function ManualLink({ onPress }: { onPress: () => void }) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={LER_TEXT.manual}
      onPress={onPress}
      style={{ minHeight: layout.minTouch, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text71 variant="captionStrong12" color="primaryOnDark">{LER_TEXT.manual}</Text71>
    </Touchable>
  );
}

const CORNER = {
  topLeft: { top: 0, left: 0, borderTopWidth: layout.scanAimStroke, borderLeftWidth: layout.scanAimStroke, borderTopLeftRadius: radii.r8 },
  topRight: { top: 0, right: 0, borderTopWidth: layout.scanAimStroke, borderRightWidth: layout.scanAimStroke, borderTopRightRadius: radii.r8 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: layout.scanAimStroke, borderLeftWidth: layout.scanAimStroke, borderBottomLeftRadius: radii.r8 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: layout.scanAimStroke, borderRightWidth: layout.scanAimStroke, borderBottomRightRadius: radii.r8 },
} as const;

/** Mira de quatro cantos (Figma 4951:9413). */
function Aim({ locked }: { locked: boolean }) {
  return (
    <View testID="scan-aim" style={{ width: layout.scanAim.width, height: layout.scanAim.height }}>
      {(Object.keys(CORNER) as (keyof typeof CORNER)[]).map((k) => (
        <View
          key={k}
          style={[
            { position: 'absolute', width: layout.scanAimCorner, height: layout.scanAimCorner, borderColor: locked ? colors.white : colors.primaryOnDark },
            CORNER[k],
          ]}
        />
      ))}
    </View>
  );
}

export default function GameboxLer() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const rawFrom = single(params.from);
  const from = isGameboxRouteId(rawFrom) ? rawFrom : undefined;
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const { bottom } = useSafeAreaInsets();
  const [scanned, setScanned] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);
  // O primeiro pedido de permissão está em curso: não se mostra o ecrã "sem acesso" por baixo do diálogo do sistema.
  const [asking, setAsking] = useState(false);
  // A câmara pode entregar várias leituras antes de o estado mudar: o ref fecha logo à primeira válida.
  const locked = useRef(false);
  const asked = useRef(false);
  const unknownTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain || asked.current) return;
    asked.current = true;
    setAsking(true);
    requestPermission().finally(() => setAsking(false));
  }, [permission, requestPermission]);

  // Ao voltar das definições do sistema a permissão pode ter mudado.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  const clearUnknown = useCallback(() => {
    if (unknownTimer.current) clearTimeout(unknownTimer.current);
    unknownTimer.current = undefined;
    setUnknown(false);
  }, []);
  useEffect(() => () => {
    if (unknownTimer.current) clearTimeout(unknownTimer.current);
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const manual = () => (from ? back() : router.replace('/gamebox/nova'));

  const onScan = ({ data }: BarcodeScanningResult) => {
    if (locked.current) return;
    const n = normalizeGameboxNumber(data ?? '');
    if (!n) {
      setUnknown(true);
      if (unknownTimer.current) clearTimeout(unknownTimer.current);
      unknownTimer.current = setTimeout(clearUnknown, UNKNOWN_CLEAR_MS);
      return;
    }
    locked.current = true;
    clearUnknown();
    setScanned(n);
  };
  const retry = () => {
    locked.current = false;
    setScanned(null);
  };
  const confirm = () => {
    if (!scanned) return;
    if (from) router.dismissTo({ pathname: '/gamebox/[id]', params: { id: from, numero: scanned } });
    else router.replace(`/gamebox/nova?numero=${scanned}`);
  };

  if (!permission || (!permission.granted && (asking || (permission.canAskAgain && !asked.current)))) {
    return (
      <Screen padded="none">
        <Header title={LER_TEXT.title} onBack={back} />
        <View testID="gamebox-ler-loading" style={{ flex: 1 }} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen padded="none">
        <Header title={LER_TEXT.title} onBack={back} />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.s24, gap: space.s24 }}>
          <EmptyState icon="info" text={LER_TEXT.denied} />
          <Text71 variant="body14" color="textMuted" style={{ textAlign: 'center' }}>{LER_TEXT.deniedHint}</Text71>
          <PrimaryButton label={LER_TEXT.settings} onPress={() => void Linking.openSettings()} />
          <ManualLink onPress={manual} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded="none" edges={['left', 'right']}>
      <Header title={LER_TEXT.title} onBack={back} />
      <View style={{ flex: 1, backgroundColor: colors.bgRaised }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={scanned ? undefined : onScan}
        />
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s16 }}>
          <Aim locked={scanned !== null} />
          {scanned ? null : (
            <View style={{ backgroundColor: colors.scrimV71, borderRadius: radii.r8, paddingHorizontal: space.s16, paddingVertical: space.s8 }}>
              <Text71
                variant="body14"
                accessibilityRole={unknown ? 'alert' : undefined}
                accessibilityLiveRegion="polite"
                color={unknown ? 'danger' : 'white'}
                style={{ textAlign: 'center' }}
              >
                {unknown ? LER_TEXT.unknown : LER_TEXT.hint}
              </Text71>
            </View>
          )}
        </View>
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radii.r28,
            borderTopRightRadius: radii.r28,
            paddingHorizontal: space.s24,
            paddingTop: layout.scanSheetPadTop,
            paddingBottom: layout.scanSheetPadBottom + Math.max(bottom, layout.homeIndicator),
            gap: layout.scanSheetGap,
          }}
        >
          {scanned ? (
            <>
              <Text71 variant="eyebrow13" color="textSubtle">{LER_TEXT.read}</Text71>
              <Text71
                variant="title24"
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${LER_TEXT.read} ${scanned}`}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {groupGameboxNumber(scanned)}
              </Text71>
              <PrimaryButton label={LER_TEXT.confirm} onPress={confirm} variant="white" />
              <PrimaryButton label={LER_TEXT.retry} onPress={retry} variant="outline" />
            </>
          ) : null}
          <ManualLink onPress={manual} />
        </View>
      </View>
    </Screen>
  );
}
