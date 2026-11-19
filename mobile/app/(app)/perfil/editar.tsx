// Figma V7.1 23 Editar perfil (4942:7751): campos a 28 (primeiro a 26 do Header), modalidade em pílulas, jogador favorito
// numa linha "Escolha" com PlayerPhoto (a lista do plantel abre ao tocar), Guardar Branco em baixo. Compõe AuthScaffold.
// Task 22: campos privados do próprio (nunca públicos): Número de sócio (`memberNumber`), Sócio desde (`partnerNumber`,
// MM/AAAA), Lugar anual, Modalidade favorita e Jogador favorito (plantel). Grava só o que mudou, só chaves permitidas
// pelas regras (services/userProfile). O nome público tem o seu ecrã (/perfil/nome). O email não aparece aqui.
// Leitura falhada: erro, nunca o formulário vazio. Sem rede: mensagem clara e o formulário fica como está.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AuthScaffold, FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { PlayerPhoto } from '@/components/PlayerPhoto';
import { TextField } from '@/components/TextField';
import { Touchable } from '@/components/Touchable';
import { useMyUser } from '@/data/hooks';
import type { Sport } from '@/data/schemas';
import { useTeamData } from '@/data/sports';
import { diffForm, formFromUser, SEASON_SEAT_MAX, type ProfileForm } from '@/lib/profileFields';
import { SPORTS } from '@/lib/sports';
import { useSession } from '@/providers/SessionProvider';
import { ProfileSaveError, updateMyProfileFields } from '@/services/userProfile';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const EDITAR_TEXT = {
  loadError: 'Não foi possível carregar o teu perfil.',
  squadError: 'Não foi possível carregar o plantel.',
  noSquad: 'O plantel ainda não está disponível.',
  saved: 'Perfil guardado.',
  OFFLINE: 'Sem ligação. Ainda não foi confirmado; mantemos o que escreveste. As alterações vão ser enviadas quando houver ligação.',
  DENIED: 'Não tens permissão para guardar estas alterações.',
  UNKNOWN: 'Não foi possível guardar. Tenta outra vez.',
} as const;

type Message = { text: string; tone: 'error' | 'info' };

/** Frame 23 (4942:7835): linha "Escolha" com a foto, o nome e "Mudar"; ao tocar abre a lista do plantel. */
function PlayerField({
  selected,
  onSelect,
}: {
  selected: { id: string; name: string } | null;
  onSelect: (p: { id: string; name: string }) => void;
}) {
  const squad = useTeamData('squad');
  const [open, setOpen] = useState(false);
  const players = squad.status === 'ready' ? squad.data.players : [];
  const current = selected ? players.find((p) => p.id === selected.id) : undefined;
  return (
    <View style={{ gap: space.s8 }}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={selected ? `Jogador favorito: ${selected.name}. ${open ? 'Fechar lista' : 'Mudar'}` : 'Escolher jogador favorito'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: layout.playerChoiceGap,
          paddingHorizontal: layout.leaderChipPadX,
          paddingVertical: space.s12,
          borderRadius: radii.r12,
          backgroundColor: colors.surface06,
        }}
      >
        <PlayerPhoto testID="favorite-player-photo" photo={current?.photo ?? null} size={layout.playerChoicePhoto} number={current?.number ?? null} />
        <Text71
          variant="strong14"
          color={selected ? 'white' : 'textMuted'}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ flex: 1, minWidth: 0 }}
        >
          {selected ? selected.name : 'Não indicado'}
        </Text71>
        <Text71 variant="captionStrong12" color="primaryOnDark">{selected ? 'Mudar' : 'Escolher'}</Text71>
      </Touchable>
      {open ? (
        squad.status === 'loading' ? (
          <View testID="squad-loading" style={{ minHeight: layout.skeletonRowHeight }} />
        ) : squad.status === 'error' ? (
          <Text71 variant="body14" color="danger">{EDITAR_TEXT.squadError}</Text71>
        ) : players.length === 0 ? (
          <Text71 variant="body14" color="textMuted">{EDITAR_TEXT.noSquad}</Text71>
        ) : (
          <View accessibilityRole="radiogroup">
            {players.map((p) => {
              const isSelected = p.id === selected?.id;
              return (
                <Touchable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityLabel={p.name}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onSelect({ id: p.id, name: p.name });
                    setOpen(false);
                  }}
                  style={{
                    minHeight: layout.minTouch,
                    paddingHorizontal: layout.leaderChipPadX,
                    borderRadius: radii.r12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: layout.playerChoiceGap,
                    backgroundColor: isSelected ? colors.surface10 : undefined,
                  }}
                >
                  <PlayerPhoto photo={p.photo} size={layout.playerChoicePhoto} number={p.number} />
                  <Text71 variant="strong14" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>{p.name}</Text71>
                </Touchable>
              );
            })}
          </View>
        )
      ) : null}
    </View>
  );
}

/** Frame 23 (4942:7821): opções em pílulas; a escolhida em branco com texto bg, as outras surface-10. */
function SportChips({ value, onChange }: { value: Sport | null; onChange: (s: Sport) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.chipsGap }}>
      {SPORTS.map((sp) => {
        const active = sp.key === value;
        return (
          <Touchable
            key={sp.key}
            accessibilityRole="radio"
            accessibilityLabel={sp.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(sp.key)}
            style={{
              paddingHorizontal: layout.leaderChipPadX,
              paddingVertical: layout.leaderChipPadY,
              borderRadius: layout.leaderChipRadius,
              backgroundColor: active ? colors.white : colors.surface10,
            }}
          >
            <Text71 variant="captionStrong12" color={active ? 'bg' : 'white'} numberOfLines={1}>{sp.label}</Text71>
          </Touchable>
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
      contentTop={layout.editFieldsTop}
      fieldsGap={layout.editFieldsGap}
      footer={
        <>
          {message ? <FormMessage text={message.text} tone={message.tone} /> : null}
          <PrimaryButton variant="white" label="Guardar" onPress={() => void submit()} loading={loading} disabled={!changed || invalid} />
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
      <View style={{ gap: layout.chipsLabelGap }}>
        <Text71 variant="eyebrow13" color="textSubtle">Modalidade favorita</Text71>
        <SportChips value={form.favoriteSport ?? null} onChange={(k) => set('favoriteSport', k)} />
      </View>
      <View style={{ gap: layout.chipsLabelGap }}>
        <Text71 variant="eyebrow13" color="textSubtle">Jogador favorito</Text71>
        <PlayerField selected={form.favoritePlayer} onSelect={(p) => set('favoritePlayer', p)} />
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
