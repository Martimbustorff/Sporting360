// Figma: nós 323:11630 / 323:11790 (linha "Notificações" com interruptor, via ToggleRow). SEM FIGMA: a lista de cinco
// interruptores e o aviso por baixo não estão desenhados; compõe Header, ToggleRow e Body, só com tokens.
// Task 22: só guarda as preferências em users/{uid}.notificationPrefs (sem push nesta entrega). Cada interruptor grava o
// objeto completo. Sem preferências guardadas, tudo ligado. Leitura falhada: erro, nunca valores por omissão.
import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { useMyUser } from '@/data/hooks';
import type { NotificationPrefs } from '@/data/schemas';
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/profileFields';
import { useSession } from '@/providers/SessionProvider';
import { ProfileSaveError, updateMyProfileFields } from '@/services/userProfile';
import { Body } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

export const NOTIFICACOES_TEXT = {
  loadError: 'Não foi possível carregar as tuas preferências.',
  notice: 'As notificações chegam numa próxima versão. As tuas escolhas ficam guardadas.',
  OFFLINE: 'Sem ligação. A escolha fica neste telemóvel. As alterações vão ser enviadas quando houver ligação.',
  DENIED: 'Não tens permissão para guardar esta escolha.',
  UNKNOWN: 'Não foi possível guardar a escolha. Tenta outra vez.',
} as const;

const ROWS: { key: keyof NotificationPrefs; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'matchStart', label: 'Início dos jogos', icon: 'play-circle' },
  { key: 'goals', label: 'Golos', icon: 'target' },
  { key: 'predictionReminder', label: 'Lembrete de prognóstico', icon: 'edit-3' },
  { key: 'mvpOpen', label: 'Abertura do MVP', icon: 'award' },
  { key: 'news', label: 'Notícias', icon: 'file-text' },
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
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md }}>
          {user.status === 'loading' ? (
            <View testID="notificacoes-loading" style={{ minHeight: layout.skeletonRowHeight }} />
          ) : (
            <View>
              {ROWS.map((r) => (
                <ToggleRow
                  key={r.key}
                  icon={<Feather name={r.icon} size={layout.menuRowIcon} color={colors.white} />}
                  label={r.label}
                  value={prefs[r.key]}
                  onChange={(v) => void toggle(r.key, v)}
                />
              ))}
            </View>
          )}
          {message ? (
            <Body variant="body" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.cardRed }}>
              {message}
            </Body>
          ) : null}
          <Body variant="body" style={{ color: colors.textMuted }}>{NOTIFICACOES_TEXT.notice}</Body>
        </ScrollView>
      )}
    </Screen>
  );
}
