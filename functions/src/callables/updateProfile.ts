import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { publicName } from "../data/profiles";
import { periodKeys } from "../time/periods";
import { validateDisplayName, validAvatarId } from "./validation";

/**
 * Garante `publicProfiles/{uid}` e, se vier `displayName`/`avatarId`, atualiza-os.
 * `{}` só (re)publica o perfil (a app chama-o depois de cada login).
 * `avatarId` ausente do pedido preserva o valor já publicado; `null` limpa-o.
 */
export async function handleUpdateProfile(
  db: Firestore,
  auth: { uid: string } | undefined,
  data: unknown,
  now: Date,
): Promise<{ displayName: string; avatarId: string | null }> {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sessão necessária.");
  const uid = auth.uid;
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;

  let newName: string | undefined;
  if (d.displayName !== undefined) {
    const v = validateDisplayName(d.displayName);
    if (!v.ok) throw new HttpsError("invalid-argument", v.error);
    newName = v.value;
  }
  let newAvatar: string | null | undefined;
  if (d.avatarId !== undefined) {
    if (!validAvatarId(d.avatarId)) throw new HttpsError("invalid-argument", "INVALID_AVATAR");
    newAvatar = d.avatarId;
  }

  const keys = periodKeys(now);
  const userRef = db.doc(`users/${uid}`);
  const pubRef = db.doc(`publicProfiles/${uid}`);
  const entryRefs = (["week", "month", "season"] as const).map((k) =>
    db.doc(`leaderboards/${k}_${keys[k]}/entries/${uid}`),
  );

  return db.runTransaction(async (tx) => {
    const [userSnap, pubSnap, ...entrySnaps] = await tx.getAll(userRef, pubRef, ...entryRefs);
    const user = (userSnap.data() ?? {}) as { displayName?: string | null; name?: string | null };
    const merged = newName !== undefined ? { ...user, displayName: newName } : user;
    const displayName = publicName(merged, uid);
    const avatarId =
      newAvatar !== undefined ? newAvatar : ((pubSnap.data()?.avatarId as string | null | undefined) ?? null);

    if (newName !== undefined) tx.set(userRef, { displayName: newName }, { merge: true });
    tx.set(pubRef, { displayName, avatarId, updatedAt: FieldValue.serverTimestamp() });
    for (const snap of entrySnaps) {
      if (snap.exists && snap.get("displayName") !== displayName) tx.update(snap.ref, { displayName });
    }
    return { displayName, avatarId };
  });
}

export const updateProfile = onCall({ region: "europe-west1" }, async (req) => {
  return handleUpdateProfile(getFirestore(), req.auth, req.data, new Date());
});
