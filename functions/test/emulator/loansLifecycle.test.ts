import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import { clearAll } from "../helpers/emulatorDb";
import { seedFootballMatch } from "../helpers/seedMatch";
import type { MatchDoc } from "../../src/model/types";
import { handleCreateLoan, handleClaimLoan } from "../../src/callables/loans";
import { cancelLoansForGamebox, cancelLoansForUser, maintainLoans } from "../../src/loans/lifecycle";

let db: Firestore;
const NOW = new Date("2026-11-19T12:00:00Z");
const H = 3600_000;
const K1 = new Date("2026-11-21T20:00:00Z");
const alice = { uid: "alice" };
const bob = { uid: "bob" };
const NUM = "2665 7127 6572";

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  db = getFirestore(initializeApp({ projectId: "demo-scp360" }, "loans-lifecycle-test"));
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});
beforeEach(async () => {
  await clearAll(db);
  // O emulador corre onGameboxDeleted para as GameBoxes apagadas pelo clearAll; esperar que acabe para não tocar nos empréstimos do teste seguinte.
  await new Promise((r) => setTimeout(r, 700));
  await db.doc("publicProfiles/alice").set({ displayName: "Alice A." });
  await db.doc("publicProfiles/bob").set({ displayName: "Bruno B." });
  await db.doc("gamebox/g1").set({ userid: "alice", gameboxNumber: "cifrado", gameboxPort: "10", gameboxSector: "A", gameboxLine: "3", gameboxSeat: "7" });
  await seedNs("m1", K1);
});

function seedNs(id: string, kickoff: Date, over: Partial<MatchDoc> = {}) {
  return seedFootballMatch(db, {
    id, kickoff, status: "NS", statusRaw: "NS", elapsed: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null, finishedAtSource: null, ...over,
  });
}
const create = async () => (await handleCreateLoan(db, alice, { gameboxId: "g1", matchId: "m1", number: NUM }, NOW)).loanId;
const loanOf = async (id: string) => (await db.doc(`loans/${id}`).get()).data()!;
const hasSecret = async (id: string) => (await db.doc(`loans/${id}/secret/number`).get()).exists;
const expiry = async (id: string) => (await loanOf(id)).expiresAt.toDate() as Date;

describe("maintainLoans", () => {
  it("jogo remarcado antes de começar: expiresAt segue a nova hora + 4 h", async () => {
    const id = await create();
    const moved = new Date("2026-11-22T18:00:00Z");
    await db.doc("matches/m1").update({ kickoff: Timestamp.fromDate(moved) });
    await maintainLoans(db, NOW);
    expect(await expiry(id)).toEqual(new Date(moved.getTime() + 4 * H));
    expect(await hasSecret(id)).toBe(true);
  });

  it("jogo FT com finishedAt: fim + 2 h; número mantido enquanto dentro da validade", async () => {
    const id = await create();
    const fin = new Date(NOW.getTime() - 30 * 60_000);
    await db.doc("matches/m1").update({ status: "FT", statusRaw: "FT", finishedAt: Timestamp.fromDate(fin), kickoff: Timestamp.fromDate(new Date(NOW.getTime() - 2 * H)) });
    await maintainLoans(db, NOW);
    expect(await expiry(id)).toEqual(new Date(fin.getTime() + 2 * H));
    expect(await hasSecret(id)).toBe(true);
  });

  it("expirado: segredo apagado e documento mantido", async () => {
    const id = await create();
    const fin = new Date(NOW.getTime() - 3 * H);
    await db.doc("matches/m1").update({ status: "FT", statusRaw: "FT", finishedAt: Timestamp.fromDate(fin) });
    await maintainLoans(db, NOW);
    expect(await expiry(id)).toEqual(new Date(fin.getTime() + 2 * H));
    expect(await hasSecret(id)).toBe(false);
    expect((await db.doc(`loans/${id}`).get()).exists).toBe(true);
    expect((await loanOf(id)).cancelledAt).toBeNull();
  });

  it("um empréstimo já expirado não é ressuscitado por uma remarcação posterior", async () => {
    const id = await create();
    await db.doc(`loans/${id}`).update({ expiresAt: Timestamp.fromMillis(NOW.getTime() - H) });
    await db.doc("matches/m1").update({ kickoff: Timestamp.fromDate(new Date("2026-11-25T20:00:00Z")) });
    await maintainLoans(db, NOW);
    expect(await hasSecret(id)).toBe(false);
    expect((await expiry(id)).getTime()).toBe(NOW.getTime() - H);
  });

  it("jogo apagado: mantém a validade guardada e o número", async () => {
    const id = await create();
    await db.doc("matches/m1").delete();
    await maintainLoans(db, NOW);
    expect(await expiry(id)).toEqual(new Date(K1.getTime() + 4 * H));
    expect(await hasSecret(id)).toBe(true);
  });

  it("idempotente: segunda execução seguida não altera nada", async () => {
    const id = await create();
    await db.doc("matches/m1").update({ status: "CANC", statusRaw: "CANC", kickoff: Timestamp.fromDate(new Date(NOW.getTime() - 5 * H)) });
    const first = await maintainLoans(db, NOW);
    expect(first.count).toBe(1);
    const before = await loanOf(id);
    const second = await maintainLoans(db, NOW);
    expect(second).toEqual({ count: 0, failed: 0 });
    expect(await loanOf(id)).toEqual(before);
    expect(await hasSecret(id)).toBe(false);
  });
});

describe("cancelamentos", () => {
  it("GameBox apagada: empréstimo cancelado e segredo apagado", async () => {
    const id = await create();
    await db.doc("gamebox/g1").delete();
    expect(await cancelLoansForGamebox(db, "g1", NOW)).toBe(1);
    expect((await loanOf(id)).cancelledAt?.toDate()).toEqual(NOW);
    expect(await hasSecret(id)).toBe(false);
    const before = await loanOf(id);
    expect(await cancelLoansForGamebox(db, "g1", NOW)).toBe(0);
    expect(await loanOf(id)).toEqual(before);
  });

  it("apagar conta do dono e do destinatário: cancelados e segredos apagados", async () => {
    const a = await create();
    await handleClaimLoan(db, bob, { loanId: a }, NOW);
    expect(await cancelLoansForUser(db, "bob", NOW)).toBe(1);
    expect((await loanOf(a)).cancelledAt?.toDate()).toEqual(NOW);
    expect(await hasSecret(a)).toBe(false);

    await db.doc(`loans/${a}`).update({ cancelledAt: null });
    await db.doc(`loans/${a}/secret/number`).set({ number: NUM });
    expect(await cancelLoansForUser(db, "alice", NOW)).toBe(1);
    expect(await hasSecret(a)).toBe(false);
    expect(await cancelLoansForUser(db, "alice", NOW)).toBe(0);
  });

  it("apagar conta limpa os dados pessoais no papel de destinatário, também em empréstimo já cancelado", async () => {
    const id = await create();
    await handleClaimLoan(db, bob, { loanId: id }, NOW);
    await db.doc(`loans/${id}`).update({ cancelledAt: Timestamp.fromDate(NOW) });
    await cancelLoansForUser(db, "bob", NOW);
    const l = await loanOf(id);
    expect(l.recipientUid).toBeNull();
    expect(l.recipientName).toBeNull();
    expect(l.ownerUid).toBe("alice");
    expect(await hasSecret(id)).toBe(false);
  });

  it("apagar conta limpa os dados pessoais no papel de dono, também em empréstimo expirado", async () => {
    const id = await create();
    await db.doc(`loans/${id}`).update({ expiresAt: Timestamp.fromMillis(NOW.getTime() - H) });
    await cancelLoansForUser(db, "alice", NOW);
    const l = await loanOf(id);
    expect(l.ownerUid).toBeNull();
    expect(l.ownerName).toBeNull();
    expect(l.cancelledAt).toBeNull();
    expect(await hasSecret(id)).toBe(false);
    expect(await cancelLoansForUser(db, "alice", NOW)).toBe(0);
  });
});
