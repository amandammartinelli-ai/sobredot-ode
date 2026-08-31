/**
 * Semeia o Firebase Emulator Suite local com uma família, crianças e
 * registos fictícios, para desenvolvimento e demonstração manual. NUNCA
 * correr contra um projeto real (verifica os hosts de emulador antes de
 * escrever).
 *
 * Uso: primeiro arrancar os emuladores (`npm run emulators`) numa janela,
 * depois `npm run seed:emulator` noutra.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { mockChildren } from '../src/data/mock/children.js';
import { mockSeedRecords } from '../src/data/mock/records.js';

const PROJECT_ID = 'demo-sobredot';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

if (!FIRESTORE_HOST.includes('127.0.0.1') && !FIRESTORE_HOST.includes('localhost')) {
  throw new Error('Recusado: este script só corre contra o Firebase Emulator Suite local.');
}

const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);

const DEMO_EMAIL = 'demo@sobredot.exemplo';
const DEMO_PASSWORD = 'DemoSobredot123!';
const FAMILY_ID = 'family-exemplo';

async function upsertDemoUser() {
  try {
    const existing = await auth.getUserByEmail(DEMO_EMAIL);
    return existing.uid;
  } catch {
    const user = await auth.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: 'Carolina Amostra',
      emailVerified: true,
    });
    return user.uid;
  }
}

async function seed() {
  const uid = await upsertDemoUser();

  await db.doc(`users/${uid}`).set(
    { uid, displayName: 'Carolina Amostra', email: DEMO_EMAIL, familyId: FAMILY_ID, createdAt: new Date(), updatedAt: new Date() },
    { merge: true }
  );

  await db.doc(`families/${FAMILY_ID}`).set({
    name: 'Família Amostra',
    createdBy: uid,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.doc(`families/${FAMILY_ID}/members/${uid}`).set({
    uid,
    role: 'owner',
    status: 'active',
    invitedBy: null,
    joinedAt: new Date(),
  });

  for (const child of mockChildren) {
    // eslint-disable-next-line no-await-in-loop
    await db.doc(`children/${child.id}`).set({
      familyId: FAMILY_ID,
      name: child.name,
      birthDate: `${child.birthYear}-01-01`,
      relationshipOrigin: child.relationshipOrigin,
      createdBy: uid,
      updatedBy: uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  for (const record of mockSeedRecords) {
    // eslint-disable-next-line no-await-in-loop
    await db.collection(`children/${record.childId}/records`).add({
      childId: record.childId,
      familyId: FAMILY_ID,
      categoryId: record.categoryId,
      notes: record.summary,
      intensity: record.intensity,
      occurredAt: new Date(record.createdAt),
      source: 'family',
      createdBy: uid,
      updatedBy: uid,
      version: 1,
      deletedAt: null,
    });
  }

  console.log('Emulador semeado com sucesso.');
  console.log(`Família: ${FAMILY_ID}`);
  console.log(`Conta de demonstração: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log('(Esta palavra-passe só existe no Auth Emulator local — nunca é uma credencial real.)');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Falha ao semear o emulador:', error);
    process.exit(1);
  });
