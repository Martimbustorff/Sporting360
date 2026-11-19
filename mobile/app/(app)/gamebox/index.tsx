// Figma: 323:12992 (Gestão de Gamebox: linhas com Menu_Duo 24, nome DIN 18, seta direita, separador; "+" branco 60 px
// em baixo à direita). Linhas com MenuRow (564:7096), ícones menu-duo.svg e fab-plus.svg descarregados do nó.
// SEM FIGMA: esqueleto, erro, vazio, aviso de cache e o bloco "Principal" (GameBox antiga que a V2 guardava só em
// users/{uid}.gameboxNumber): etiqueta e número como os campos de 327:15134, botão PrimaryButton.
// Task 23: lista as GameBox do utilizador (gamebox, por `order`). Sem documentos e com número no perfil da V2,
// mostra-o como "Principal" e oferece copiá-lo para a coleção no formato da V2. users/{uid} nunca se altera.
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScrollView, Text, View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { MenuRow } from '@/components/MenuRow';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useMyUser } from '@/data/hooks';
import { useMyGameboxes } from '@/data/user';
import { gameboxLabel, resolveGameboxList, type GameboxInput } from '@/lib/gamebox';
import { useSession } from '@/providers/SessionProvider';
import { GameboxSaveError, saveGamebox } from '@/services/gamebox';
import { colors, layout, spacing, type } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MENU_DUO = require('../../../assets/icons/menu-duo.svg');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FAB_PLUS = require('../../../assets/icons/fab-plus.svg');

export const GAMEBOX_TEXT = {
  title: 'Gestão de Gamebox',
  loadError: 'Não foi possível carregar as tuas GameBox.',
  empty: 'Ainda não tens nenhuma GameBox. Toca em + para adicionar.',
  add: 'Adicionar Gamebox',
  legacyHint: 'Esta GameBox está guardada no teu perfil da versão anterior.',
  legacySave: 'Guardar na minha GameBox',
  OFFLINE: 'Sem ligação. A GameBox não foi confirmada; tenta outra vez quando houver rede.',
  DENIED: 'Não tens permissão para guardar esta GameBox.',
  INVALID: 'O número da GameBox não é válido.',
  UNKNOWN: 'Não foi possível guardar. Tenta outra vez.',
} as const;

function LegacyPrincipal({ uid, legacy }: { uid: string; legacy: GameboxInput }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  // Repetir depois do tempo limite sem rede substitui a escrita pendente no mesmo documento (setDoc, não duplica);
  // outro erro larga o id.
  const pending = useRef<string | undefined>(undefined);
  const copy = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setMessage(null);
    try {
      await saveGamebox(uid, legacy, undefined, 1, pending.current);
      // A lista passa a ter o documento e este bloco desaparece sozinho.
    } catch (e) {
      const err = e instanceof GameboxSaveError ? e : null;
      pending.current = err?.id;
      setMessage(GAMEBOX_TEXT[err?.saveCode as keyof typeof GAMEBOX_TEXT] ?? GAMEBOX_TEXT.UNKNOWN);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return (
    <View style={{ gap: layout.gameboxFieldsGap }}>
      <View style={{ gap: spacing.sm }}>
        <Text style={type.menuRow}>{legacy.name}</Text>
        <Text style={type.fieldValue}>{legacy.number}</Text>
        <Text style={[type.body, { color: colors.textMuted }]}>{GAMEBOX_TEXT.legacyHint}</Text>
      </View>
      {message ? <FormMessage text={message} /> : null}
      <PrimaryButton label={GAMEBOX_TEXT.legacySave} onPress={() => void copy()} loading={loading} />
    </View>
  );
}

export default function Gamebox() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const boxes = useMyGameboxes(uid);
  const user = useMyUser(uid);

  const state = resolveGameboxList(boxes, user, uid);

  let body;
  if (state.status === 'error') {
    body = <EmptyState icon="info" text={GAMEBOX_TEXT.loadError} />;
  } else if (state.status === 'loading' || !uid) {
    // Sem documentos espera-se pelo perfil (pode ter a GameBox antiga) antes de mostrar o vazio.
    body = <View testID="gamebox-loading" style={{ minHeight: layout.skeletonRowHeight }} />;
  } else {
    const { list, legacy } = state;
    body = (
      <>
        <OfflineBanner visible={state.fromCache} />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.screenXWide,
            paddingTop: spacing.xl,
            paddingBottom: layout.gameboxFab + layout.gameboxFabBottom + spacing.md,
            gap: layout.gameboxListGap,
          }}
        >
          {list.map((g, i) => (
            <MenuRow
              key={g.id}
              icon={<Image source={MENU_DUO} style={{ width: layout.menuRowIcon, height: layout.menuRowIcon }} accessible={false} />}
              label={gameboxLabel(g.gameboxName, i)}
              onPress={() => router.push(`/gamebox/${g.id}`)}
            />
          ))}
          {legacy ? <LegacyPrincipal uid={uid} legacy={legacy} /> : null}
          {list.length === 0 && !legacy ? <EmptyState icon="info" text={GAMEBOX_TEXT.empty} /> : null}
        </ScrollView>
      </>
    );
  }

  return (
    <Screen padded="none">
      <Header title={GAMEBOX_TEXT.title} onBack={back} />
      {body}
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={GAMEBOX_TEXT.add}
        onPress={() => router.push('/gamebox/nova')}
        style={{
          position: 'absolute',
          right: layout.gameboxFabRight,
          bottom: layout.gameboxFabBottom,
        }}
      >
        <Image source={FAB_PLUS} style={{ width: layout.gameboxFab, height: layout.gameboxFab }} accessible={false} />
      </Touchable>
    </Screen>
  );
}
