import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, type Firestore, type DocumentReference } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

/** Idade máxima (s) do último login para permitir apagar a conta. */
export const REAUTH_MAX_AGE_S = 300;

/**
 * Apaga todos os dados do utilizador e a conta de Auth.
 * Idempotente: repetir devolve `deleted: 0`; `auth/user-not-found` conta como sucesso.
 * Os dados são apagados (não anonimizados): `users` guarda o email e o ranking só tem `uid` + nome público.
 * Não toca em documentos de outros utilizadores nem em `settlements`.
 */
export async function handleDeleteAccount(
  db: Firestore,
  authAdmin: Auth,
  auth: { uid: string; token: { auth_time: number } } | undefined,
  nowSeconds: number,
): Promise<{ ok: true; deleted: number }> {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sessão necessária.");
  const uid = auth.uid;
  const authTime = auth.token?.auth_time;
  if (typeof authTime !== "number" || nowSeconds - authTime > REAUTH_MAX_AGE_S) {
    throw new HttpsError("failed-precondition", "REAUTH_REQUIRED");
  }

  // Invalida sessões antigas antes de apagar, para um cliente desatualizado não voltar a escrever.
  try {
    await authAdmin.revokeRefreshTokens(uid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw new HttpsError("internal", "AUTH_REVOKE_FAILED");
  }

  // Janela de corrida conhecida: um settlement a correr em paralelo pode recriar pointEvents/entries; repetir a chamada limpa-os.
  const refs = new Map<string, DocumentReference>();
  const add = (r: DocumentReference) => refs.set(r.path, r);

  const [userSnap, pubSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`publicProfiles/${uid}`).get()]);
  if (userSnap.exists) add(userSnap.ref);
  if (pubSnap.exists) add(pubSnap.ref);

  const queries = [
    db.collection("gamebox").where("userid", "==", uid),
    db.collection("matchPredictions").where("userId", "==", uid),
    db.collection("mvpVotes").where("userId", "==", uid),
    db.collection("predictions").where("userId", "==", uid),
    db.collection("manofmatch").where("userId", "==", uid),
    db.collection("rankings").where("userId", "==", uid),
    db.collection("pointEvents").where("uid", "==", uid),
    db.collection("point_events").where("userId", "==", uid),
    db.collectionGroup("entries").where("uid", "==", uid),
    db.collection(`users/${uid}/devices`),
  ];
  for (const snap of await Promise.all(queries.map((q) => q.get()))) {
    for (const d of snap.docs) add(d.ref);
  }

  if (refs.size > 0) {
    const writer = db.bulkWriter();
    let failure: unknown;
    writer.onWriteError((err) => {
      failure ??= err;
      return false;
    });
    for (const ref of refs.values()) void writer.delete(ref).catch(() => undefined);
    await writer.close();
    if (failure) throw new HttpsError("internal", "DELETE_FAILED");
  }

  try {
    await authAdmin.deleteUser(uid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw new HttpsError("internal", "AUTH_DELETE_FAILED");
  }
  return { ok: true, deleted: refs.size };
}

export const deleteAccount = onCall({ region: "europe-west1", timeoutSeconds: 120 }, async (req) => {
  return handleDeleteAccount(
    getFirestore(),
    getAuth(),
    req.auth ? { uid: req.auth.uid, token: { auth_time: req.auth.token.auth_time } } : undefined,
    Math.floor(Date.now() / 1000),
  );
});
