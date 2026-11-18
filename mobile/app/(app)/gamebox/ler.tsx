// SEM FIGMA: leitor do código da GameBox (o Mapa do Figma não tem frame do leitor). Compõe Screen, Header, a câmara em
// ecrã inteiro com uma moldura de mira, e por baixo uma folha `colors.bg` com o raio da folha GameBox (radius.sheet, 564:6981; escura porque o
// PrimaryButton é branco) para "Número lido", Confirmar (PrimaryButton) e Corrigir. Sem acesso à câmara: EmptyState e "Abrir definições".
// Task 24: aceita só o formato do cartão (6 a 20 algarismos, lib/gamebox). Depois da primeira leitura válida a câmara
// deixa de ler até "Corrigir". Confirmar: `/gamebox/{from}?numero=n` (from por omissão `nova`, preflight F12).
// O número lido nunca vai para logs.
import { useEffect, useRef, useState } from 'react';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { normalizeGameboxNumber } from '@/lib/gamebox';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';

export const LER_TEXT = {
  title: 'Ler GameBox',
  hint: 'Aponta a câmara para o código da tua GameBox.',
  unknown: 'Código não reconhecido.',
  read: 'Número lido:',
  confirm: 'Confirmar',
  retry: 'Corrigir',
  manual: 'Inserir manualmente',
  denied: 'Sem acesso à câmara.',
  deniedHint: 'Para ler o código da GameBox, dá acesso à câmara nas definições do telemóvel, ou insere o número à mão.',
  settings: 'Abrir definições',
} as const;

const BARCODE_TYPES = ['qr', 'code128', 'ean13', 'pdf417'] as const;
const single = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

function ManualLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LER_TEXT.manual}
      onPress={onPress}
      hitSlop={12}
      style={{ minHeight: layout.minTouch, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={type.authLinkAction}>{LER_TEXT.manual}</Text>
    </Pressable>
  );
}

export default function GameboxLer() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const from = single(params.from);
  const [permission, requestPermission] = useCameraPermissions();
  const { bottom } = useSafeAreaInsets();
  const [scanned, setScanned] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);
  // A câmara pode entregar várias leituras antes de o estado mudar: o ref fecha logo à primeira válida.
  const locked = useRef(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain || asked.current) return;
    asked.current = true;
    void requestPermission();
  }, [permission, requestPermission]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const manual = () => (from ? back() : router.replace('/gamebox/nova'));

  const onScan = ({ data }: BarcodeScanningResult) => {
    if (locked.current) return;
    const n = normalizeGameboxNumber(data ?? '');
    if (!n) {
      setUnknown(true);
      return;
    }
    locked.current = true;
    setUnknown(false);
    setScanned(n);
  };
  const retry = () => {
    locked.current = false;
    setScanned(null);
  };
  const confirm = () => {
    if (scanned) router.replace(`/gamebox/${from ?? 'nova'}?numero=${scanned}`);
  };

  if (!permission) {
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
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.screenXWide, gap: spacing.lg }}>
          <EmptyState icon="info" text={LER_TEXT.denied} />
          <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{LER_TEXT.deniedHint}</Text>
          <PrimaryButton label={LER_TEXT.settings} onPress={() => void Linking.openSettings()} />
          <ManualLink onPress={manual} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded="none" edges={['left', 'right']}>
      <Header title={LER_TEXT.title} onBack={back} />
      <View style={{ flex: 1 }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={scanned ? undefined : onScan}
        />
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <View
            style={{
              width: layout.scannerFrame,
              height: layout.scannerFrame,
              borderWidth: layout.scannerFrameBorder,
              borderColor: scanned ? colors.primary : colors.white,
              borderRadius: radius.pill,
            }}
          />
          <View style={{ backgroundColor: colors.scrim, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
            <Text
              accessibilityRole={unknown && !scanned ? 'alert' : undefined}
              accessibilityLiveRegion="polite"
              style={[type.body, { textAlign: 'center' }, unknown && !scanned ? { color: colors.cardRed } : null]}
            >
              {unknown && !scanned ? LER_TEXT.unknown : LER_TEXT.hint}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingHorizontal: layout.scannerPad,
            paddingTop: layout.scannerPad,
            paddingBottom: layout.scannerPad + Math.max(bottom, layout.homeIndicator),
            gap: spacing.md,
          }}
        >
          {scanned ? (
            <>
              <Text accessibilityLiveRegion="polite" style={[type.fieldValue, { textAlign: 'center' }]}>
                {`${LER_TEXT.read} ${scanned}`}
              </Text>
              <PrimaryButton label={LER_TEXT.confirm} onPress={confirm} />
              <PrimaryButton label={LER_TEXT.retry} variant="secondary" onPress={retry} />
            </>
          ) : null}
          <ManualLink onPress={manual} />
        </View>
      </View>
    </Screen>
  );
}
