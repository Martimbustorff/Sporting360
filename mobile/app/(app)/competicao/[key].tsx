// SEM FIGMA: esqueleto de rota (Task 5), substituído na Task 13. Compõe Screen, Header e EmptyState.
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';

export default function Competicao() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen padded="none">
      <Header title="Competição" onBack={back} />
      <EmptyState icon="info" text="Em breve." />
    </Screen>
  );
}
