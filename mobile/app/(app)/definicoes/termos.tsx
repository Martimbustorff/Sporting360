// Figma V7.1: ficheiro R3IhhyNxNZuVINgUtJjZE3, nó 4941:7444 (17 Termos e condições). Aberto das Definições ("Termos e privacidade").
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TermsView } from '@/components/TermsView';

export default function Termos() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/definicoes'));
  return (
    <Screen padded="none">
      <Header title="Termos e condições" onBack={back} />
      <TermsView />
    </Screen>
  );
}
