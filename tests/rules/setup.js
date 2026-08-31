// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-sobredot-tests';

let testEnv;

export async function getTestEnv() {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
      storage: {
        rules: fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf8'),
      },
    });
  }
  return testEnv;
}

export async function teardownTestEnv() {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = undefined;
  }
}

export function futureTimestamp(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

export function pastTimestamp(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}
