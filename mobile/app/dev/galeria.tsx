// Galeria de componentes: só em desenvolvimento. Fora de __DEV__ redireciona para a home.
// Os dados de vista (VM) estão aqui, com casos extremos de propósito (nomes longos, sem imagem, data inválida).
import Feather from '@expo/vector-icons/Feather';
import { Redirect, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { CompetitionBadge } from '@/components/CompetitionBadge';
import { EventRow, type EventVM } from '@/components/EventRow';
import { GameHeader, type GameHeaderVM } from '@/components/GameHeader';
import { Header } from '@/components/Header';
import { MenuRow } from '@/components/MenuRow';
import { NewsCard, type NewsVM } from '@/components/NewsCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RankingRow, type RankingVM } from '@/components/RankingRow';
import { Screen } from '@/components/Screen';
import { SectionBar } from '@/components/SectionBar';
import { Sheet } from '@/components/Sheet';
import { Tabs } from '@/components/Tabs';
import { TextField } from '@/components/TextField';
import { formatRound } from '@/lib/formatRound';
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
  const [name, setName] = useState('');
  const [filled, setFilled] = useState('Maria Albuquerque Co');
  const [equal, setEqual] = useState<'a' | 'b' | 'c'>('a');
  const [scroll, setScroll] = useState('t1');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Header title="Galeria" onBack={() => router.back()} />
      <Screen scroll>
        <Section title="Header">
          <Body variant="body">É o cabeçalho desta própria página.</Body>
        </Section>

        <Section title="PrimaryButton">
          <PrimaryButton label="Entrar" onPress={() => {}} />
          <PrimaryButton label="Criar conta" variant="secondary" onPress={() => {}} />
          <PrimaryButton label="A carregar" loading onPress={() => {}} />
          <PrimaryButton label="Desativado" disabled onPress={() => {}} />
        </Section>

        <Section title="TextField">
          <TextField label="Nome público" value={name} onChangeText={setName} />
          <TextField label="Nome público" value={filled} onChangeText={setFilled} />
          <TextField label="Palavra-passe" value="segredo" onChangeText={() => {}} secure />
          <TextField label="Email" value="erro" onChangeText={() => {}} error="Email inválido" />
        </Section>

        <Section title="Tabs" caption="SEM FIGMA (modo igual e deslizante) — confirmar: sublinhado ativo branco, etiquetas brancas">
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
          <GameHeader game={SCHEDULED} now={NOW} />
          <Body variant="body">Ao vivo (ronda longa)</Body>
          <GameHeader game={LIVE} now={NOW} />
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
          <SectionBar label="Informação do Jogo" right="Ver tudo" />
        </Section>

        <Section title="MenuRow">
          <MenuRow icon={<Feather name="calendar" size={layout.menuRowIcon} color={colors.white} />} label="Agenda" onPress={() => {}} />
          <MenuRow icon={<Feather name="external-link" size={layout.menuRowIcon} color={colors.white} />} label="Loja oficial" external onPress={() => {}} />
        </Section>

        <Section title="Sheet" caption="SEM FIGMA (gesto) — confirmar: direção da seta e arrastar">
          <View style={{ height: 320 }}>
            <Sheet title="GameBox Digital" collapsedHeight={124} expandedHeight={320} open={open} onOpenChange={setOpen}>
              <Body variant="body" style={{ color: colors.black }}>Conteúdo da folha aberta.</Body>
            </Sheet>
          </View>
        </Section>

        <Section title="NewsCard" caption="SEM FIGMA — aprovar: cartão de notícia (com imagem, sem imagem, data inválida)">
          {NEWS.map((n) => (
            <NewsCard key={n.id} news={n} now={NOW} onPress={() => {}} />
          ))}
        </Section>

        <Section title="RankingRow" caption="SEM FIGMA — aprovar: linha de ranking (linha “Tu” destacada e linha com 1 ponto)">
          {RANKING.map((r) => (
            <RankingRow key={r.uid} row={r} highlighted={r.uid === 'me'} />
          ))}
        </Section>
      </Screen>
    </>
  );
}

export default function Galeria() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}
