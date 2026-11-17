import * as admin from "firebase-admin";

// Used only by services that need to bypass Firestore security rules — e.g.
// settling predictions, which writes to OTHER users' `predictions`/`rankings`
// docs (rules correctly forbid that for a plain, unauthenticated client; see
// the comments on those collections in firestore.rules). Every other service
// in this codebase keeps reading/writing through the plain client SDK in
// database/firebase.ts, untouched by this file.
if (!admin.apps.length) {
  admin.initializeApp();
}

export const adminDb = admin.firestore();
