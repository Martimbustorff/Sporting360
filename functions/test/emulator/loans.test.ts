import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { clearAll } from "../helpers/emulatorDb";
import { seedFootballMatch } from "../helpers/seedMatch";
import type { MatchDoc } from "../../src/model/types";
import { handleCreateLoan, handleClaimLoan, handleCancelLoan } from "../../src/callables/loans";

let db: Firestore;
const NOW = new Date("2026-11-19T12:00:00Z");
const K1 = new Date("2026-11-21T20:00:00Z");
const K2 = new Date("2026-11-28T20:00:00Z");
const alice = { uid: "alice" };
const bob = { uid: "bob" };
const carol = { uid: "carol" };
const NUM = "2665 7127 6572";

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  const app = initializeApp({ projectId: "demo-scp360" }, "loans-test");
  db = getFirestore(app);
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
  await db.doc("publicProfiles/alice").set({ displayName: "Alice A." });
  await db.doc("publicProfiles/bob").set({ displayName: "Bruno B." });
  await db.doc("gamebox/g1").set({
    userid: "alice", gameboxNumber: "cifrado", gameboxName: "Minha",
    gameboxPort: "10", gameboxSector: "A", gameboxLine: "3", gameboxSeat: "7",
    pavilionPort: "P1", pavilionSector: "", pavilionLine: "2", pavilionSeat: "9",
  });
  await db.doc("gamebox/g2").set({ userid: "bob", gameboxNumber: "x", gameboxPort: "", gameboxSector: "", gameboxLine: "", gameboxSeat: "" });
  await seedNs("m1", K1);
  await seedNs("m2", K2);
});

function seedNs(id: string, kickoff: Date, over: Partial<MatchDoc> = {}) {
  return seedFootballMatch(db, {
    id, kickoff, status: "NS", statusRaw: "NS", elapsed: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null, finishedAtSource: null, ...over,
  });
}
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    const x = e as { code?: string; details?: { reason?: string } };
    return { code: x.code, reason: x.details?.reason };
  }
  return null;
};
const create = (auth: { uid: string } | undefined, over: Record<string, unknown> = {}) =>
  handleCreateLoan(db, auth, { gameboxId: "g1", matchId: "m1", number: NUM, ...over }, NOW);
const loanOf = async (id: string) => (await db.doc(`loans/${id}`).get()).data()!;
const secretOf = async (id: string) => (await db.doc(`loans/${id}/secret/number`).get()).data();

describe("createLoan: validação", () => {
  it("sem sessão: unauthenticated", async () => {
    expect((await code(create(undefined)))?.code).toBe("unauthenticated");
  });
  it("GameBox de outro dono: permission-denied; inexistente: not-found", async () => {
    expect((await code(create(alice, { gameboxId: "g2" })))?.code).toBe("permission-denied");
    expect((await code(create(alice, { gameboxId: "nope" })))?.code).toBe("not-found");
  });
  it("jogo inexistente: not-found", async () => {
    expect((await code(create(alice, { matchId: "nope" })))?.code).toBe("not-found");
  });
  it("jogo terminado: finished", async () => {
    await seedFootballMatch(db, { id: "mf", kickoff: new Date("2026-11-15T20:00:00Z") });
    expect(await code(create(alice, { matchId: "mf" }))).toEqual({ code: "failed-precondition", reason: "finished" });
  });
  it("jogo fora de casa: not-home", async () => {
    await seedNs("ma", new Date("2026-11-20T20:00:00Z"), {
      sportingSide: "away", home: { id: "211", name: "Benfica", logo: null }, away: { id: "228", name: "Sporting CP", logo: null },
    });
    expect(await code(create(alice, { matchId: "ma" }))).toEqual({ code: "failed-precondition", reason: "not-home" });
  });
  it("jogo em casa que não é o próximo: not-next", async () => {
    expect(await code(create(alice, { matchId: "m2" }))).toEqual({ code: "failed-precondition", reason: "not-next" });
  });
  it("o próximo é por recinto: o futebol não conta para o pavilhão", async () => {
    await seedNs("b1", K2, { sport: "basketball" });
    const r = await create(alice, { matchId: "b1" });
    expect((await loanOf(r.loanId)).match.venue).toBe("pavilion");
  });
  it("um jogo em casa já começado e não terminado é o próximo", async () => {
    await seedNs("live", new Date("2026-11-19T10:00:00Z"), { status: "LIVE", statusRaw: "1H", elapsed: 30 });
    expect((await code(create(alice, { matchId: "m1" })))?.reason).toBe("not-next");
    const r = await create(alice, { matchId: "live" });
    expect((await loanOf(r.loanId)).expiresAt.toDate()).toEqual(new Date("2026-11-19T14:00:00Z"));
  });
  it.each(["", "   ", "12345", "abc123456", "1".repeat(21), 123456789, undefined])("número %p: invalid-argument", async (n) => {
    expect((await code(create(alice, { number: n })))?.code).toBe("invalid-argument");
  });
  it("ids em falta ou com barra: invalid-argument", async () => {
    expect((await code(create(alice, { gameboxId: "a/b" })))?.code).toBe("invalid-argument");
    expect((await code(create(alice, { matchId: "" })))?.code).toBe("invalid-argument");
  });
});

describe("createLoan: sucesso", () => {
  it("cria o empréstimo com tudo congelado, o segredo e o url", async () => {
    const r = await create(alice);
    expect(r.url).toBe(`https://s360-prognostico-download.web.app/e/${r.loanId}`);
    const l = await loanOf(r.loanId);
    expect(l).toMatchObject({
      ownerUid: "alice", ownerName: "Alice A.", gameboxId: "g1", matchId: "m1", sport: "football",
      recipientUid: null, recipientName: null, openedAt: null, cancelledAt: null,
      seat: { gate: "10", sector: "A", row: "3", seat: "7" },
      match: { homeName: "Sporting CP", awayName: "Benfica", homeLogo: null, awayLogo: null, competition: "Primeira Liga", venue: "stadium" },
    });
    expect(l.match.kickoff.toDate()).toEqual(K1);
    expect(l.expiresAt.toDate()).toEqual(new Date(K1.getTime() + 4 * 3600_000));
    expect(l.createdAt.toDate()).toEqual(NOW);
    expect(await secretOf(r.loanId)).toEqual({ number: "266571276572" });
  });
  it("pavilhão para as outras modalidades, campos vazios a null", async () => {
    await seedNs("b1", K1, { sport: "basketball" });
    const r = await create(alice, { matchId: "b1" });
    const l = await loanOf(r.loanId);
    expect(l.sport).toBe("basketball");
    expect(l.seat).toEqual({ gate: "P1", sector: null, row: "2", seat: "9" });
    expect(l.match.venue).toBe("pavilion");
  });
  it("sem lugar do pavilhão: tudo null", async () => {
    await seedNs("b1", K1, { sport: "futsal" });
    await db.doc("gamebox/g3").set({ userid: "alice", gameboxNumber: "x" });
    const r = await create(alice, { gameboxId: "g3", matchId: "b1" });
    expect((await loanOf(r.loanId)).seat).toEqual({ gate: null, sector: null, row: null, seat: null });
  });
  it("PST por começar encurta para início + 2 h", async () => {
    await db.doc("matches/m1").update({ status: "PST" });
    const r = await create(alice);
    expect((await loanOf(r.loanId)).expiresAt.toDate()).toEqual(new Date(K1.getTime() + 2 * 3600_000));
  });
  it("não escreve nos documentos gamebox", async () => {
    const before = (await db.doc("gamebox/g1").get()).updateTime;
    await create(alice);
    expect((await db.doc("gamebox/g1").get()).updateTime).toEqual(before);
  });
  it("segundo createLoan com um ativo: already-exists; depois de cancelar cria outro", async () => {
    const r = await create(alice);
    expect((await code(create(alice)))?.code).toBe("already-exists");
    await handleCancelLoan(db, alice, { loanId: r.loanId }, NOW);
    const r2 = await create(alice);
    expect(r2.loanId).not.toBe(r.loanId);
  });
  it("um empréstimo expirado não bloqueia", async () => {
    const r = await create(alice);
    await db.doc(`loans/${r.loanId}`).update({ expiresAt: Timestamp.fromDate(new Date(NOW.getTime() - 1000)) });
    await create(alice);
  });
});

describe("claimLoan", () => {
  let id: string;
  beforeEach(async () => {
    id = (await create(alice)).loanId;
  });
  it("sem sessão, id inválido, inexistente", async () => {
    expect((await code(handleClaimLoan(db, undefined, { loanId: id }, NOW)))?.code).toBe("unauthenticated");
    expect((await code(handleClaimLoan(db, bob, { loanId: "a/b" }, NOW)))?.code).toBe("invalid-argument");
    expect((await code(handleClaimLoan(db, bob, { loanId: "A".repeat(22) }, NOW)))?.code).toBe("not-found");
  });
  it("a primeira conta prende; a segunda chamada não muda openedAt", async () => {
    expect(await handleClaimLoan(db, bob, { loanId: id }, NOW)).toEqual({ status: "claimed" });
    const l = await loanOf(id);
    expect(l.recipientUid).toBe("bob");
    expect(l.recipientName).toBe("Bruno B.");
    expect(l.openedAt.toDate()).toEqual(NOW);
    const later = new Date(NOW.getTime() + 60_000);
    expect(await handleClaimLoan(db, bob, { loanId: id }, later)).toEqual({ status: "claimed" });
    expect((await loanOf(id)).openedAt.toDate()).toEqual(NOW);
  });
  it("outra conta: claimed-by-other", async () => {
    await handleClaimLoan(db, bob, { loanId: id }, NOW);
    expect(await code(handleClaimLoan(db, carol, { loanId: id }, NOW))).toEqual({ code: "failed-precondition", reason: "claimed-by-other" });
    expect((await loanOf(id)).recipientUid).toBe("bob");
  });
  it("o dono: owner, sem prender", async () => {
    expect(await handleClaimLoan(db, alice, { loanId: id }, NOW)).toEqual({ status: "owner" });
    const l = await loanOf(id);
    expect(l.recipientUid).toBeNull();
    expect(l.openedAt).toBeNull();
  });
  it("cancelado ou expirado: inactive", async () => {
    const later = new Date(K1.getTime() + 5 * 3600_000);
    expect(await code(handleClaimLoan(db, bob, { loanId: id }, later))).toEqual({ code: "failed-precondition", reason: "inactive" });
    await handleCancelLoan(db, alice, { loanId: id }, NOW);
    expect(await code(handleClaimLoan(db, bob, { loanId: id }, NOW))).toEqual({ code: "failed-precondition", reason: "inactive" });
  });
  it("sem perfil público, o nome cai para Sportinguista #xxxx", async () => {
    await handleClaimLoan(db, { uid: "zzzz1234" }, { loanId: id }, NOW);
    expect((await loanOf(id)).recipientName).toBe("Sportinguista #1234");
  });
});

describe("cancelLoan", () => {
  it("sem sessão, inexistente, outra conta, dono", async () => {
    const { loanId } = await create(alice);
    expect((await code(handleCancelLoan(db, undefined, { loanId }, NOW)))?.code).toBe("unauthenticated");
    expect((await code(handleCancelLoan(db, alice, { loanId: "A".repeat(22) }, NOW)))?.code).toBe("not-found");
    expect((await code(handleCancelLoan(db, bob, { loanId }, NOW)))?.code).toBe("permission-denied");
    expect((await loanOf(loanId)).cancelledAt).toBeNull();
    expect(await secretOf(loanId)).toBeDefined();
    expect(await handleCancelLoan(db, alice, { loanId }, NOW)).toEqual({ ok: true });
    expect((await loanOf(loanId)).cancelledAt.toDate()).toEqual(NOW);
    expect(await secretOf(loanId)).toBeUndefined();
    // repetir é inofensivo e não mexe na hora
    await handleCancelLoan(db, alice, { loanId }, new Date(NOW.getTime() + 1000));
    expect((await loanOf(loanId)).cancelledAt.toDate()).toEqual(NOW);
  });
});

describe("logs", () => {
  it("nenhum log com uid, email, nomes ou número", async () => {
    const spies = (["debug", "info", "log", "warn", "error", "write"] as const).map((k) => jest.spyOn(logger, k).mockImplementation(() => undefined));
    const { loanId } = await create(alice);
    await handleClaimLoan(db, bob, { loanId }, NOW);
    await code(handleClaimLoan(db, carol, { loanId }, NOW));
    await handleCancelLoan(db, alice, { loanId }, NOW);
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const secret of ["alice", "bob", "carol", "Alice A.", "Bruno B.", "266571276572", "@"]) expect(logged).not.toContain(secret);
    spies.forEach((s) => s.mockRestore());
  });
});
