import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import { clearAll } from "../helpers/emulatorDb";
import { seedFootballMatch } from "../helpers/seedMatch";
import type { MatchDoc } from "../../src/model/types";
import { handleCreateLoan, handleClaimLoan } from "../../src/callables/loans";
import { cancelLoansForGamebox, cancelLoansForUser, cancelLoansOnGameboxEdit, maintainLoans, purgeOldLoans } from "../../src/loans/lifecycle";

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
// Ids de GameBox únicos por teste: o onGameboxDeleted do emulador (disparado pelo clearAll) nunca toca nos empréstimos do teste seguinte.
let seq = 0;
let G1 = "g1";
let G2 = "g2";
beforeEach(async () => {
  seq++;
  G1 = `g1_${seq}_${Date.now()}`;
  G2 = `g2_${seq}_${Date.now()}`;
  await clearAll(db);
  await db.doc("publicProfiles/alice").set({ displayName: "Alice A." });
  await db.doc("publicProfiles/bob").set({ displayName: "Bruno B." });
  await db.doc(`gamebox/${G1}`).set({ userid: "alice", gameboxNumber: "cifrado", gameboxPort: "10", gameboxSector: "A", gameboxLine: "3", gameboxSeat: "7" });
  await seedNs("m1", K1);
});

function seedNs(id: string, kickoff: Date, over: Partial<MatchDoc> = {}) {
  return seedFootballMatch(db, {
    id, kickoff, status: "NS", statusRaw: "NS", elapsed: null,
    score: { home: null, away: null, halftime: null, extratime: null, penalty: null },
    finishedAt: null, finishedAtSource: null, ...over,
  });
}
const create = async () => (await handleCreateLoan(db, alice, { gameboxId: G1, matchId: "m1", number: NUM }, NOW)).loanId;
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

  it("jogo remarcado: match.kickoff do cartão segue a hora nova (e só os campos de apresentação)", async () => {
    const id = await create();
    const before = await loanOf(id);
    const moved = new Date("2026-11-22T18:00:00Z");
    await db.doc("matches/m1").update({ kickoff: Timestamp.fromDate(moved), home: { id: "228", name: "Outro nome", logo: null } });
    await maintainLoans(db, NOW);
    const after = await loanOf(id);
    expect(after.match.kickoff.toDate()).toEqual(moved);
    expect(after.match.homeName).toBe(before.match.homeName);
    expect(after.seat).toEqual(before.seat);
    expect(await expiry(id)).toEqual(new Date(moved.getTime() + 4 * H));
    // idempotente
    const again = await maintainLoans(db, NOW);
    expect(again.count).toBe(0);
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
    await db.doc(`gamebox/${G1}`).delete();
    expect(await cancelLoansForGamebox(db, G1, NOW)).toBe(1);
    expect((await loanOf(id)).cancelledAt?.toDate()).toEqual(NOW);
    expect((await loanOf(id)).cancelReason).toBe("gamebox-deleted");
    expect(await hasSecret(id)).toBe(false);
    const before = await loanOf(id);
    expect(await cancelLoansForGamebox(db, G1, NOW)).toBe(0);
    expect(await loanOf(id)).toEqual(before);
  });

  it("apagar conta do dono e do destinatário: cancelados e segredos apagados", async () => {
    const a = await create();
    await handleClaimLoan(db, bob, { loanId: a }, NOW);
    expect(await cancelLoansForUser(db, "bob", NOW)).toBe(1);
    expect((await loanOf(a)).cancelledAt?.toDate()).toEqual(NOW);
    expect((await loanOf(a)).cancelReason).toBe("recipient-left");
    expect(await hasSecret(a)).toBe(false);

    await db.doc(`loans/${a}`).update({ cancelledAt: null });
    await db.doc(`loans/${a}/secret/number`).set({ number: NUM });
    expect(await cancelLoansForUser(db, "alice", NOW)).toBe(1);
    expect((await loanOf(a)).cancelReason).toBe("owner-left");
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

describe("GameBox editada (onGameboxUpdated)", () => {
  const edit = async (patch: Record<string, unknown>) => {
    // Em memória: não se escreve em `gamebox` para o gatilho real do emulador não correr em paralelo com o teste.
    const before = (await db.doc(`gamebox/${G1}`).get()).data()!;
    const after = { ...before, ...patch };
    cur = after;
    return cancelLoansOnGameboxEdit(db, G1, before, after, NOW);
  };
  let cur: Record<string, unknown> = {};

  it.each([
    ["gameboxPort", "11"],
    ["gameboxSector", "B"],
    ["gameboxLine", "4"],
    ["gameboxSeat", "8"],
    ["pavilionPort", "P2"],
    ["pavilionSector", "S1"],
    ["pavilionLine", "1"],
    ["pavilionSeat", "5"],
  ])("alterar %s cancela o empréstimo ativo e apaga o número", async (field, value) => {
    const id = await create();
    expect(await edit({ [field]: value })).toBe(1);
    expect((await loanOf(id)).cancelledAt?.toDate()).toEqual(NOW);
    expect((await loanOf(id)).cancelReason).toBe("gamebox-edited");
    expect(await hasSecret(id)).toBe(false);
  });

  it("alterar o número (decifrado diferente) cancela; o mesmo número recifrado com outro sal não", async () => {
    // Textos cifrados como a app os grava (uid alice, passphrase da V2): "123456" com dois sais e "99887766".
    const A1 = "U2FsdGVkX1/vd1DTYimXqOeGA+i/5z4NUrPxrQBzVOs=";
    const A2 = "U2FsdGVkX19liQxttLz4O060jf8EJnATmLGdShr22Xg=";
    const B = "U2FsdGVkX1+QuCRwjCR1Tnxd8/1kNV0FtKlekKh2Sx8=";
    const id = await create();
    const base = { userid: "alice", gameboxNumber: A1, gameboxPort: "10" };
    expect(await cancelLoansOnGameboxEdit(db, G1, base, { ...base, gameboxNumber: A2 }, NOW)).toBe(0);
    expect((await loanOf(id)).cancelledAt).toBeNull();
    expect(await hasSecret(id)).toBe(true);
    expect(await cancelLoansOnGameboxEdit(db, G1, base, { ...base, gameboxNumber: B }, NOW)).toBe(1);
    expect((await loanOf(id)).cancelledAt?.toDate()).toEqual(NOW);
    expect(await hasSecret(id)).toBe(false);
  });

  it("nome, ordem e valores equivalentes (vazio, espaços) não cancelam", async () => {
    const id = await create();
    expect(await edit({ gameboxName: "Outro nome", order: 7 })).toBe(0);
    expect(await cancelLoansOnGameboxEdit(db, G1, cur, { ...cur, gameboxPort: " 10 " }, NOW)).toBe(0);
    expect((await loanOf(id)).cancelledAt).toBeNull();
    expect(await hasSecret(id)).toBe(true);
  });

  it("idempotente: repetir não altera o cancelamento", async () => {
    const id = await create();
    await edit({ gameboxSeat: "9" });
    const before = await loanOf(id);
    expect(await cancelLoansOnGameboxEdit(db, G1, { gameboxSeat: "7" }, { gameboxSeat: "9" }, new Date(NOW.getTime() + 5000))).toBe(0);
    expect(await loanOf(id)).toEqual(before);
  });
});

describe("limpeza dos empréstimos (7 dias)", () => {
  const D = 24 * H;
  const exists = async (id: string) => (await db.doc(`loans/${id}`).get()).exists;
  const age = async (id: string, expiresAgo: number, cancelledAgo: number | null) => {
    await db.doc(`loans/${id}`).update({
      expiresAt: Timestamp.fromMillis(NOW.getTime() - expiresAgo),
      cancelledAt: cancelledAgo === null ? null : Timestamp.fromMillis(NOW.getTime() - cancelledAgo),
    });
    await db.doc(`loans/${id}/secret/number`).set({ number: NUM });
  };

  it("7 dias depois de expirar: apagado; antes: mantido", async () => {
    const a = await create();
    await age(a, 7 * D, null);
    const r = await maintainLoans(db, NOW);
    expect(await exists(a)).toBe(false);
    expect(await hasSecret(a)).toBe(false);
    expect(r.failed).toBe(0);
    expect(r.count).toBeGreaterThanOrEqual(1);

    const b = await create();
    await age(b, 7 * D - 60_000, null);
    await maintainLoans(db, NOW);
    expect(await exists(b)).toBe(true);
  });

  it("cancelado há 7 dias: apagado, mesmo com a validade no futuro; cancelado há menos: mantido", async () => {
    const a = await create();
    await db.doc(`loans/${a}`).update({ cancelledAt: Timestamp.fromMillis(NOW.getTime() - 7 * D), cancelReason: "owner" });
    await maintainLoans(db, NOW);
    expect(await exists(a)).toBe(false);
    expect(await hasSecret(a)).toBe(false);

    const b = await create();
    await db.doc(`loans/${b}`).update({ cancelledAt: Timestamp.fromMillis(NOW.getTime() - 7 * D + 60_000), cancelReason: "owner" });
    await maintainLoans(db, NOW);
    expect(await exists(b)).toBe(true);
  });

  it("expirado há muito mas cancelado há pouco: conta o que vier primeiro (a expiração)", async () => {
    const a = await create();
    await age(a, 8 * D, 1 * D);
    await maintainLoans(db, NOW);
    expect(await exists(a)).toBe(false);
  });

  it("idempotente e sem erro quando já não há nada", async () => {
    const a = await create();
    await age(a, 9 * D, null);
    await maintainLoans(db, NOW);
    expect(await maintainLoans(db, NOW)).toEqual({ count: 0, failed: 0 });
  });

  it("um atraso grande: cada execução apaga no máximo o limite por consulta e a seguinte continua", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = `old${i}_${seq}_${Date.now()}`.padEnd(22, "x");
      ids.push(id);
      await db.doc(`loans/${id}`).set({ expiresAt: Timestamp.fromMillis(NOW.getTime() - 9 * D), cancelledAt: null });
      await db.doc(`loans/${id}/secret/number`).set({ number: NUM });
    }
    expect(await purgeOldLoans(db, NOW, 2)).toEqual({ deleted: 2, failed: 0 });
    expect((await db.collection("loans").get()).size).toBe(3);
    expect(await purgeOldLoans(db, NOW, 2)).toEqual({ deleted: 2, failed: 0 });
    expect(await purgeOldLoans(db, NOW, 2)).toEqual({ deleted: 1, failed: 0 });
    expect((await db.collection("loans").get()).size).toBe(0);
    for (const id of ids) expect(await hasSecret(id)).toBe(false);
  });
});
