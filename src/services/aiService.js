/**
 * "Perguntar aos documentos" — chama sempre o gateway de IA em Cloud
 * Functions (ver functions/src/ai.js). O cliente nunca vê nem envia
 * conteúdo de documentos diretamente a nenhum fornecedor de IA.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/app.js';

const askDocumentsFn = httpsCallable(functions, 'askDocuments');

export async function askDocuments(childId, question) {
  const { data } = await askDocumentsFn({ childId, question });
  return data;
}
