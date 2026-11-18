// SEM FIGMA: ecrã não desenhado (o V2 tem os campos em definitions.tsx, sem frame). Compõe AuthScaffold (Header +
// rodapé acima do teclado), TextField (564:6907 / 564:6938), Tabs 'scroll' (500:28976), PrimaryButton e FormMessage,
// só com tokens.
// Task 22: campos privados do próprio (nunca públicos): Número de sócio (`memberNumber`), Sócio desde (`partnerNumber`,
// MM/AAAA), Lugar anual, Modalidade favorita e Jogador favorito (plantel). Grava só o que mudou, só chaves permitidas
// pelas regras (services/userProfile). O nome público tem o seu ecrã (/perfil/nome). O email não aparece aqui.
// Leitura falhada: erro, nunca o formulário vazio. Sem rede: mensagem clara e o formulário fica como está.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AuthScaffold, FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Tabs } from '@/components/Tabs';
import { TextField } from '@/components/TextField';
import { useMyUser } from '@/data/hooks';
import type { Sport } from '@/data/schemas';
import { useTeamData } from '@/data/sports';
import { diffForm, formFromUser, SEASON_SEAT_MAX, type ProfileForm } from '@/lib/profileFields';
import { SPORTS } from '@/lib/sports';
import { useSession } from '@/providers/SessionProvider';
import { ProfileSaveError, updateMyProfileFields } from '@/services/userProfile';
import { Body } from '@/theme/typography';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';

export const EDITAR_TEXT = {
  loadError: 'Não foi possível carregar o teu perfil.',
  squadError: 'Não foi possível carregar o plantel.',
  noSquad: 'O plantel ainda não está disponível.',
  saved: 'Perfil guardado.',
  OFFLINE: 'Sem ligação. As alterações não foram confirmadas; mantemos o que escreveste. Tenta outra vez quando houver rede.',
  DENIED: 'Não tens permissão para guardar estas alterações.',
  UNKNOWN: 'Não foi possível guardar. Tenta outra vez.',
} as const;

type Message = { text: string; tone: 'error' | 'info' };

function PlayerPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (p: { id: string; name: string }) => void;
}) {
  const squad = useTeamData('squad');
  if (squad.status === 'loading') return <View testID="squad-loading" style={{ minHeight: layout.skeletonRowHeight }} />;
  if (squad.status === 'error') return <Body variant="body" style={{ color: colors.cardRed }}>{EDITAR_TEXT.squadError}</Body>;
  const players = squad.status === 'ready' ? squad.data.players : [];
  if (players.length === 0) return <Body variant="body" style={{ color: colors.textMuted }}>{EDITAR_TEXT.noSquad}</Body>;
  return (
    <View accessibilityRole="radiogroup">
      {players.map((p) => {
        const selected = p.id === selectedId;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityLabel={p.name}
            accessibilityState={{ selected }}
            onPress={() => onSelect({ id: p.id, name: p.name })}
            style={({ pressed }) => ({
              minHeight: layout.minTouch,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: selected ? colors.surface20 : undefined,
              opacity: pressed ? layout.pressedOpacity : 1,
            })}
          >
            <Text style={[type.menuRow, { minWidth: spacing.xl }]}>{p.number ?? ''}</Text>
            <Text style={[type.fieldValue, { flexShrink: 1 }]} numberOfLines={1}>{p.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Form({ uid, initial }: { uid: string; initial: ProfileForm }) {
  const [base, setBase] = useState(initial);
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setMessage(null);
  };

  const { patch, errors } = useMemo(() => diffForm(base, form), [base, form]);
  const changed = Object.keys(patch).length > 0;
  const invalid = Object.keys(errors).length > 0;

  const submit = async () => {
    if (busy.current || !changed || invalid) return;
    busy.current = true;
    setLoading(true);
    setMessage(null);
    try {
      await updateMyProfileFields(uid, patch);
      setBase(form);
      setMessage({ text: EDITAR_TEXT.saved, tone: 'info' });
    } catch (e) {
      const code = e instanceof ProfileSaveError ? e.saveCode : 'UNKNOWN';
      setMessage({ text: EDITAR_TEXT[code], tone: 'error' });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Editar perfil"
      fallbackHref="/"
      footer={
        <>
          {message ? <FormMessage text={message.text} tone={message.tone} /> : null}
          <PrimaryButton label="Guardar" onPress={() => void submit()} loading={loading} disabled={!changed || invalid} />
        </>
      }
    >
      <TextField
        label="Número de sócio"
        value={form.memberNumber}
        onChangeText={(v) => set('memberNumber', v)}
        error={errors.memberNumber}
        keyboardType="number-pad"
      />
      <TextField
        label="Sócio desde (MM/AAAA)"
        value={form.partnerNumber}
        onChangeText={(v) => set('partnerNumber', v)}
        error={errors.partnerNumber}
        keyboardType="numbers-and-punctuation"
      />
      <TextField
        label="Lugar anual"
        value={form.seasonSeat}
        onChangeText={(v) => set('seasonSeat', v.slice(0, SEASON_SEAT_MAX))}
        error={errors.seasonSeat}
        autoCapitalize="characters"
      />
      <View style={{ gap: spacing.sm }}>
        <Text style={[type.fieldLabel, { opacity: layout.fieldLabelOpacity }]}>Modalidade favorita</Text>
        <Tabs<Sport | ''>
          mode="scroll"
          items={SPORTS.map((s) => ({ key: s.key, label: s.label }))}
          value={form.favoriteSport ?? ''}
          onChange={(k) => k !== '' && set('favoriteSport', k)}
        />
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text style={[type.fieldLabel, { opacity: layout.fieldLabelOpacity }]}>Jogador favorito</Text>
        <PlayerPicker selectedId={form.favoritePlayer?.id ?? null} onSelect={(p) => set('favoritePlayer', p)} />
      </View>
    </AuthScaffold>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <Screen padded="none">
      <Header title="Editar perfil" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {children}
    </Screen>
  );
}

export default function EditarPerfil() {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const user = useMyUser(uid);
  // O formulário parte do documento lido uma só vez: as atualizações em direto não apagam o que se está a escrever.
  const [initial, setInitial] = useState<ProfileForm | null>(null);
  useEffect(() => {
    if (initial === null && (user.status === 'ready' || user.status === 'missing')) {
      setInitial(formFromUser(user.status === 'ready' ? user.data : {}));
    }
  }, [user, initial]);

  if (user.status === 'error') {
    return (
      <Shell>
        <EmptyState icon="info" text={EDITAR_TEXT.loadError} />
      </Shell>
    );
  }
  if (!uid || initial === null) {
    return (
      <Shell>
        <View testID="editar-loading" style={{ minHeight: layout.skeletonRowHeight }} />
      </Shell>
    );
  }
  return <Form uid={uid} initial={initial} />;
}
