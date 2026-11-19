// Figma V7.1 25 Notificações (4942:7895): dois ToggleRow M (52) a 26 do Header, nota Caption 12 text-subtle e, com a
// permissão do telemóvel recusada, caixa surface-06 com o aviso e "Abrir definições" em Contorno. Só com tokens.
// Task 22: guarda as preferências em users/{uid}.notificationPrefs. Cada interruptor grava o objeto completo. Sem
// preferências guardadas, tudo ligado. Leitura falhada: erro, nunca valores por omissão.
// Push só para ações na app (2026-11-19): lembrete de prognóstico e abertura do MVP. As chaves antigas
// (matchStart, goals, news) ficam no documento, sem interruptor e sem efeito.
// Plano 6: o PushSetup segue o documento e acerta os tópicos; este ecrã não chama o push. Com a permissão do
// telemóvel recusada, um aviso e o botão para as definições (frame 25).
import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { useMyUser } from '@/data/hooks';
import type { NotificationPrefs } from '@/data/schemas';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/profileFields';
import { useSession } from '@/providers/SessionProvider';
import { pushPermissionGranted } from '@/services/push';
import { ProfileSaveError, updateMyProfileFields } from '@/services/userProfile';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const NOTIFICACOES_TEXT = {
  loadError: 'Não foi possível carregar as tuas preferências.',
  notice: 'Escolhe o que queres receber neste telemóvel enquanto tiveres sessão iniciada.',
  permissionOff: 'As notificações estão desligadas nas definições do telemóvel.',
  openSettings: 'Abrir definições',
  OFFLINE: 'Sem ligação. A tua escolha fica guardada e é enviada quando houver ligação.',
  DENIED: 'Não tens permissão para guardar esta escolha.',
  UNKNOWN: 'Não foi possível guardar a escolha. Tenta outra vez.',
} as const;

const ROWS: { key: keyof NotificationPrefs; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'predictionReminder', label: 'Lembrete de prognóstico', icon: 'clock' },
  { key: 'mvpOpen', label: 'Abertura do MVP', icon: 'award' },
];

export default function Notificacoes() {
  const router = useRouter();
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const user = useMyUser(uid);
  const stored = user.status === 'ready' ? user.data.notificationPrefs : undefined;
  const fromDoc: NotificationPrefs = stored ?? DEFAULT_NOTIFICATION_PREFS;
  const docKey = JSON.stringify(fromDoc);
  // Valor mostrado: o último escolhido localmente até o documento o confirmar (ou mudar).
  const [local, setLocal] = useState<NotificationPrefs | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latest = useRef<NotificationPrefs>(fromDoc);
  // Escritas por confirmar: enquanto houver alguma, um documento novo não apaga as escolhas ainda pendentes.
  const inFlight = useRef(0);
  useEffect(() => {
    if (inFlight.current > 0) return;
    setLocal(null);
    latest.current = fromDoc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);
  const prefs = local ?? fromDoc;

  // Permissão do sistema: verificada ao abrir e sempre que a app volta ao primeiro plano (ex.: das definições).
  const [permission, setPermission] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => {
      pushPermissionGranted().then((g) => {
        if (alive) setPermission(g);
      });
    };
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const toggle = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!uid) return;
    const previous = latest.current[key];
    const next: NotificationPrefs = { ...latest.current, [key]: value };
    latest.current = next;
    setLocal(next);
    setMessage(null);
    inFlight.current += 1;
    try {
      await updateMyProfileFields(uid, { notificationPrefs: next });
    } catch (e) {
      const code = e instanceof ProfileSaveError ? e.saveCode : 'UNKNOWN';
      // Sem rede a escrita fica na fila local e segue com a ligação: o interruptor mantém-se. Outros erros desfazem
      // só esta escolha (e só se não foi mudada depois), para não apagar toques mais recentes.
      if (code !== 'OFFLINE' && latest.current[key] === value) {
        latest.current = { ...latest.current, [key]: previous };
        setLocal(latest.current);
      }
      setMessage(NOTIFICACOES_TEXT[code]);
    } finally {
      inFlight.current -= 1;
    }
  };

  return (
    <Screen padded="none">
      <Header title="Notificações" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {user.status === 'error' ? (
        <EmptyState icon="info" text={NOTIFICACOES_TEXT.loadError} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.s24, paddingTop: layout.editFieldsTop, paddingBottom: space.s24, gap: space.s16 }}
        >
          {user.status === 'loading' ? (
            <View testID="notificacoes-loading" style={{ minHeight: layout.skeletonRowHeight }} />
          ) : (
            <View>
              {ROWS.map((r) => (
                <ToggleRow
                  key={r.key}
                  size="M"
                  icon={<Feather name={r.icon} size={layout.menuRowIcon} color={colors.white} />}
                  label={r.label}
                  value={prefs[r.key]}
                  onChange={(v) => void toggle(r.key, v)}
                />
              ))}
            </View>
          )}
          {message ? (
            <Text71 variant="body14" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {message}
            </Text71>
          ) : null}
          <Text71 variant="caption12" color="textSubtle">{NOTIFICACOES_TEXT.notice}</Text71>
          {permission === false ? (
            <View
              style={{
                gap: space.s12,
                paddingHorizontal: space.s16,
                paddingVertical: layout.statTilePadY,
                borderRadius: radii.r12,
                backgroundColor: colors.surface06,
              }}
            >
              <Text71 variant="body14">{NOTIFICACOES_TEXT.permissionOff}</Text71>
              <PrimaryButton
                variant="outline"
                label={NOTIFICACOES_TEXT.openSettings}
                onPress={() => void Linking.openSettings().catch(() => undefined)}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
