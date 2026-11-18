// Figma: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 564:7164 (Terms, "Termos e CondiçÕes"). Conteúdo em TermsView.
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TermsView } from '@/components/TermsView';

export default function Termos() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));
  return (
    <Screen padded="none">
      <Header title="Termos e condições" onBack={back} />
      <TermsView />
    </Screen>
  );
}
