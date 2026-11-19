// Galeria de componentes: só em desenvolvimento. Fora de __DEV__ redireciona para a home.
// Os dados de vista (VM) estão aqui, com casos extremos de propósito (nomes longos, sem imagem, data inválida).
// Os dados do emulador (src/data/fixtures, com a palavra-passe do utilizador de teste) só se carregam com require dentro
// de `if (__DEV__)`: na build de produção o Metro corta o ramo e o módulo não entra no bundle.
import Feather from '@expo/vector-icons/Feather';
import { Redirect, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { BracketView } from '@/components/BracketView';
import { CompetitionBadge } from '@/components/CompetitionBadge';
import { EmptyState } from '@/components/EmptyState';
import { EventRow, type EventVM } from '@/components/EventRow';
import { GameboxCard } from '@/components/GameboxCard';
import { GameHeader, type GameHeaderVM } from '@/components/GameHeader';
import { Header } from '@/components/Header';
import { MatchRow } from '@/components/MatchRow';
import { MenuRow } from '@/components/MenuRow';
import { NewsCard, type NewsVM } from '@/components/NewsCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Pitch } from '@/components/Pitch';
import { PlayerPhoto } from '@/components/PlayerPhoto';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RankingRow, type RankingVM } from '@/components/RankingRow';
import { Screen } from '@/components/Screen';
import { SectionBar } from '@/components/SectionBar';
import { ShareCard } from '@/components/ShareCard';
import { Sheet } from '@/components/Sheet';
import { Switch } from '@/components/Switch';
import { SocialButtons } from '@/components/SocialButtons';
import { StandingsTable } from '@/components/StandingsTable';
import { StatRow } from '@/components/StatRow';
import { Tabs } from '@/components/Tabs';
import { TextField } from '@/components/TextField';
import { ToggleRow } from '@/components/ToggleRow';
import { VideoPlayer } from '@/components/VideoPlayer';
import { BracketDocSchema, MatchSchema, StandingsDocSchema, VideoSchema } from '@/data/schemas';
import { formatRound } from '@/lib/formatRound';
import type { GameboxView } from '@/lib/gamebox';
import { pitchRows } from '@/lib/pitch';
import { Body, Display } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

const NOW = new Date('2026-11-18T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const SCHEDULED: GameHeaderVM = {
  competitionName: 'Liga Portugal',
  round: formatRound('Regular Season - 16'),
  home: { name: 'Sporting CP', crestUrl: null, id: 228 },
  away: { name: 'Sporting Clube de Portugal B', crestUrl: null, id: 9999 },
  state: 'scheduled',
  kickoff: new Date('2026-11-22T20:30:00Z'),
  tv: 'Sport TV 1',
};

const LIVE: GameHeaderVM = {
  competitionName: 'Taça de Portugal',
  round: formatRound('Round of 32'),
  home: { name: 'FC Porto', crestUrl: null, id: 212 },
  away: { name: 'Sporting CP', crestUrl: null, id: 228 },
  state: 'live',
  kickoff: new Date('2026-11-18T11:00:00Z'),
  minute: 23,
  score: { home: 1, away: 2 },
};

const EVENTS: EventVM[] = [
  { minute: "12'", side: 'home', kind: 'goal', primary: 'Jogador Um', secondary: 'Assistência: Jogador Dois' },
  { minute: "34'", side: 'away', kind: 'yellow', primary: 'Jogador Três' },
  { minute: "51'", side: 'home', kind: 'red', primary: 'Jogador Quatro' },
  { minute: "67'", side: 'away', kind: 'sub', primary: 'Entra: Jogador Cinco', secondary: 'Sai: Jogador Seis' },
  { minute: "80'", side: 'home', kind: 'var', primary: 'Golo anulado' },
];

const NEWS: NewsVM[] = [
  { id: 'n1', title: 'Sporting vence no Dragão e isola-se no segundo lugar da Liga Portugal', imageUrl: 'https://picsum.photos/200', source: 'Record', publishedAt: hoursAgo(3) },
  { id: 'n2', title: 'Notícia sem imagem, com um título muito comprido para provar que o texto quebra em várias linhas sem empurrar o resto do cartão', imageUrl: null, source: 'A Bola', publishedAt: hoursAgo(30), sport: 'Futebol' },
  { id: 'n3', title: 'Notícia com data inválida (sem tempo relativo)', imageUrl: null, source: 'O Jogo', publishedAt: new Date('invalid') },
];

const RANKING: RankingVM[] = [
  { position: 1, uid: 'u1', displayName: 'Ana Silva', points: 18 },
  { position: 2, uid: 'u2', displayName: 'Rui Costa', points: 15 },
  { position: 3, uid: 'me', displayName: 'Maria Albuquerque Co', points: 12 },
  { position: 4, uid: 'u4', displayName: 'Inês Pereira', points: 1 },
];

// Dados reais do emulador (fixtures) passados pelos schemas: a galeria mostra o que a app vai ler.
// O require fica dentro do bloco `if (__DEV__)` (não depois de um return antecipado): só assim o Metro corta o ramo
// antes de juntar as dependências.
function loadFixtureData() {
  let data = null;
  if (__DEV__) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildFixtures, SPORTING_TEAM_ID } = require('@/data/fixtures') as typeof import('@/data/fixtures');
    const all = new Map(buildFixtures(NOW).map((d) => [d.path, d.data]));
    const fixture = (path: string): unknown => all.get(path);
    data = {
      SPORTING_TEAM_ID,
      MATCH_FT: MatchSchema.parse(fixture('matches/9000')),
      MATCH_LIVE: MatchSchema.parse(fixture('matches/9002')),
      MATCH_PST: MatchSchema.parse(fixture('matches/9004')),
      MATCH_FUTSAL: MatchSchema.parse(fixture('matches/9101')),
      STANDINGS: StandingsDocSchema.parse(fixture('competitions/football_94_2026/data/standings')),
      BRACKET: BracketDocSchema.parse(fixture('competitions/football_96_2026/data/bracket')),
      VIDEO: VideoSchema.parse({ ...(fixture('matches/9000/videos/v1') as object) }),
      LINEUPS: (fixture('matches/9002/details/lineups') as { teams: { startXI: Parameters<typeof pitchRows>[0] }[] }).teams,
    };
  }
  return data;
}

const GAMEBOX: GameboxView = {
  id: 'g1',
  number: '1234567890123',
  name: 'Gamebox principal',
  order: 0,
  stadium: { port: '10', sector: 'A', line: '12', seat: '34' },
  pavilion: { port: '2', sector: 'B', line: '3', seat: '4' },
};

function Section({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
      <Display variant="screenTitle">{title}</Display>
      {caption ? <Body variant="body" style={{ color: colors.primary }}>{caption}</Body> : null}
      {children}
    </View>
  );
}

function Gallery() {
  const router = useRouter();
  const [fx] = useState(loadFixtureData);
  const [name, setName] = useState('');
  const [filled, setFilled] = useState('Maria Albuquerque Co');
  const [equal, setEqual] = useState<'a' | 'b' | 'c'>('a');
  const [scroll, setScroll] = useState('t1');
  const [open, setOpen] = useState(false);
  const [toggle, setToggle] = useState(true);
  if (!fx) return null;
  const { SPORTING_TEAM_ID, MATCH_FT, MATCH_LIVE, MATCH_PST, MATCH_FUTSAL, STANDINGS, BRACKET, VIDEO, LINEUPS } = fx;

  return (
    <>
      <Header title="Galeria" onBack={() => router.back()} />
      <Screen scroll>
        <Section title="Header">
          <Body variant="body">É o cabeçalho desta própria página.</Body>
        </Section>

        <Section title="PrimaryButton">
          <PrimaryButton label="Entrar" onPress={() => {}} />
          <PrimaryButton label="Escuro" variant="dark" onPress={() => {}} />
          <PrimaryButton label="Contorno" variant="outline" onPress={() => {}} />
          <PrimaryButton label="Branco" variant="white" onPress={() => {}} />
          <PrimaryButton label="Criar conta (secondary)" variant="secondary" onPress={() => {}} />
          <PrimaryButton label="A carregar" loading onPress={() => {}} />
          <PrimaryButton label="Desativado" disabled onPress={() => {}} />
        </Section>

        <Section title="TextField">
          <TextField label="Nome público" value={name} onChangeText={setName} placeholder="Como apareces no ranking" />
          <TextField label="Nome público" value={filled} onChangeText={setFilled} />
          <TextField label="Palavra-passe" value="segredo" onChangeText={() => {}} secure />
          <TextField label="Email" value="erro" onChangeText={() => {}} error="Email inválido" />
        </Section>

        <Section title="Tabs" caption="V7.1: modo igual (4942:7676) e deslizante (4935:7125)">
          <Tabs
            mode="equal"
            value={equal}
            onChange={setEqual}
            items={[{ key: 'a', label: 'Resumo' }, { key: 'b', label: 'Eventos' }, { key: 'c', label: 'Jogadores' }]}
          />
          <Tabs
            mode="scroll"
            value={scroll}
            onChange={setScroll}
            items={[
              { key: 't1', label: 'Todos' }, { key: 't2', label: 'Futebol' }, { key: 't3', label: 'Basquetebol' },
              { key: 't4', label: 'Andebol' }, { key: 't5', label: 'Futsal' }, { key: 't6', label: 'Modalidades' },
            ]}
          />
        </Section>

        <Section title="GameHeader">
          <Body variant="body">Agendado (equipa com nome longo)</Body>
          <GameHeader game={SCHEDULED} />
          <Body variant="body">Ao vivo (ronda longa)</Body>
          <GameHeader game={LIVE} />
        </Section>

        <Section title="CompetitionBadge">
          <CompetitionBadge label="J16" size="lg" />
          <CompetitionBadge label={formatRound('Round of 32')} size="lg" />
          <CompetitionBadge label="J16" size="sm" />
        </Section>

        <Section title="EventRow">
          {EVENTS.map((e) => (
            <EventRow key={e.minute} event={e} />
          ))}
        </Section>

        <Section title="SectionBar">
          <SectionBar label="1ª Parte" />
          <SectionBar label="Informação do Jogo" right="Ver tudo" onRightPress={() => {}} />
        </Section>

        <Section title="MenuRow">
          <MenuRow icon={<Feather name="calendar" size={layout.menuRowIcon} color={colors.white} />} label="Agenda" onPress={() => {}} />
          <MenuRow icon={<Feather name="external-link" size={layout.menuRowIcon} color={colors.white} />} label="Loja oficial" external onPress={() => {}} />
          <MenuRow icon={<Feather name="user" size={layout.menuRowIcon} color={colors.white} />} label="Tamanho M, sem seta" size="M" trailing="none" onPress={() => {}} />
          <MenuRow icon={<Feather name="globe" size={layout.menuRowIcon} color={colors.white} />} label="Nome muito comprido para provar as reticências num ecrã de 320 pontos" size="M" separator={false} onPress={() => {}} />
        </Section>

        <Section title="Sheet" caption="SEM FIGMA (gesto): confirmar: direção da seta e arrastar">
          <View style={{ height: 320 }}>
            <Sheet title="GameBox Digital" collapsedHeight={124} expandedHeight={320} open={open} onOpenChange={setOpen}>
              <Body variant="body" style={{ color: colors.black }}>Conteúdo da folha aberta.</Body>
            </Sheet>
          </View>
        </Section>

        <Section title="Sheet escura" caption="tone=dark (folhas escuras do Figma, ex. 4953:9228)">
          <View style={{ height: 240 }}>
            <Sheet title="Ativar Face ID?" tone="dark" collapsedHeight={240} expandedHeight={240} open onOpenChange={() => {}} toggleable={false}>
              <Body variant="body">Conteúdo da folha escura.</Body>
            </Sheet>
          </View>
        </Section>

        <Section title="NewsCard" caption="SEM FIGMA: aprovar: cartão de notícia (com imagem, sem imagem, data inválida)">
          {NEWS.map((n) => (
            <NewsCard key={n.id} news={n} now={NOW} onPress={() => {}} />
          ))}
        </Section>

        <Section title="RankingRow" caption="SEM FIGMA: aprovar: linha de ranking (linha “Tu” destacada e linha com 1 ponto)">
          {RANKING.map((r) => (
            <RankingRow key={r.uid} row={r} highlighted={r.uid === 'me'} />
          ))}
        </Section>

        <Section title="MatchRow" caption="Jogo terminado, ao vivo, adiado e futsal com fonte">
          {[MATCH_FT, MATCH_LIVE, MATCH_PST, MATCH_FUTSAL].map((m) => (
            <MatchRow key={m.id} match={m} onPress={() => {}} />
          ))}
        </Section>

        <Section title="StatRow">
          <StatRow label="Posse de bola" home="58%" away="42%" />
          <StatRow label="Cartões amarelos" home="2" away="1" card="yellow" />
          <StatRow label="Antes do jogo" home="0" away="0" muted />
        </Section>

        <Section title="Pitch">
          <Pitch
            home={pitchRows(LINEUPS[0]?.startXI ?? [])}
            away={pitchRows(LINEUPS[1]?.startXI ?? [])}
            ratings={{ '1001': '8.1', '1002': '7.4' }}
            sportingSide="home"
          />
        </Section>

        <Section title="StandingsTable">
          <StandingsTable groups={STANDINGS.groups} highlightTeamId={SPORTING_TEAM_ID} sport="football" />
        </Section>

        <Section title="BracketView">
          <BracketView bracket={BRACKET} highlightTeamId={SPORTING_TEAM_ID} />
        </Section>

        <Section title="VideoPlayer">
          <VideoPlayer video={VIDEO} />
        </Section>

        <Section title="ShareCard">
          <ShareCard match={MATCH_LIVE} home={2} away={1} />
        </Section>

        <Section title="ToggleRow">
          <ToggleRow icon={<Feather name="bell" size={layout.menuRowIcon} color={colors.white} />} label="Notificações" value={toggle} onChange={setToggle} />
          <ToggleRow icon={<Feather name="lock" size={layout.menuRowIcon} color={colors.white} />} label="Desativado" value={false} onChange={() => {}} disabled />
        </Section>

        <Section title="ToggleRow M">
          <ToggleRow icon={<Feather name="bell" size={layout.menuRowIcon} color={colors.white} />} label="Tamanho M ligado" value size="M" onChange={() => {}} />
          <ToggleRow icon={<Feather name="bell-off" size={layout.menuRowIcon} color={colors.white} />} label="Tamanho M desligado" value={false} size="M" onChange={() => {}} />
        </Section>

        <Section title="Switch">
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Switch label="Ligado" value onValueChange={() => {}} />
            <Switch label="Desligado" value={false} onValueChange={() => {}} />
            <Switch label="Desativado" value disabled onValueChange={() => {}} />
          </View>
        </Section>

        <Section title="PlayerPhoto" caption="Com foto, sem foto, foto que falha, com número, tamanhos 32 / 40 / 96">
          <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
            <PlayerPhoto photo="https://picsum.photos/200" size={40} number={17} />
            <PlayerPhoto photo={null} size={40} />
            <PlayerPhoto photo={null} size={40} number="9" />
            <PlayerPhoto photo="https://invalid.invalid/x.png" size={32} number={10} />
            <PlayerPhoto photo={null} size={96} />
          </View>
        </Section>

        <Section title="SocialButtons">
          <SocialButtons />
        </Section>

        <Section title="OfflineBanner">
          <OfflineBanner visible />
        </Section>

        <Section title="EmptyState">
          <EmptyState text="Sem jogos agendados." />
          <EmptyState text="Sem informação disponível." icon="info" />
        </Section>

        <Section title="GameboxCard">
          <GameboxCard gamebox={GAMEBOX} />
          <GameboxCard gamebox={{ ...GAMEBOX, id: 'g2', number: 'invalido', pavilion: null }} index={1} />
        </Section>
      </Screen>
    </>
  );
}

export default function Galeria() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}
