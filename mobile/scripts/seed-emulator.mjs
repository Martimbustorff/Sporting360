// Seeds the local Firebase emulators with config/app, a test user and the fixtures.
// Usage (emulators running): FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-emulator.mjs
// Refuses to run without FIRESTORE_EMULATOR_HOST so it can never write to production.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { PROJECT_ID, TEST_USER, buildFixtures } from '../src/data/fixtures.ts';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) {
  console.error(
    'seed-emulator: FIRESTORE_EMULATOR_HOST is not set. Start the emulators and run, e.g.\n' +
      '  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-emulator.mjs\n' +
      'Refusing to touch a real project.',
  );
  process.exit(1);
}

// Never let the Admin SDK pick up real credentials: the emulator needs none.
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const app = initializeApp({ projectId: PROJECT_ID });
const firestore = getFirestore(app);

const docs = buildFixtures(new Date());
const BATCH = 400;
for (let i = 0; i < docs.length; i += BATCH) {
  const batch = firestore.batch();
  for (const { path, data } of docs.slice(i, i + BATCH)) batch.set(firestore.doc(path), data);
  await batch.commit();
}
console.log(`seed-emulator: wrote ${docs.length} documents to ${host} (${PROJECT_ID})`);

// The Auth emulator user only exists when its host is configured.
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  const auth = getAuth(app);
  try {
    await auth.getUser(TEST_USER.uid);
  } catch {
    await auth.createUser({
      uid: TEST_USER.uid,
      email: TEST_USER.email,
      password: TEST_USER.password,
      emailVerified: true,
      displayName: TEST_USER.name,
    });
  }
  console.log(`seed-emulator: auth user ${TEST_USER.email} ready`);
}
