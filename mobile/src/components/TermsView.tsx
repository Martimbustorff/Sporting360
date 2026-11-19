// Figma V7.1: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 4941:7444 (17 Termos e condições). Títulos Label 16 primary-on-dark,
// corpo Body Light 14 branco, secções a 20 e título a 6 do corpo, 24 de margem. O texto vem de src/content/termos.ts.
// Usado em /termos (registo) e em /definicoes/termos; o Header fica no ecrã.
import { ScrollView, View } from 'react-native';
import { TERMS } from '@/content/termos';
import { Text71 } from '@/theme/typography';
import { layout, space } from '@/theme/tokens';

export function TermsView() {
  return (
    <ScrollView
      testID="terms"
      contentContainerStyle={{
        paddingHorizontal: space.s24,
        paddingTop: layout.termsTop,
        paddingBottom: layout.homeIndicator,
        gap: layout.termsSectionGap,
      }}
    >
      {TERMS.map((s, i) => (
        <View key={`${i}-${s.title}`} style={{ gap: layout.termsTitleGap }}>
          <Text71 variant="label16" color="primaryOnDark" accessibilityRole="header">
            {s.title}
          </Text71>
          {s.body ? <Text71 variant="bodyLight14">{s.body}</Text71> : null}
        </View>
      ))}
    </ScrollView>
  );
}
