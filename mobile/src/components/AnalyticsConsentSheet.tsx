// SEM FIGMA: composto com a `Sheet` (564:6981 / 564:7119) e os tokens; botões no estilo do PrimaryButton (564:7259)
// mas em verde, porque a folha é branca. A validar com o Martim.
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet } from '@/components/Sheet';
import { type Consent, setAnalyticsConsent } from '@/services/analytics';
import { colors, layout, radius, type } from '@/theme/tokens';

export const CONSENT_TITLE = 'AJUDA A MELHORAR A S360';
export const CONSENT_TEXT =
  'Podemos recolher dados de utilização (ecrãs vistos e funcionalidades usadas) com o Google Analytics para Firebase. Nunca o teu email nem o teu nome. Podes mudar isto nas Definições.';

export function AnalyticsConsentSheet({ onDone }: { onDone: () => void }) {
  const { bottom } = useSafeAreaInsets();
  const height = layout.consentSheetHeight + Math.max(bottom, layout.homeIndicator);

  const choose = async (c: Consent) => {
    try {
      await setAnalyticsConsent(c);
    } catch {
      // a escolha não pode prender o utilizador na folha
    }
    onDone();
  };

  return (
    <Sheet title={CONSENT_TITLE} collapsedHeight={height} expandedHeight={height} open toggleable={false} onOpenChange={() => {}}>
      <View style={{ flex: 1, gap: layout.consentGap, paddingTop: layout.consentGap }}>
        <Text style={[type.authIntro, { color: colors.black }]}>{CONSENT_TEXT}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Aceitar"
          onPress={() => choose('granted')}
          style={({ pressed }) => ({
            height: layout.buttonHeight,
            borderRadius: radius.button,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? layout.pressedOpacity : 1,
          })}
        >
          <Text style={[type.sheetTitleOpen, { color: colors.white }]}>Aceitar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agora não"
          onPress={() => choose('denied')}
          style={({ pressed }) => ({
            height: layout.buttonHeight,
            borderRadius: radius.button,
            borderWidth: layout.fieldLineWidthActive,
            borderColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? layout.pressedOpacity : 1,
          })}
        >
          <Text style={type.sheetTitleOpen}>Agora não</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
