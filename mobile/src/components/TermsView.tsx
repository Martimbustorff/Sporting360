// Figma: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 564:7164 (Terms; corpo 564:7169, token termsBody, 315 px de largura).
// O Figma só tem lorem ipsum num bloco; o texto vem de src/content/termos.ts. Títulos de secção SEM FIGMA
// (token termsTitle). Usado em /termos (registo) e em /definicoes/termos; o Header fica no ecrã.
import { ScrollView, Text, View } from 'react-native';
import { TERMS } from '@/content/termos';
import { layout, spacing, type } from '@/theme/tokens';

export function TermsView() {
  return (
    <ScrollView
      testID="terms"
      contentContainerStyle={{
        paddingHorizontal: spacing.authX,
        paddingTop: layout.termsTop,
        paddingBottom: layout.homeIndicator,
        gap: layout.termsSectionGap,
      }}
    >
      {TERMS.map((s, i) => (
        <View key={`${i}-${s.title}`}>
          <Text style={type.termsTitle} accessibilityRole="header">
            {s.title}
          </Text>
          {s.body ? <Text style={type.termsBody}>{s.body}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}
