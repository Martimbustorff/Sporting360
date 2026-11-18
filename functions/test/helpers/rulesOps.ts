// Operações reais das duas apps contra o Firestore, para os testes das regras (Plano 5, Task 7).
//
// Cada operação semeia os dados de que precisa (com as regras desligadas) e depois corre a leitura ou a
// escrita exatamente como a app a faz, com a sessão que a app tem nesse momento. O teste só verifica se
// as regras a deixam passar. Cada entrada cita a linha da app de onde vem.
//
// V2_OPS: app da loja 6.1.2 (código em SCP360_V2-master/src). `afterLaunch` diz o que acontece com as
// regras finais (firestore.final.rules): "allowed" continua a funcionar, "denied" deixa de funcionar
// no lançamento (login por PIN, GameBox sem sessão, palpites, voto MVP e ranking antigos). A leitura de
// manofmatch continua (o ecrã do jogo da V2 depende dela).
// NEW_APP_OPS: app nova 7.0.0 (mobile/src). Tem de passar toda nas duas versões das regras.
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  addDoc, collection, deleteDoc, deleteField, doc, documentId, getCountFromServer, getDoc, getDocs, increment,
  limit, orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where,
  type Firestore,
} from "firebase/firestore";

export interface RulesOp {
  name: string;
  run: (env: RulesTestEnvironment) => Promise<unknown>;
}

export interface V2Op extends RulesOp {
  afterLaunch: "allowed" | "denied";
}

const ALICE = "alice";
const SEASON = "2026-2027";
const GAME = "m1";

async function seed(env: RulesTestEnvironment, docs: Record<string, Record<string, unknown>>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data);
  });
}

const anon = (env: RulesTestEnvironment): Firestore =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;
const as = (env: RulesTestEnvironment, uid: string): Firestore =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;

// --- Dados semeados ---------------------------------------------------------------------------

const v2User = { name: "Alice", email: "alice@example.pt", partnerNumber: "01/2010", gameboxNumber: "enc" };
const v2Gamebox = (over: Record<string, unknown> = {}) => ({
  gameboxNumber: "enc", gameboxLine: "1", gameboxName: "Casa", userid: ALICE, order: 1,
  gameboxPort: "10", gameboxSeat: "5", gameboxSector: "A", ...over,
});
const legacyGame = { api: GAME, timestamp: Timestamp.fromDate(new Date("2026-11-22T20:30:00Z")) };
const newsDoc = { title: "N", sport: "football", publishedAt: Timestamp.now(), created_at: Timestamp.now() };
const entry = (uid: string, points: number) => ({ uid, displayName: `Sportinguista ${uid}`, avatarId: null, points });
const LB = `leaderboards/season_${SEASON}/entries`;

// V2: a transação de predictions.ts:53-80 e manOfTheMatch.ts:42-66 (lê o voto, cria-o e soma +1 ao ranking).
function v2VoteTransaction(db: Firestore, col: "predictions" | "manofmatch", data: Record<string, unknown>) {
  const voteRef = doc(db, `${col}/${GAME}_${ALICE}`);
  const rankRef = doc(db, `rankings/${ALICE}_${SEASON}`);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(voteRef);
    if (snap.exists()) throw new Error("ALREADY_VOTED");
    tx.set(voteRef, data);
    tx.set(rankRef, { userId: ALICE, userName: "Alice", season: SEASON, points: increment(1) }, { merge: true });
  });
}
const v2Prediction = {
  gameId: GAME, userId: ALICE, userName: "Alice", scorehome: 2, scoreaway: 1, season: SEASON,
  scored: false, correct: false, createdAt: serverTimestamp(),
};
const v2MvpVote = { GameId: GAME, playerId: "10", userId: ALICE, season: SEASON, id: `${GAME}_${ALICE}` };

// --- V2 (loja, 6.1.2) -------------------------------------------------------------------------

export const V2_OPS: V2Op[] = [
  // Autenticação e perfil
  {
    name: "login por email lê o próprio users (screens/auth/login.tsx:65-68)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { [`users/${ALICE}`]: v2User });
      return getDoc(doc(as(env, ALICE), `users/${ALICE}`));
    },
  },
  {
    name: "login por PIN lê users/alice SEM sessão (screens/app/PassCode/PasscodeLoginScreen.tsx:55-58)",
    afterLaunch: "denied",
    run: async (env) => {
      await seed(env, { [`users/${ALICE}`]: v2User });
      return getDoc(doc(anon(env), `users/${ALICE}`));
    },
  },
  {
    name: "registo cria o próprio users {name, email} (screens/auth/register.tsx:41)",
    afterLaunch: "allowed",
    run: (env) => setDoc(doc(as(env, ALICE), `users/${ALICE}`), { name: "Alice", email: "alice@example.pt" }),
  },
  {
    name: "login Google lê o próprio users e cria-o se faltar (api/firebase/googleAuth.ts:55-56, :76)",
    afterLaunch: "allowed",
    run: async (env) => {
      const ref = doc(as(env, ALICE), `users/${ALICE}`);
      await getDoc(ref);
      return setDoc(ref, { name: "Alice", email: "alice@example.pt" });
    },
  },
  {
    name: "definições atualiza o próprio users (screens/app/definitions.tsx:58)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { [`users/${ALICE}`]: v2User });
      return updateDoc(doc(as(env, ALICE), `users/${ALICE}`), {
        name: "Alice B", partnerNumber: "02/2011", email: "alice@example.pt", gameboxNumber: "enc2",
      });
    },
  },
  {
    name: "GameBox por omissão atualiza o próprio users (screens/app/gamebox/gamexmanagementDefault.tsx:56)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { [`users/${ALICE}`]: v2User });
      return updateDoc(doc(as(env, ALICE), `users/${ALICE}`), {
        name: "Alice", partnerNumber: "01/2010", email: "alice@example.pt", gameboxNumber: "enc2",
        gameboxLine: "1", gameboxPort: "10", gameboxSeat: "5", gameboxSector: "A",
      });
    },
  },
  {
    name: "apagar conta apaga o próprio users (screens/app/definitions.tsx:106-108)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { [`users/${ALICE}`]: v2User });
      return deleteDoc(doc(as(env, ALICE), `users/${ALICE}`));
    },
  },

  // GameBox
  {
    name: "lista de GameBox where userid com sessão (screens/app/home.tsx:174, gamebox/gameboxList.tsx:41, gamebox/gamexmanagement.tsx:187)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "gamebox/gb1": v2Gamebox() });
      return getDocs(query(collection(as(env, ALICE), "gamebox"), where("userid", "==", ALICE)));
    },
  },
  {
    name: "lista de GameBox where userid sem sessão, depois do login por PIN (screens/app/home.tsx:174)",
    afterLaunch: "denied",
    run: async (env) => {
      await seed(env, { "gamebox/gb1": v2Gamebox() });
      return getDocs(query(collection(anon(env), "gamebox"), where("userid", "==", ALICE)));
    },
  },
  {
    name: "criar GameBox com add (screens/app/gamebox/gamexmanagement.tsx:83, home.tsx:159)",
    afterLaunch: "allowed",
    run: (env) => addDoc(collection(as(env, ALICE), "gamebox"), v2Gamebox({ order: 2 })),
  },
  {
    name: "ler uma GameBox por id para editar (screens/app/gamebox/gamexmanagement.tsx:121-123)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "gamebox/gb1": v2Gamebox() });
      return getDoc(doc(as(env, ALICE), "gamebox/gb1"));
    },
  },
  {
    name: "editar GameBox (screens/app/gamebox/gamexmanagement.tsx:72)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "gamebox/gb1": v2Gamebox() });
      return updateDoc(doc(as(env, ALICE), "gamebox/gb1"), v2Gamebox({ gameboxName: "Outra", gameboxSeat: "6" }));
    },
  },
  {
    name: "reordenar GameBox (screens/app/gamebox/gameboxList.tsx:124)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "gamebox/gb1": v2Gamebox() });
      return updateDoc(doc(as(env, ALICE), "gamebox/gb1"), { order: 2 });
    },
  },
  {
    name: "apagar GameBox (screens/app/gamebox/gamexmanagement.tsx:137-140)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "gamebox/gb1": v2Gamebox() });
      return deleteDoc(doc(as(env, ALICE), "gamebox/gb1"));
    },
  },

  // Palpites, MVP e ranking antigos
  {
    name: "ler o próprio palpite (api/firebase/predictions.ts:33-37)",
    afterLaunch: "denied",
    run: async (env) => {
      await seed(env, { [`predictions/${GAME}_${ALICE}`]: { ...v2Prediction, createdAt: Timestamp.now() } });
      return getDoc(doc(as(env, ALICE), `predictions/${GAME}_${ALICE}`));
    },
  },
  {
    name: "ler o próprio palpite que ainda não existe (api/firebase/predictions.ts:33-37)",
    afterLaunch: "denied",
    run: (env) => getDoc(doc(as(env, ALICE), `predictions/${GAME}_${ALICE}`)),
  },
  {
    name: "palpite: criar predictions e +1 em rankings novo, numa transação (api/firebase/predictions.ts:53-80)",
    afterLaunch: "denied",
    run: (env) => v2VoteTransaction(as(env, ALICE), "predictions", v2Prediction),
  },
  {
    name: "palpite: criar predictions e +1 em rankings existente (api/firebase/predictions.ts:53-80)",
    afterLaunch: "denied",
    run: async (env) => {
      await seed(env, { [`rankings/${ALICE}_${SEASON}`]: { userId: ALICE, userName: "Alice", season: SEASON, points: 4 } });
      return v2VoteTransaction(as(env, ALICE), "predictions", v2Prediction);
    },
  },
  {
    name: "votos MVP do jogo where GameId (api/firebase/manOfTheMatch.ts:27-28)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { [`manofmatch/${GAME}_bob`]: { ...v2MvpVote, userId: "bob", id: `${GAME}_bob` } });
      return getDocs(query(collection(as(env, ALICE), "manofmatch"), where("GameId", "==", GAME)));
    },
  },
  {
    name: "voto MVP: criar manofmatch e +1 em rankings, numa transação (api/firebase/manOfTheMatch.ts:42-66)",
    afterLaunch: "denied",
    run: async (env) => {
      await seed(env, { [`rankings/${ALICE}_${SEASON}`]: { userId: ALICE, userName: "Alice", season: SEASON, points: 4 } });
      return v2VoteTransaction(as(env, ALICE), "manofmatch", v2MvpVote);
    },
  },
  {
    name: "ranking da época where season (api/firebase/ranking.ts:51-55)",
    afterLaunch: "denied",
    run: async (env) => {
      await seed(env, { [`rankings/bob_${SEASON}`]: { userId: "bob", userName: "Bob", season: SEASON, points: 7 } });
      return getDocs(query(collection(as(env, ALICE), "rankings"), where("season", "==", SEASON)));
    },
  },

  // Dados desportivos (leitura pública, sem sessão para cobrir o login por PIN)
  {
    name: "jogo por api (api/firebase/games.ts:28-29)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "games/g1": legacyGame });
      return getDocs(query(collection(anon(env), "games"), where("api", "==", GAME)));
    },
  },
  {
    name: "próximo jogo where timestamp >= orderBy limit 1 (api/firebase/games.ts:40-44)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "games/g1": legacyGame });
      return getDocs(query(collection(anon(env), "games"), where("timestamp", ">=", Timestamp.fromDate(new Date("2026-01-01"))), orderBy("timestamp"), limit(1)));
    },
  },
  {
    name: "jogos futuros e passados (api/firebase/games.ts:52-53, :61-62)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "games/g1": legacyGame });
      const ts = Timestamp.fromDate(new Date("2026-11-18"));
      await getDocs(query(collection(anon(env), "games"), where("timestamp", ">=", ts), orderBy("timestamp")));
      return getDocs(query(collection(anon(env), "games"), where("timestamp", "<", ts), orderBy("timestamp", "desc")));
    },
  },
  {
    name: "jogo ao vivo por id (screens/app/game/details.tsx:82-85)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "games/g1": legacyGame });
      return getDoc(doc(anon(env), "games/g1"));
    },
  },
  ...(
    [
      ["summaries", "api/firebase/summary.ts:27, screens/app/game/details.tsx:89-91"],
      ["stastistics", "api/firebase/stastics.ts:16, screens/app/game/details.tsx:96-98"],
      ["players", "api/firebase/players.ts:29, screens/app/game/details.tsx:103-105"],
      ["lineups", "api/firebase/lineups.ts:24, screens/app/game/details.tsx:109-111"],
      ["videos", "api/firebase/videos.ts:13"],
    ] as const
  ).map(([col, src]): V2Op => ({
    name: `${col} where GameId (${src})`,
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { [`${col}/x1`]: { GameId: GAME } });
      return getDocs(query(collection(anon(env), col), where("GameId", "==", GAME)));
    },
  })),
  {
    name: "classificação where competition (api/firebase/standings.ts:30-31)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "standings/s1": { competition: "94" } });
      return getDocs(query(collection(anon(env), "standings"), where("competition", "==", "94")));
    },
  },
  {
    name: "notícias orderBy created_at desc (api/firebase/news.ts:26-30, :37-41)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "news/n1": newsDoc });
      return getDocs(query(collection(anon(env), "news"), orderBy("created_at", "desc")));
    },
  },
  {
    name: "tweets orderBy created_at desc (screens/app/News.tsx:61-65)",
    afterLaunch: "allowed",
    run: async (env) => {
      await seed(env, { "tweets/t1": { created_at: Timestamp.now() } });
      return getDocs(query(collection(anon(env), "tweets"), orderBy("created_at", "desc")));
    },
  },
];

// --- App nova (7.0.0) -------------------------------------------------------------------------

const newGamebox = (over: Record<string, unknown> = {}) => ({
  gameboxNumber: "enc", gameboxName: "", gameboxPort: "10", gameboxSector: "A", gameboxLine: "1",
  gameboxSeat: "5", userid: ALICE, order: 1, ...over,
});
const matchDoc = { sport: "football", kickoff: Timestamp.fromDate(new Date("2026-11-22T20:30:00Z")), competition: { season: "2026" } };
const prediction = { userId: ALICE, gameId: GAME, home: 2, away: 1, source: "v2027", createdAt: Timestamp.now() };
const mvpVote = { userId: ALICE, gameId: GAME, playerId: "10", source: "v2027", createdAt: Timestamp.now() };
const pointEvent = (gameId: string) => ({ uid: ALICE, gameId, gameDate: Timestamp.now(), type: "prediction", points: 3 });

export const NEW_APP_OPS: RulesOp[] = [
  // Configuração e perfil
  {
    name: "config/app sem sessão (data/hooks.ts:146)",
    run: async (env) => {
      await seed(env, { "config/app": { minVersion: "7.0.0" } });
      return getDoc(doc(anon(env), "config/app"));
    },
  },
  {
    name: "publicProfiles/{uid} sem sessão (data/hooks.ts:150)",
    run: async (env) => {
      await seed(env, { "publicProfiles/bob": { displayName: "Sportinguista #1234", avatarId: null } });
      return getDoc(doc(anon(env), "publicProfiles/bob"));
    },
  },
  {
    name: "próprio users/{uid} (data/hooks.ts:154)",
    run: async (env) => {
      await seed(env, { [`users/${ALICE}`]: { name: "Alice", email: "alice@example.pt", displayName: "Leão" } });
      return getDoc(doc(as(env, ALICE), `users/${ALICE}`));
    },
  },
  {
    name: "próprio users/{uid} ainda inexistente, login social (services/social.ts:138-141)",
    run: (env) => getDoc(doc(as(env, ALICE), `users/${ALICE}`)),
  },
  {
    name: "registo cria users/{uid} {name, email, createdAt} em merge (services/auth.ts:34-38)",
    run: (env) =>
      setDoc(doc(as(env, ALICE), `users/${ALICE}`), { name: "Alice", email: "alice@example.pt", createdAt: serverTimestamp() }, { merge: true }),
  },
  {
    name: "login social cria users/{uid} em merge (services/social.ts:142-146)",
    run: (env) =>
      setDoc(doc(as(env, ALICE), `users/${ALICE}`), { createdAt: serverTimestamp(), name: "Alice", email: "alice@example.pt" }, { merge: true }),
  },
  {
    name: "perfil grava os campos permitidos em merge, sem displayName (services/userProfile.ts:41)",
    run: async (env) => {
      await seed(env, { [`users/${ALICE}`]: { name: "Alice", email: "alice@example.pt", displayName: "Leão", nameChangedAt: Timestamp.now() } });
      return setDoc(
        doc(as(env, ALICE), `users/${ALICE}`),
        {
          memberNumber: "12345", partnerNumber: "01/2010", seasonSeat: { port: "10", sector: "A", line: "1", seat: "5" },
          favoriteSport: "football", favoritePlayer: "10",
          notificationPrefs: { matchStart: true, goals: true, predictionReminder: true, mvpOpen: true, news: false },
        },
        { merge: true },
      );
    },
  },

  // Jogos, competições, equipa e recintos (sem sessão)
  {
    name: "matches/{id} (data/sports.ts:80)",
    run: async (env) => {
      await seed(env, { [`matches/${GAME}`]: matchDoc });
      return getDoc(doc(anon(env), `matches/${GAME}`));
    },
  },
  {
    name: "matches/{id}/details/{kind} (data/sports.ts:100)",
    run: async (env) => {
      await seed(env, { [`matches/${GAME}/details/events`]: { items: [] } });
      return getDoc(doc(anon(env), `matches/${GAME}/details/events`));
    },
  },
  {
    name: "matches/{id}/videos (data/sports.ts:112)",
    run: async (env) => {
      await seed(env, { [`matches/${GAME}/videos/v1`]: { publishedAt: Timestamp.now() } });
      return getDocs(collection(anon(env), `matches/${GAME}/videos`));
    },
  },
  {
    name: "próximos jogos where sport, kickoff >= orderBy limit (data/sports.ts:117-122)",
    run: async (env) => {
      await seed(env, { [`matches/${GAME}`]: matchDoc });
      return getDocs(query(collection(anon(env), "matches"), where("sport", "==", "football"),
        where("kickoff", ">=", new Date("2026-11-01")), orderBy("kickoff", "asc"), limit(40)));
    },
  },
  {
    name: "resultados where sport, kickoff < orderBy desc limit (data/sports.ts:139-144)",
    run: async (env) => {
      await seed(env, { [`matches/${GAME}`]: matchDoc });
      return getDocs(query(collection(anon(env), "matches"), where("sport", "==", "football"),
        where("kickoff", "<", new Date("2026-12-01")), orderBy("kickoff", "desc"), limit(40)));
    },
  },
  {
    name: "jogos da época where sport, competition.season (data/sports.ts:217-221)",
    run: async (env) => {
      await seed(env, { [`matches/${GAME}`]: matchDoc });
      return getDocs(query(collection(anon(env), "matches"), where("sport", "==", "football"), where("competition.season", "==", "2026")));
    },
  },
  {
    name: "competitions/{key} (data/sports.ts:164)",
    run: async (env) => {
      await seed(env, { "competitions/football_94_2026": { name: "Liga Portugal" } });
      return getDoc(doc(anon(env), "competitions/football_94_2026"));
    },
  },
  {
    name: "competitions/{key}/data/{kind} (data/sports.ts:194)",
    run: async (env) => {
      await seed(env, { "competitions/football_94_2026/data/standings": { groups: [] } });
      return getDoc(doc(anon(env), "competitions/football_94_2026/data/standings"));
    },
  },
  {
    name: "teams/football_228/data/{kind}, playerStats e teamStats (data/sports.ts:249, :254, :258)",
    run: async (env) => {
      await seed(env, { "teams/football_228/data/squad": { items: [] } });
      const db = anon(env);
      await getDoc(doc(db, "teams/football_228/data/squad"));
      await getDoc(doc(db, "teams/football_228/data/playerStats_2026"));
      return getDoc(doc(db, "teams/football_228/data/teamStats_94_2026"));
    },
  },
  {
    name: "venues/{id} (data/sports.ts:262)",
    run: async (env) => {
      await seed(env, { "venues/1": { name: "Alvalade" } });
      return getDoc(doc(anon(env), "venues/1"));
    },
  },
  {
    name: "mvpTallies/{gameId} (data/sports.ts:96)",
    run: async (env) => {
      await seed(env, { [`mvpTallies/${GAME}`]: { gameId: GAME, counts: { p10: 1 }, total: 1 } });
      return getDoc(doc(anon(env), `mvpTallies/${GAME}`));
    },
  },

  // Rankings
  {
    name: "leaderboard orderBy points desc limit 100 (data/user.ts:59-62)",
    run: async (env) => {
      await seed(env, { [`${LB}/bob`]: entry("bob", 9), [`${LB}/${ALICE}`]: entry(ALICE, 3) });
      return getDocs(query(collection(anon(env), LB), orderBy("points", "desc"), limit(100)));
    },
  },
  {
    name: "a própria entrada no leaderboard (data/user.ts:69)",
    run: async (env) => {
      await seed(env, { [`${LB}/${ALICE}`]: entry(ALICE, 3) });
      return getDoc(doc(as(env, ALICE), `${LB}/${ALICE}`));
    },
  },
  {
    name: "posição: count where points > (data/user.ts:74-75)",
    run: async (env) => {
      await seed(env, { [`${LB}/bob`]: entry("bob", 9), [`${LB}/${ALICE}`]: entry(ALICE, 3) });
      return getCountFromServer(query(collection(as(env, ALICE), LB), where("points", ">", 3)));
    },
  },

  // Palpite, voto MVP, liquidação e pontos do próprio
  {
    name: "próprio matchPredictions/{gameId}_{uid} (data/user.ts:82)",
    run: async (env) => {
      await seed(env, { [`matchPredictions/${GAME}_${ALICE}`]: prediction });
      return getDoc(doc(as(env, ALICE), `matchPredictions/${GAME}_${ALICE}`));
    },
  },
  {
    name: "próprio matchPredictions ainda inexistente, jogo sem palpite (data/user.ts:82)",
    run: (env) => getDoc(doc(as(env, ALICE), `matchPredictions/${GAME}_${ALICE}`)),
  },
  {
    name: "próprio mvpVotes/{gameId}_{uid} (data/user.ts:86)",
    run: async (env) => {
      await seed(env, { [`mvpVotes/${GAME}_${ALICE}`]: mvpVote });
      return getDoc(doc(as(env, ALICE), `mvpVotes/${GAME}_${ALICE}`));
    },
  },
  {
    name: "próprio mvpVotes ainda inexistente, jogo sem voto (data/user.ts:86)",
    run: (env) => getDoc(doc(as(env, ALICE), `mvpVotes/${GAME}_${ALICE}`)),
  },
  {
    name: "settlements/{gameId}, existente e por liquidar (data/user.ts:91)",
    run: async (env) => {
      await seed(env, { [`settlements/${GAME}`]: { gameId: GAME } });
      await getDoc(doc(as(env, ALICE), "settlements/m2"));
      return getDoc(doc(as(env, ALICE), `settlements/${GAME}`));
    },
  },
  {
    name: "settlements where documentId in (data/user.ts:174-175)",
    run: async (env) => {
      await seed(env, { [`settlements/${GAME}`]: { gameId: GAME } });
      return getDocs(query(collection(as(env, ALICE), "settlements"), where(documentId(), "in", [GAME, "m2"])));
    },
  },
  {
    name: "pointEvents where uid, gameId do próprio (data/user.ts:96-99)",
    run: async (env) => {
      await seed(env, { [`pointEvents/${ALICE}_${GAME}_prediction`]: pointEvent(GAME) });
      return getDocs(query(collection(as(env, ALICE), "pointEvents"), where("uid", "==", ALICE), where("gameId", "==", GAME)));
    },
  },
  {
    name: "pointEvents where uid orderBy gameDate desc limit 300 do próprio (data/user.ts:108-116)",
    run: async (env) => {
      await seed(env, { [`pointEvents/${ALICE}_${GAME}_prediction`]: pointEvent(GAME) });
      return getDocs(query(collection(as(env, ALICE), "pointEvents"), where("uid", "==", ALICE), orderBy("gameDate", "desc"), limit(300)));
    },
  },
  {
    name: "matchPredictions where userId orderBy createdAt desc limit 100 do próprio (data/user.ts:127-135)",
    run: async (env) => {
      await seed(env, { [`matchPredictions/${GAME}_${ALICE}`]: prediction });
      return getDocs(query(collection(as(env, ALICE), "matchPredictions"), where("userId", "==", ALICE), orderBy("createdAt", "desc"), limit(100)));
    },
  },

  // Notícias
  {
    name: "notícias orderBy publishedAt desc limit 40, todas e por modalidade (data/user.ts:211-214)",
    run: async (env) => {
      await seed(env, { "news/n1": newsDoc });
      const base = collection(anon(env), "news");
      await getDocs(query(base, where("sport", "==", "football"), orderBy("publishedAt", "desc"), limit(40)));
      return getDocs(query(base, orderBy("publishedAt", "desc"), limit(40)));
    },
  },

  // GameBox
  {
    name: "as próprias GameBox where userid (data/user.ts:225)",
    run: async (env) => {
      await seed(env, { "gamebox/gb1": newGamebox() });
      return getDocs(query(collection(as(env, ALICE), "gamebox"), where("userid", "==", ALICE)));
    },
  },
  {
    name: "criar GameBox com setDoc num id novo (services/gamebox.ts:76-78)",
    run: (env) => setDoc(doc(collection(as(env, ALICE), "gamebox")), newGamebox({ order: 2 })),
  },
  {
    name: "repetir GameBox no reservedId cuja escrita já chegou (services/gamebox.ts:76-78)",
    run: async (env) => {
      await seed(env, { "gamebox/gb9": newGamebox({ order: 2 }) });
      return setDoc(doc(as(env, ALICE), "gamebox/gb9"), newGamebox({ order: 2, gameboxName: "Casa" }));
    },
  },
  {
    name: "editar GameBox com updateDoc e deleteField nos pavilion* (services/gamebox.ts:70-73)",
    run: async (env) => {
      await seed(env, { "gamebox/gb1": newGamebox({ pavilionPort: "1", pavilionSector: "B", pavilionLine: "2", pavilionSeat: "3" }) });
      return updateDoc(doc(as(env, ALICE), "gamebox/gb1"), {
        ...newGamebox({ gameboxSeat: "6" }),
        pavilionPort: deleteField(), pavilionSector: deleteField(), pavilionLine: deleteField(), pavilionSeat: deleteField(),
      });
    },
  },
  {
    name: "apagar GameBox (services/gamebox.ts:83)",
    run: async (env) => {
      await seed(env, { "gamebox/gb1": newGamebox() });
      return deleteDoc(doc(as(env, ALICE), "gamebox/gb1"));
    },
  },
];
