// Figma: nó 323:11630 (Definições: fundo "image 2" desfocado 323:11631 com a tinta 323:11632, lista a 128 com linhas
// ícone 24 + gap 16 + etiqueta DIN 18 maiúsculas + seta, separadas por linha; "Notificações" com interruptor 323:11790;
// "Log Out" 323:11666 em corpo semibold 12 primary ao centro, em baixo). Linhas com MenuRow e ToggleRow; ícones
// User_03 323:11823, Qr_Code 309:9328, Lock 348:37930 e Bell 302:4152 exportados do frame.
// Diferenças ao frame (Plano 4, Task 26): "Definir Passcode" passa a "Desbloquear com {label}" (interruptor, com o ícone
// do cadeado); "Notificações" abre as preferências (/perfil/notificacoes) em vez de um interruptor só.
// SEM FIGMA: "Análise de utilização", "Ligar conta Apple", "Termos e privacidade" (mesmas linhas, ícones Feather/Ionicons),
// "Ligar conta Apple" é só a sugestão nas definições (HIG): abre /ligar-apple, onde está o botão oficial da Apple. Sem
// logótipo da Apple na linha (ícone de ligação do sistema).
// "Apagar conta" e a versão (mesmo estilo do "Log Out"), a explicação sem biometria e as mensagens.
// O email nunca aparece aqui (só em Conta).
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { FormMessage } from '@/components/AuthForm';
import { Header } from '@/components/Header';
import { LionBackdrop } from '@/components/LionBackdrop';
import { MenuRow } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { useBiometricControl } from '@/providers/BiometricGate';
import { useSession } from '@/providers/SessionProvider';
import { getAnalyticsConsent, setAnalyticsConsent } from '@/services/analytics';
import { signOut } from '@/services/auth';
import { Body } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
const ICONS = {
  conta: require('../../../assets/icons/user.svg'), // 323:11823 User / User_03
  gamebox: require('../../../assets/icons/qr-code.svg'), // 309:9328 System / Qr_Code
  lock: require('../../../assets/icons/lock.svg'), // 348:37930 Interface / Lock
  bell: require('../../../assets/icons/bell.svg'), // 302:4152 Communication / Bell
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const DEFINICOES_TEXT = {
  noBiometric: (label: string) => `Sem ${label} configurado neste telemóvel.`,
  saveError: 'Não foi possível guardar a escolha. Tenta outra vez.',
  signOutTitle: 'Terminar sessão?',
  signOutBody: 'Para voltar a usar a S360 tens de entrar outra vez.',
  signOutError: 'Não foi possível terminar a sessão. Tenta outra vez.',
} as const;

type Message = { text: string; tone: 'error' | 'info' };

const iconStyle = { width: layout.menuRowIcon, height: layout.menuRowIcon };
const svg = (source: number) => <Image source={source} style={iconStyle} accessible={false} />;

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => ({ minHeight: layout.minTouch, justifyContent: 'center', opacity: pressed ? layout.pressedOpacity : 1 })}
    >
      <Body variant="badgeSmall" style={{ color: colors.primary, textAlign: 'center' }}>{label}</Body>
    </Pressable>
  );
}

export default function Definicoes() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = useSession();
  const providers = session.status === 'signedIn' ? session.user.providers : [];
  const bio = useBiometricControl();
  const [analytics, setAnalytics] = useState<boolean | null>(null);
  const [bioMessage, setBioMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const bioBusy = useRef(false);

  useEffect(() => {
    let alive = true;
    getAnalyticsConsent().then((c) => alive && setAnalytics(c === 'granted'), () => alive && setAnalytics(false));
    return () => {
      alive = false;
    };
  }, []);

  const bioUnavailable = bio.status === 'notEnrolled' || bio.status === 'noHardware';
  const showApple = Platform.OS === 'ios' && !providers.includes('apple.com');
  const version = Application.nativeApplicationVersion;

  const toggleBiometric = async (on: boolean) => {
    if (bioBusy.current) return;
    bioBusy.current = true;
    setBioMessage(null);
    try {
      const r = await bio.setEnabled(on);
      if (r === 'notEnrolled') setBioMessage(DEFINICOES_TEXT.noBiometric(bio.label));
    } catch {
      setBioMessage(DEFINICOES_TEXT.saveError);
    } finally {
      bioBusy.current = false;
    }
  };

  // A escolha mostra-se já; se não ficar guardada, avisa e volta ao valor guardado. Recusar fica sempre desligado
  // (o serviço mantém a recolha desligada nesta sessão e limpa o uid mesmo quando falha a guardar).
  const toggleAnalytics = async (on: boolean) => {
    setAnalytics(on);
    setMessage(null);
    try {
      await setAnalyticsConsent(on ? 'granted' : 'denied');
    } catch {
      const stored = on ? await getAnalyticsConsent().catch(() => null) : null;
      setAnalytics(stored === 'granted');
      setMessage({ text: DEFINICOES_TEXT.saveError, tone: 'error' });
    }
  };

  const doSignOut = async () => {
    setMessage(null);
    try {
      await signOut();
    } catch {
      setMessage({ text: DEFINICOES_TEXT.signOutError, tone: 'error' });
    }
  };

  const confirmSignOut = () =>
    Alert.alert(DEFINICOES_TEXT.signOutTitle, DEFINICOES_TEXT.signOutBody, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Terminar sessão', style: 'destructive', onPress: () => void doSignOut() },
    ]);

  const bioNote = bioUnavailable ? DEFINICOES_TEXT.noBiometric(bio.label) : bioMessage;

  return (
    <Screen padded="none">
      <LionBackdrop blurred />
      <Header title="Definições" onBack={back} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.screenXWide,
          paddingTop: layout.settingsListTop,
          paddingBottom: layout.settingsFooterBottom,
        }}
      >
        <View style={{ gap: layout.settingsRowGap }}>
          <MenuRow label="Conta S360" icon={svg(ICONS.conta)} onPress={() => router.push('/definicoes/conta')} />
          <MenuRow label="Gestão de GameBox" icon={svg(ICONS.gamebox)} onPress={() => router.push('/gamebox')} />
          <View style={{ gap: spacing.sm }}>
            <ToggleRow
              icon={svg(ICONS.lock)}
              label={`Desbloquear com ${bio.label}`}
              value={bio.enabled}
              disabled={bioUnavailable}
              onChange={(v) => void toggleBiometric(v)}
            />
            {bioNote ? (
              <Body variant="body" accessibilityLiveRegion="polite" style={{ color: bioMessage && !bioUnavailable ? colors.cardRed : colors.textMuted }}>
                {bioNote}
              </Body>
            ) : null}
          </View>
          <MenuRow label="Notificações" icon={svg(ICONS.bell)} onPress={() => router.push('/perfil/notificacoes')} />
          <ToggleRow
            icon={<Feather name="bar-chart-2" size={layout.menuRowIcon} color={colors.white} />}
            label="Análise de utilização"
            value={analytics === true}
            disabled={analytics === null}
            onChange={(v) => void toggleAnalytics(v)}
          />
          {showApple ? (
            <MenuRow
              label="Ligar conta Apple"
              icon={<Ionicons name="link" size={layout.menuRowIcon} color={colors.white} />}
              onPress={() => router.push('/ligar-apple')}
            />
          ) : null}
          <MenuRow
            label="Termos e privacidade"
            icon={<Feather name="file-text" size={layout.menuRowIcon} color={colors.white} />}
            onPress={() => router.push('/definicoes/termos')}
          />
          {message ? <FormMessage text={message.text} tone={message.tone} /> : null}
        </View>
        <View style={{ marginTop: 'auto', paddingTop: layout.settingsRowGap, gap: layout.settingsFooterGap, alignItems: 'center' }}>
          <FooterLink label="Terminar sessão" onPress={confirmSignOut} />
          <FooterLink label="Apagar conta" onPress={() => router.push('/apagar-conta')} />
          {version ? (
            <Body variant="badgeSmall" style={{ color: colors.textMuted }}>{`Versão ${version}`}</Body>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
