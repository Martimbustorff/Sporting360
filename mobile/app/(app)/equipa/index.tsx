// Figma V7.1: frames 38 a 41 (4949:8312 Plantel, 4949:8429 Estatísticas, 4949:8565 Transferências, 4949:8654 Troféus). Header
// "Sporting", separadores com scroll, secções em Eyebrow (`SectionBar`) e as linhas de `TeamRows` (`PlayerPhoto` de 36 com o número,
// etiquetas LESÃO/DÚVIDA, seta de 18). Estatísticas: pílulas das competições, forma em quadrados de 28, cartão Casa/Fora/Total
// (surface-06, raio 12, colunas de 56), golos por período em barras verticais (até 63 pt) e tabela de jogadores com
// `PlayerPhoto` de 24 (J, Min, G, A, Nota). Transferências: etiqueta Entrada/Saída, nome, "de/para clube", data e tipo à direita.
// Troféus: ícone e texto para o treinador; jogadores com a contagem e a seta.
// SEM FIGMA: os erros e vazios de cada secção, o aviso de cache, a ligação "Ver marcadores", os golos sofridos por período (só se mostram os marcados, como no frame; os sofridos ficam no rótulo de
// acessibilidade da barra), e o treinador sem seta
// (não há ecrã do treinador). O frame de transferências não tem emblemas: o emblema do outro clube deixou de se mostrar.
// Cada tab lê só os seus documentos e depende só do principal (Plantel: plantel; Troféus: troféus). Uma leitura
// principal falhada mostra o erro, nunca o vazio; uma secundária (treinador, indisponíveis) só a sua secção.
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Chips } from '@/components/Chips';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PlayerPhoto } from '@/components/PlayerPhoto';
import { Screen } from '@/components/Screen';
import { SwipeTabs } from '@/components/SwipeTabs';
import { SectionBar } from '@/components/SectionBar';
import { Tabs } from '@/components/Tabs';
import { Loading, SectionLoading, PersonRow, SectionError, Tag, TextRow } from '@/components/TeamRows';
import { Touchable } from '@/components/Touchable';
import { useNow } from '@/data/clock';
import type { Loadable } from '@/data/hooks';
import type { Transfer } from '@/data/schemas';
import { usePlayerStats, useSeasonFootballCompetitions, useTeamData, useTeamStats } from '@/data/sports';
import { countryNamePt } from '@/lib/countryName';
import { footballSeason } from '@/lib/periods';
import { injuryText, isDoubtful, type FormLetter } from '@/lib/prematch';
import {
  calendarDateText,
  groupSquad,
  playersByGoals,
  playersWithTrophies,
  ratingText,
  teamStatsVM,
  transferTypeLabel,
  trophyPlaceText,
  unavailablePlayers,
  type Split,
} from '@/lib/team';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

type TabKey = 'plantel' | 'estatisticas' | 'transferencias' | 'trofeus';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'plantel', label: 'Plantel' },
  { key: 'estatisticas', label: 'Estatísticas' },
  { key: 'transferencias', label: 'Transferências' },
  { key: 'trofeus', label: 'Troféus' },
];

const ERROR_TEXT = 'Não foi possível carregar os dados.';
const NO_SQUAD = 'Plantel ainda não disponível.';
const NO_COMPETITIONS = 'Sem competições nesta época.';
const NO_TEAM_STATS = 'Sem estatísticas para esta competição.';
const NO_PLAYER_STATS = 'Sem estatísticas de jogadores nesta época.';
const NO_TRANSFERS = 'Sem transferências registadas.';
const NO_TROPHIES = 'Sem troféus registados.';

const LETTER_BG: Record<FormLetter, string> = { V: colors.primary, E: colors.surface20, D: colors.formLoss };

type Reads = Loadable<unknown>[];
const anyCache = (rs: Reads) => rs.some((r) => r.status === 'ready' && r.fromCache === true);
const dataOf = <T,>(l: Loadable<T>): T | null => (l.status === 'ready' ? l.data : null);
const openPlayer = (id: string) => router.push(`/equipa/jogador/${id}`);

function TabScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.s24, paddingBottom: space.s32, gap: space.s12 }}>
      {children}
    </ScrollView>
  );
}

// --- Plantel ---------------------------------------------------------------------------------

function SquadTab() {
  const squad = useTeamData('squad');
  const coach = useTeamData('coach');
  const injuries = useTeamData('injuries');
  // Só o plantel decide o ecrã; treinador e indisponíveis falham cada um na sua secção.
  if (squad.status === 'loading') return <Loading testID="squad-loading" />;
  if (squad.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const players = dataOf(squad)?.players ?? [];
  if (players.length === 0) return <EmptyState icon="info" text={NO_SQUAD} />;
  const c = dataOf(coach);
  // O frame mostra o número também nos indisponíveis; o documento de lesões não o tem, vem do plantel.
  const numberOf = new Map(players.map((p) => [p.id, p.number]));
  const out = injuries.status === 'ready' ? unavailablePlayers(injuries.data) : [];
  const coachDetail = c ? [countryNamePt(c.nationality), c.since ? `desde ${calendarDateText(c.since)}` : null].filter(Boolean).join(' · ') : '';
  return (
    <TabScroll>
      <OfflineBanner visible={anyCache([squad, coach, injuries])} />
      {coach.status === 'error' ? (
        <>
          <SectionBar label="Treinador" />
          <SectionError />
        </>
      ) : c ? (
        <View>
          <SectionBar label="Treinador" />
          <PersonRow label={`Treinador: ${c.name}`} photo={c.photo} name={c.name} detail={coachDetail || undefined} />
        </View>
      ) : null}
      {injuries.status === 'error' ? (
        <>
          <SectionBar label="Indisponíveis" />
          <SectionError />
        </>
      ) : out.length > 0 ? (
        <View>
          <SectionBar label="Indisponíveis" />
          {out.map((i) => {
            const why = injuryText(i.type ?? '', i.reason ?? '');
            const doubt = isDoubtful(i.type ?? null);
            return (
              <PersonRow
                key={i.playerId}
                label={why ? `${i.name}, ${why}` : i.name}
                number={numberOf.get(i.playerId) ?? null}
                photo={i.photo}
                name={i.name}
                detail={why || undefined}
                tag={<Tag kind={doubt ? 'doubt' : 'injury'} text={doubt ? 'Dúvida' : 'Lesão'} />}
                onPress={() => openPlayer(i.playerId)}
              />
            );
          })}
        </View>
      ) : null}
      {groupSquad(players).map((g) => (
        <View key={g.label}>
          <SectionBar label={g.label} />
          {g.players.map((p) => (
            <PersonRow
              key={p.id}
              testID={`squad-row-${p.id}`}
              label={p.number === null ? p.name : `${p.number}, ${p.name}`}
              number={p.number}
              photo={p.photo}
              name={p.name}
              detail={p.age === null ? undefined : `${p.age} anos`}
              onPress={() => openPlayer(p.id)}
            />
          ))}
        </View>
      ))}
    </TabScroll>
  );
}

// --- Estatísticas ----------------------------------------------------------------------------

function FormBoxes({ letters }: { letters: FormLetter[] }) {
  return (
    <View accessible accessibilityLabel={`Forma: ${letters.join(' ')}`} style={{ flexDirection: 'row', gap: layout.formBoxGap }}>
      {letters.map((l, i) => (
        <View
          key={i}
          style={{
            width: layout.formBox,
            height: layout.formBox,
            borderRadius: layout.formBoxRadius,
            backgroundColor: LETTER_BG[l],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text71 variant="label16">{l}</Text71>
        </View>
      ))}
    </View>
  );
}

function SplitRow({ label, s }: { label: string; s: Split }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: casa ${s.home}, fora ${s.away}, total ${s.total}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: layout.splitCardGap }}
    >
      <Text71 variant="body14" color="textMuted" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>{label}</Text71>
      {[s.home, s.away, s.total].map((v, i) => (
        <Text71 key={i} variant="label16" numberOfLines={1} style={{ width: layout.splitCol, flexShrink: 0, textAlign: 'right' }}>{String(v)}</Text71>
      ))}
    </View>
  );
}

function SplitCard({ rows }: { rows: [string, Split][] }) {
  return (
    <View
      testID="split-card"
      style={{
        backgroundColor: colors.surface06,
        borderRadius: layout.tieCardRadius,
        paddingHorizontal: layout.splitCardPadX,
        paddingVertical: layout.splitCardPadY,
        gap: layout.splitCardGap,
      }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: layout.splitCardGap }}>
        <View style={{ flex: 1 }} />
        {['Casa', 'Fora', 'Total'].map((h) => (
          <Text71 key={h} variant="eyebrow13" color="textSubtle" numberOfLines={1} style={{ width: layout.splitCol, flexShrink: 0, textAlign: 'right' }}>{h}</Text71>
        ))}
      </View>
      {rows.map(([label, s]) => (
        <SplitRow key={label} label={label} s={s} />
      ))}
    </View>
  );
}

/** Barras verticais por período: altura proporcional ao máximo (até `periodBarMax`), valor por cima, intervalo por baixo. */
function PeriodBars({ periods }: { periods: { label: string; for: number; against: number }[] }) {
  const max = Math.max(1, ...periods.map((p) => p.for));
  return (
    <View testID="period-bars" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: layout.periodBarGap }}>
      {periods.map((p) => (
        <View
          key={p.label}
          testID={`period-${p.label}`}
          accessible
          accessibilityLabel={`${p.label}: marcados ${p.for}, sofridos ${p.against}`}
          style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: layout.periodColGap }}
        >
          <Text71 variant="label16" numberOfLines={1}>{String(p.for)}</Text71>
          <View
            testID={`period-bar-${p.label}`}
            style={{
              width: '100%',
              height: Math.max(layout.periodBarMin, Math.round((layout.periodBarMax * p.for) / max)),
              borderRadius: layout.periodBarRadius,
              backgroundColor: colors.primaryOnDark,
            }}
          />
          <Text71 variant="badge11" color="textSubtle" numberOfLines={1}>{p.label}</Text71>
        </View>
      ))}
    </View>
  );
}

function TeamStatsBlock({ leagueId, season }: { leagueId: string; season: string }) {
  const stats = useTeamStats(leagueId, season);
  if (stats.status === 'loading') return <SectionLoading testID="team-stats-loading" />;
  if (stats.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const vm = stats.status === 'ready' ? teamStatsVM(stats.data) : null;
  if (!vm || vm.empty) return <EmptyState icon="info" text={NO_TEAM_STATS} />;
  const rows: [string, Split | null][] = [
    ['Marcados', vm.goalsFor],
    ['Sofridos', vm.goalsAgainst],
    ['Sem sofrer', vm.cleanSheet],
  ];
  const shown = rows.filter((r): r is [string, Split] => r[1] !== null);
  return (
    <>
      <OfflineBanner visible={stats.status === 'ready' && stats.fromCache === true} />
      {vm.form.length > 0 ? (
        <View style={{ gap: layout.blockGap }}>
          <SectionBar label="Forma" />
          <FormBoxes letters={vm.form} />
        </View>
      ) : null}
      {shown.length > 0 ? (
        <View style={{ gap: layout.blockGap }}>
          <SectionBar label="Golos" />
          <SplitCard rows={shown} />
        </View>
      ) : null}
      {vm.periods.length > 0 ? (
        <View style={{ gap: layout.statsBlockGap }}>
          <SectionBar label="Golos por período" />
          <PeriodBars periods={vm.periods} />
        </View>
      ) : null}
    </>
  );
}

const PT_COLS = [layout.ptColGames, layout.ptColMinutes, layout.ptColGoals, layout.ptColAssists, layout.ptColRating];

function PlayerTable({ season }: { season: string }) {
  const stats = usePlayerStats(season);
  if (stats.status === 'loading') return <SectionLoading testID="player-stats-loading" />;
  if (stats.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const players = stats.status === 'ready' ? playersByGoals(stats.data) : [];
  if (players.length === 0) return <EmptyState icon="info" text={NO_PLAYER_STATS} />;
  return (
    <View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', alignItems: 'center', gap: layout.periodColGap, paddingBottom: layout.ptRowPadY }}
      >
        <Text71 variant="eyebrow13" color="textSubtle" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>Jogador</Text71>
        {['J', 'Min', 'G', 'A', 'Nota'].map((h, i) => (
          <Text71 key={h} variant="eyebrow13" color="textSubtle" numberOfLines={1} style={{ width: PT_COLS[i], flexShrink: 0, textAlign: 'right' }}>{h}</Text71>
        ))}
      </View>
      {players.map((p) => {
        const rating = ratingText(p.rating);
        const values = [String(p.appearances), String(p.minutes), String(p.goals), String(p.assists), rating];
        return (
          <Touchable
            key={p.id}
            testID={`stats-row-${p.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}: ${p.appearances} jogos, ${p.minutes} minutos, ${p.goals} golos, ${p.assists} assistências, nota ${rating}`}
            onPress={() => openPlayer(p.id)}
            style={{
              minHeight: layout.minTouch,
              flexDirection: 'row',
              alignItems: 'center',
              gap: layout.periodColGap,
              paddingVertical: layout.ptRowPadY,
              borderBottomWidth: layout.separator,
              borderBottomColor: colors.separator,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: layout.ptPhotoGap }}>
              <PlayerPhoto photo={p.photo} size={layout.ptPhoto} />
              <Text71 variant="body14" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>{p.name}</Text71>
            </View>
            {values.map((v, i) => (
              <Text71
                key={i}
                variant="label16"
                color={i === 4 ? 'white' : 'textMuted'}
                numberOfLines={1}
                style={{ width: PT_COLS[i], flexShrink: 0, textAlign: 'right' }}
              >
                {v}
              </Text71>
            ))}
          </Touchable>
        );
      })}
    </View>
  );
}

function StatsTab({ season }: { season: string }) {
  const comps = useSeasonFootballCompetitions(season);
  const [picked, setPicked] = useState<string | null>(null);
  if (comps.status === 'loading') return <Loading testID="competitions-loading" />;
  if (comps.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const list = comps.status === 'ready' ? comps.data : [];
  const current = list.find((c) => c.key === picked) ?? list[0];
  if (!current) return <EmptyState icon="info" text={NO_COMPETITIONS} />;
  return (
    <TabScroll>
      <Chips items={list.map((c) => ({ key: c.key, label: c.name }))} value={current.key} onChange={setPicked} testIDPrefix="comp" />
      <TeamStatsBlock key={current.key} leagueId={current.leagueId} season={season} />
      <SectionBar label="Jogadores da época" />
      <Touchable
        testID="link-marcadores"
        accessibilityRole="link"
        accessibilityLabel="Ver marcadores"
        onPress={() => router.push('/equipa/marcadores')}
        style={{ alignSelf: 'flex-start', minHeight: layout.minTouch, justifyContent: 'center' }}
      >
        <Text71 variant="label16" color="primaryOnDark">Ver marcadores</Text71>
      </Touchable>
      <PlayerTable season={season} />
    </TabScroll>
  );
}

// --- Transferências --------------------------------------------------------------------------

function TransferRow({ t, testID }: { t: Transfer; testID: string }) {
  const other = t.direction === 'in' ? t.out : t.in;
  const where = t.direction === 'in' ? `de ${other.name}` : `para ${other.name}`;
  const type = transferTypeLabel(t.type);
  const date = calendarDateText(t.date);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={[t.direction === 'in' ? 'Entrada' : 'Saída', t.name, where, date, type].filter(Boolean).join(', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.transferRowGap,
        paddingVertical: layout.transferRowPadY,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
      }}
    >
      <Tag kind={t.direction === 'in' ? 'in' : 'out'} text={t.direction === 'in' ? 'Entrada' : 'Saída'} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text71 variant="strong14" numberOfLines={1} ellipsizeMode="tail">{t.name}</Text71>
        <Text71 variant="caption12" color="textSubtle" numberOfLines={1} ellipsizeMode="tail">{where}</Text71>
      </View>
      <View style={{ flexShrink: 0, alignItems: 'flex-end' }}>
        <Text71 variant="caption12" color="textMuted" numberOfLines={1}>{date}</Text71>
        {type ? <Text71 variant="badge11" color="textSubtle" numberOfLines={1}>{type}</Text71> : null}
      </View>
    </View>
  );
}

function TransfersTab() {
  const transfers = useTeamData('transfers');
  if (transfers.status === 'loading') return <Loading testID="transfers-loading" />;
  if (transfers.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const items = transfers.status === 'ready' ? transfers.data.items : [];
  if (items.length === 0) return <EmptyState icon="info" text={NO_TRANSFERS} />;
  return (
    <TabScroll>
      <OfflineBanner visible={anyCache([transfers])} />
      {/* O servidor já ordena da mais recente para a mais antiga. */}
      <View>
        {items.map((t, i) => (
          <TransferRow key={`${t.playerId}-${t.date}-${i}`} t={t} testID={`transfer-row-${i}`} />
        ))}
      </View>
    </TabScroll>
  );
}

// --- Troféus ---------------------------------------------------------------------------------

function TrophiesTab() {
  const trophies = useTeamData('trophies');
  const squad = useTeamData('squad');
  const coach = useTeamData('coach');
  // Só os troféus decidem o ecrã; o plantel (nomes dos jogadores) é secundário.
  if (trophies.status === 'loading') return <Loading testID="trophies-loading" />;
  if (trophies.status === 'error') return <EmptyState icon="info" text={ERROR_TEXT} />;
  const t = dataOf(trophies);
  const s = dataOf(squad);
  const coachTrophies = t?.coach ?? [];
  const squadFailed = squad.status === 'error';
  const players = t && s ? playersWithTrophies(s, t) : [];
  const anyPlayerTrophy = !!t && Object.values(t.byPlayer).some((x) => x.length > 0);
  // Com o plantel a falhar não se sabe se há jogadores com troféus: mostra-se o erro da secção, não o vazio.
  const showPlayers = players.length > 0 || (squadFailed && anyPlayerTrophy);
  if (coachTrophies.length === 0 && !showPlayers) {
    return squad.status === 'loading' ? <Loading testID="trophies-loading" /> : <EmptyState icon="info" text={NO_TROPHIES} />;
  }
  return (
    <TabScroll>
      <OfflineBanner visible={anyCache([trophies, squad, coach])} />
      {coachTrophies.length > 0 ? (
        <View>
          <SectionBar label="Treinador" />
          {coachTrophies.map((x, i) => (
            <TextRow key={`${x.league}-${x.season}-${i}`} icon left={`${x.league} · ${x.season}`} right={trophyPlaceText(x.place)} />
          ))}
        </View>
      ) : null}
      {showPlayers ? (
        <View>
          <SectionBar label="Jogadores" />
          {squadFailed ? (
            <SectionError />
          ) : (
            players.map(({ player, count }) => {
              const total = count === 1 ? '1 troféu' : `${count} troféus`;
              return (
                <PersonRow
                  key={player.id}
                  testID={`trophy-player-${player.id}`}
                  label={`${player.name}, ${total}`}
                  number={player.number}
                  photo={player.photo}
                  name={player.name}
                  detail={total}
                  tag={<Tag kind="count" text={String(count)} />}
                  onPress={() => openPlayer(player.id)}
                />
              );
            })
          )}
        </View>
      ) : null}
    </TabScroll>
  );
}

// --- Ecrã ------------------------------------------------------------------------------------

export default function Equipa() {
  const [tab, setTab] = useState<TabKey>('plantel');
  const now = useNow();
  const season = useMemo(() => footballSeason(now), [now]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen padded="none">
      <Header title="SPORTING" onBack={back} />
      <View style={{ flex: 1, paddingTop: space.s12, gap: space.s12 }}>
        <View style={{ paddingHorizontal: space.s24 }}>
          <Tabs mode="scroll" items={TABS} value={tab} onChange={setTab} />
        </View>
        <SwipeTabs keys={TABS.map((t) => t.key)} value={tab} onChange={setTab}>
          {tab === 'plantel' ? (
            <SquadTab />
          ) : tab === 'estatisticas' ? (
            <StatsTab season={season} />
          ) : tab === 'transferencias' ? (
            <TransfersTab />
          ) : (
            <TrophiesTab />
          )}
        </SwipeTabs>
      </View>
    </Screen>
  );
}
