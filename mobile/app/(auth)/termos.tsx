// Figma: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 564:7164 (Terms, "Termos e CondiçÕes"). O Figma tem lorem ipsum;
// o texto vem da V2 (src/content/termos.ts). Títulos de secção SEM FIGMA (corpo em semibold, token termsTitle).
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TERMS } from '@/content/termos';
import { layout, spacing, type } from '@/theme/tokens';

export default function Termos() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));
  return (
    <Screen padded="none">
      <Header title="Termos e condições" onBack={back} />
      <ScrollView
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
    </Screen>
  );
}
