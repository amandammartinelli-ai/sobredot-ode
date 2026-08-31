// @vitest-environment node
import { beforeAll, afterAll, describe, it } from 'vitest';
import { assertFails } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { getTestEnv, teardownTestEnv } from './setup.js';

// As regras do Storage negam SEMPRE o acesso direto do cliente ao bucket
// (ver storage.rules — a decisão de arquitetura está documentada lá e em
// docs/decisions.md). Todo o upload/download passa por uma Cloud Function
// que gera uma URL assinada de curta duração depois de verificar a
// permissão no Firestore através do Admin SDK. Estes testes confirmam
// exatamente essa invariante: ninguém, em nenhuma circunstância, acede
// diretamente ao bucket através do SDK do cliente.
const PDF_BYTES = new Uint8Array(Buffer.from('%PDF-1.4 conteúdo sintético', 'utf8'));
const PATH = 'documents/familyA/childA1/doc-1/1';

let testEnv;

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('Storage nega sempre o acesso direto do cliente', () => {
  it('nenhum utilizador autenticado consegue enviar um ficheiro diretamente', async () => {
    const storage = testEnv.authenticatedContext('uid-owner-a').storage();
    await assertFails(
      uploadBytes(ref(storage, PATH), PDF_BYTES, { contentType: 'application/pdf' })
    );
  });

  it('um utilizador não autenticado também não consegue enviar nada', async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(storage, PATH), PDF_BYTES, { contentType: 'application/pdf' })
    );
  });

  it('ninguém consegue ler um objeto diretamente, mesmo que exista', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), PATH), PDF_BYTES, { contentType: 'application/pdf' });
    });
    const storage = testEnv.authenticatedContext('uid-owner-a').storage();
    await assertFails(getBytes(ref(storage, PATH)));
  });

  it('ninguém consegue apagar um objeto diretamente', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), PATH), PDF_BYTES, { contentType: 'application/pdf' });
    });
    const storage = testEnv.authenticatedContext('uid-owner-a').storage();
    await assertFails(deleteObject(ref(storage, PATH)));
  });
});
