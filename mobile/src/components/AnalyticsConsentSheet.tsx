// Figma V7.1: 05 Consentimento 4923:6173. Cortina (scrimV71) e folha branca (raio superior 28, pega a 18%): círculo primary 48 com
// ícone, título Title 24 ink, texto Body 14, três pontos com visto, botões "Agora não" (escuro) e "Aceitar" (primary) lado a
// lado, ligação "Ler a política de privacidade" e 42 em baixo. Ícone do círculo: Feather bar-chart-2 (o frame usa um vetor próprio).
// A folha não se fecha sem escolha (sem gesto nem toque na cortina). A ligação abre /definicoes/termos (onPrivacy); o layout
// esconde a folha enquanto essa página está aberta. Comportamento (setAnalyticsConsent, onDone) igual ao anterior.
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Touchable } from '@/components/Touchable';
import { type Consent, setAnalyticsConsent } from '@/services/analytics';
import { colors, layout, radii, space } from '@/theme/tokens';
import { Text71 } from '@/theme/typography';

/* eslint-disable @typescript-eslint/no-require-imports */
const CHECK = require('../../assets/icons/check-big.svg');
/* eslint-enable @typescript-eslint/no-require-imports */

export const CONSENT_TITLE = 'AJUDA A MELHORAR A S360';
export const CONSENT_TEXT =
  'Gostávamos de saber que ecrãs e funcionalidades usas, para decidir o que melhorar a seguir. Para isso usamos o Google Analytics para Firebase.';
export const CONSENT_POINTS = [
  'Só dados de utilização, sem te identificar.',
  'Nunca o teu nome, email ou número de sócio.',
  'Podes mudar de ideias a qualquer momento nas Definições.',
] as const;
export const CONSENT_POLICY = 'Ler a política de privacidade';

export function AnalyticsConsentSheet({ onDone, onPrivacy }: { onDone: () => void; onPrivacy?: () => void }) {
  const { bottom } = useSafeAreaInsets();
  const choose = async (c: Consent) => {
    try {
      await setAnalyticsConsent(c);
    } catch {
      // a escolha não pode prender o utilizador na folha
    }
    onDone();
  };

  return (
    <View testID="consent-overlay" accessibilityViewIsModal style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end', backgroundColor: colors.scrimV71 }}>
      <View
        style={{
          backgroundColor: colors.white,
          borderTopLeftRadius: radii.r28,
          borderTopRightRadius: radii.r28,
          paddingTop: layout.consentPadTop,
          paddingHorizontal: space.s24,
          paddingBottom: Math.max(bottom, layout.homeIndicator) + layout.consentBottomExtra,
          alignItems: 'stretch',
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: layout.grabberWidth,
            height: layout.grabberHeight,
            borderRadius: layout.grabberHeight / 2,
            backgroundColor: colors.ink,
            opacity: layout.grabberOpacity,
          }}
        />
        <View style={{ marginTop: layout.consentContentTop, gap: space.s16 }}>
          <View
            style={{
              width: layout.consentIcon,
              height: layout.consentIcon,
              borderRadius: layout.consentIcon / 2,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="bar-chart-2" size={space.s24} color={colors.white} accessibilityElementsHidden importantForAccessibility="no" />
          </View>
          <Text71 variant="title24" color="ink" accessibilityRole="header">{CONSENT_TITLE}</Text71>
          <Text71 variant="body14" color="inkMuted">{CONSENT_TEXT}</Text71>
          <View style={{ gap: layout.consentItemGap }}>
            {CONSENT_POINTS.map((p) => (
              <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s12 }}>
                <View
                  style={{
                    width: layout.consentCheck,
                    height: layout.consentCheck,
                    borderRadius: layout.consentCheck / 2,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image source={CHECK} style={{ width: layout.consentCheck - space.s8, height: layout.consentCheck - space.s8 }} accessible={false} />
                </View>
                <Text71 variant="body14" color="ink" style={{ flex: 1 }}>{p}</Text71>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: space.s12 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton variant="dark" label="Agora não" onPress={() => choose('denied')} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Aceitar" onPress={() => choose('granted')} />
            </View>
          </View>
          {onPrivacy ? (
            <Touchable
              accessibilityRole="link"
              accessibilityLabel={CONSENT_POLICY}
              onPress={onPrivacy}
              style={{ minHeight: layout.minTouch, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text71 variant="captionStrong12" color="primary" style={{ textDecorationLine: 'underline' }}>{CONSENT_POLICY}</Text71>
            </Touchable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
