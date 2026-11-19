// Figma V7.1: 02 Definições 4922:5841 (alerta 49 4953:9504 = Alert.alert do sistema, copy igual). Sem fundo de leão:
// cartão da conta (surface-06, borda surface-10, raio 12) + três secções (CONTA, PRIVACIDADE E SEGURANÇA, SESSÃO)
// com Eyebrow 13 e linhas M 52; "Apagar conta" em danger; rodapé centrado com a versão.
// Diferenças ao frame: "Termos e privacidade" mostra a seta externa mas continua a abrir /definicoes/termos (página
// dentro da app); "Ligar conta Apple" só aparece em iOS sem conta ligada (frame mostra o caso ligado a nada).
// SEM FIGMA (copy mantida): "Análise de utilização", explicação sem biometria, mensagens de erro, "Ligar conta Apple".
// O email nunca aparece aqui (só em Conta).
import Feather from '@expo/vector-icons/Feather';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { FormMessage } from '@/components/AuthForm';
import { Header } from '@/components/Header';
import { MenuRow } from '@/components/MenuRow';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { useMyUser } from '@/data/hooks';
import { initialOf } from '@/lib/initialOf';
import { useBiometricControl } from '@/providers/BiometricGate';
import { useSession } from '@/providers/SessionProvider';
import { getAnalyticsConsent, setAnalyticsConsent } from '@/services/analytics';
import { signOut } from '@/services/auth';
import { publicName } from '@/lib/publicName';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';
import { Touchable } from '@/components/Touchable';

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
const feather = (name: React.ComponentProps<typeof Feather>['name'], color: keyof typeof colors = 'white') => (
  <Feather name={name} size={layout.menuRowIcon} color={colors[color]} accessibilityElementsHidden importantForAccessibility="no" />
);

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.s4 }}>
      <Text71 variant="eyebrow13" color="textSubtle" accessibilityRole="header">{label}</Text71>
      <View>{children}</View>
    </View>
  );
}

function AccountCard({ name, since, onPress }: { name: string; since: string; onPress: () => void }) {
  return (
    <Touchable
      testID="conta-card"
      accessibilityRole="button"
      accessibilityLabel={`Conta S360. ${name}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s16,
        paddingLeft: layout.settingsCardPadLeft,
        paddingRight: layout.settingsCardPadRight,
        paddingVertical: space.s16,
        backgroundColor: colors.surface06,
        borderWidth: layout.separator,
        borderColor: colors.surface10,
        borderRadius: radii.r12,
      }}
    >
      <View
        style={{
          width: layout.settingsCardAvatar,
          height: layout.settingsCardAvatar,
          borderRadius: layout.settingsCardAvatar / 2,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text71 variant="titleS20" testID="conta-card-initial">{name ? initialOf(name) : ''}</Text71>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: layout.settingsCardGap }}>
        <Text71 variant="titleS20" numberOfLines={1} ellipsizeMode="tail" testID="conta-card-name">{name || 'Conta S360'}</Text71>
        <Text71 variant="caption12" color="textMuted" numberOfLines={1}>{since}</Text71>
      </View>
      {feather('arrow-right')}
    </Touchable>
  );
}

export default function Definicoes() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = useSession();
  const providers = session.status === 'signedIn' ? session.user.providers : [];
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const user = useMyUser(uid);
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
  const build = Application.nativeBuildVersion;

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

  const u = user.status === 'ready' ? user.data : null;
  const fullName = u ? (u.name ?? u.displayName ?? '').trim() || (uid ? publicName({ displayName: u.displayName ?? null, name: u.name ?? null }, uid) : '') : '';
  const since = u?.partnerNumber != null && String(u.partnerNumber).trim() !== '' ? `Conta S360 · sócio desde ${String(u.partnerNumber).trim()}` : 'Conta S360';

  return (
    <Screen padded="none">
      <Header title="Definições" onBack={back} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space.s24,
          paddingTop: space.s8,
          paddingBottom: layout.settingsFooterBottom,
          gap: space.s24,
        }}
      >
        <AccountCard name={fullName} since={since} onPress={() => router.push('/definicoes/conta')} />
        <Section label="CONTA">
          <MenuRow size="M" label="Gestão de GameBox" icon={svg(ICONS.gamebox)} onPress={() => router.push('/gamebox')} />
          {showApple ? (
            <MenuRow size="M" label="Ligar conta Apple" icon={feather('link')} onPress={() => router.push('/ligar-apple')} />
          ) : null}
        </Section>
        <Section label="PRIVACIDADE E SEGURANÇA">
          <ToggleRow
            size="M"
            icon={svg(ICONS.lock)}
            label={`Desbloquear com ${bio.label}`}
            value={bio.enabled}
            disabled={bioUnavailable}
            onChange={(v) => void toggleBiometric(v)}
          />
          {bioNote ? (
            <Text71 variant="body14" accessibilityLiveRegion="polite" color={bioMessage && !bioUnavailable ? 'danger' : 'textMuted'} style={{ paddingVertical: space.s8 }}>
              {bioNote}
            </Text71>
          ) : null}
          <ToggleRow
            size="M"
            icon={feather('bar-chart-2')}
            label="Análise de utilização"
            value={analytics === true}
            disabled={analytics === null}
            onChange={(v) => void toggleAnalytics(v)}
          />
          <MenuRow size="M" label="Notificações" icon={svg(ICONS.bell)} onPress={() => router.push('/perfil/notificacoes')} />
          <MenuRow size="M" label="Termos e privacidade" icon={feather('file-text')} trailing="external" onPress={() => router.push('/definicoes/termos')} />
        </Section>
        <Section label="SESSÃO">
          <MenuRow size="M" label="Terminar sessão" icon={feather('log-out')} trailing="none" onPress={confirmSignOut} />
          <MenuRow size="M" label="Apagar conta" tone="danger" icon={feather('trash-2', 'danger')} trailing="none" separator={false} onPress={() => router.push('/apagar-conta')} />
        </Section>
        {message ? <FormMessage text={message.text} tone={message.tone} /> : null}
        <View style={{ marginTop: 'auto', alignItems: 'center', gap: layout.settingsFooterGap }}>
          <Text71 variant="eyebrow13" color="textSubtle">{version ? `S360 · Versão ${version}${build ? ` (${build})` : ''}` : 'S360'}</Text71>
          <Text71 variant="caption12" color="textSubtle">App de adeptos, não oficial.</Text71>
        </View>
      </ScrollView>
    </Screen>
  );
}
