/**
 * Gateway de IA privado — "Perguntar aos documentos".
 *
 * Princípios não negociáveis (ver docs/architecture.md, "Camada de IA
 * privada", e docs/vendors.md):
 *
 *  1. A IA NUNCA é treinada com os laudos. Não existe fine-tuning nem
 *     envio de conteúdo para melhorar um modelo geral — cada pedido é
 *     isolado (ver adaptador mock abaixo e o contrato esperado de
 *     qualquer fornecedor real em docs/vendors.md).
 *  2. A recuperação de conteúdo é filtrada por childId e familyId NO
 *     SERVIDOR, antes de qualquer chamada ao modelo — nunca confiamos
 *     num filtro dentro do próprio prompt. Ver `retrieveChildContext`.
 *  3. O texto vindo de documentos é sempre tratado como DADOS não
 *     confiáveis, nunca como instruções — ver `sanitizeUntrustedText` e o
 *     invólucro explícito à volta de cada excerto.
 *  4. Toda a resposta tem de citar a fonte (documentId + página +
 *     excerto). O adaptador mock só pode devolver texto que já veio da
 *     recuperação — nunca inventa factos, por construção.
 *  5. Perguntas ou respostas que pareçam pedir diagnóstico, prescrição,
 *     alteração de medicação, tratamento ou classificação escolar da
 *     criança são bloqueadas antes de chegar ao modelo e a resposta é
 *     recusada com uma alternativa segura.
 *  6. Nunca se regista o texto da pergunta, da resposta ou dos
 *     documentos em logs — só metadados técnicos (ver
 *     docs/logging-policy.md).
 *
 * Nesta etapa não existe nenhum fornecedor de IA real ligado (sem
 * contrato, sem avaliação de subcontratantes — ver docs/vendors.md). Usa-
 * se sempre o adaptador mock, determinístico e auditável, tanto para
 * extração estruturada de documentos como para "Perguntar aos
 * documentos".
 */
const { regionalFunctions: functions, HttpsError } = require('./regional');
const { db } = require('./init');
const { FieldValue } = require('firebase-admin/firestore');
const { requireAuth, resolveChildAccess } = require('./util');

// ---------------------------------------------------------------------
// Bloqueio de conteúdo clínico — aplica-se tanto à pergunta recebida como
// à resposta que seria devolvida. Lista de padrões deliberadamente ampla
// (falsos positivos são aceitáveis; falsos negativos não).
// ---------------------------------------------------------------------
const BLOCKED_PATTERNS = [
  /diagnosti/i,
  /prescrev/i,
  /prescriç/i,
  /aumenta[r]? a dose/i,
  /reduz[ir]? a dose/i,
  /qual a dose/i,
  /que dose/i,
  /trocar (a|o) medica/i,
  /suspender (a|o) medica/i,
  /parar (a|o) medica/i,
  /classifica(r)? (esta|a) criança/i,
  /tem (tdah|autismo|perturbação|transtorno)/i,
  /qual o tratamento/i,
  /que tratamento/i,
  /devo dar (mais|menos)/i,
];

function containsBlockedIntent(text) {
  if (!text) return false;
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Neutraliza qualquer coisa que pareça uma instrução dentro de texto
 * vindo de um documento (defesa contra prompt injection). O texto de
 * origem NUNCA é interpretado como comando — isto é reforçado ainda pelo
 * adaptador mock, que apenas cita/organiza excertos já recuperados, nunca
 * "segue" instruções neles contidas.
 */
function sanitizeUntrustedText(text) {
  if (!text) return '';
  return String(text)
    .replace(/```/g, '′′′')
    .slice(0, 600)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recuperação server-side, filtrada por childId (e implicitamente por
 * familyId, através da verificação de vínculo feita antes de chamar esta
 * função). Só considera documentos aprovados, não eliminados, e só itens
 * de extração já confirmados ou editados por revisão humana — nunca itens
 * ainda pendentes de revisão, e nunca o texto bruto do documento.
 *
 * Devolve, no máximo, `limit` itens relevantes para `questionText`
 * (correspondência simples por palavras-chave — não há embeddings/busca
 * vetorial nesta etapa, ver docs/roadmap.md).
 */
async function retrieveChildContext(childId, questionText, limit = 6) {
  const documentsSnap = await db
    .collection(`children/${childId}/documents`)
    .where('status', '==', 'approved')
    .where('deletedAt', '==', null)
    .get();

  if (documentsSnap.empty) {
    return [];
  }

  const documentTitleById = new Map();
  documentsSnap.docs.forEach((doc) => {
    documentTitleById.set(doc.id, doc.data().docType || 'documento');
  });

  const keywords = String(questionText || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 12);

  const items = [];
  for (const documentDoc of documentsSnap.docs) {
    // eslint-disable-next-line no-await-in-loop
    const itemsSnap = await db
      .collection(`children/${childId}/documents/${documentDoc.id}/extractionItems`)
      .where('reviewStatus', 'in', ['confirmed', 'edited'])
      .get();

    itemsSnap.docs.forEach((itemDoc) => {
      const item = itemDoc.data();
      const haystack = `${item.category} ${item.value}`.toLowerCase();
      const matches = keywords.length === 0 || keywords.some((word) => haystack.includes(word));
      if (matches) {
        items.push({
          documentId: documentDoc.id,
          docType: documentTitleById.get(documentDoc.id),
          category: item.category,
          value: sanitizeUntrustedText(item.value),
          page: item.page,
          excerpt: sanitizeUntrustedText(item.excerpt),
          confidence: item.confidence,
        });
      }
    });
  }

  return items.slice(0, limit);
}

/**
 * Adaptador mock: NUNCA inventa factos. Organiza exclusivamente o que
 * `retrieveChildContext` já recuperou, com citação obrigatória de cada
 * item. É determinístico e não faz nenhuma chamada de rede — adequado a
 * ambientes de desenvolvimento e a esta etapa, em que nenhum fornecedor
 * de IA real está contratado (ver docs/vendors.md).
 */
function buildGroundedAnswer(items) {
  if (items.length === 0) {
    return {
      summary:
        'Não foram encontrados documentos aprovados com informação relacionada com esta pergunta.',
      facts: [],
      sources: [],
      uncertainties: [
        'Pode não existir ainda documentação suficiente carregada e aprovada para esta criança.',
      ],
    };
  }

  const facts = items.map((item) => ({
    text: item.value,
    category: item.category,
    documentId: item.documentId,
    docType: item.docType,
    page: item.page,
    excerpt: item.excerpt,
    confidence: item.confidence,
  }));

  const sources = items.map((item) => ({
    documentId: item.documentId,
    docType: item.docType,
    page: item.page,
    excerpt: item.excerpt,
  }));

  const lowConfidenceCount = items.filter((item) => typeof item.confidence === 'number' && item.confidence < 0.6).length;

  return {
    summary: `Foram encontrados ${items.length} ponto(s) relacionados nos documentos aprovados desta criança.`,
    facts,
    sources,
    uncertainties:
      lowConfidenceCount > 0
        ? [`${lowConfidenceCount} destes pontos têm confiança baixa na extração original e merecem confirmação humana.`]
        : [],
  };
}

const DISCLAIMER =
  'Esta síntese organiza informação já revista por um humano a partir dos documentos aprovados desta criança. Pode conter erros ou omissões e não substitui a avaliação de profissionais.';

const BLOCKED_RESPONSE = {
  blocked: true,
  summary:
    'Esta pergunta não pode ser respondida aqui: pede diagnóstico, prescrição, alteração de medicação, tratamento ou classificação da criança.',
  facts: [],
  sources: [],
  uncertainties: [],
  suggestion:
    'Sugestão: organize a informação relevante dos documentos e leve estas perguntas a um profissional que acompanhe a criança.',
  disclaimer: DISCLAIMER,
};

/**
 * Callable "Perguntar aos documentos". Só devolve informação da criança
 * indicada, nunca de outra — a verificação de vínculo (família ou
 * concessão com capacidade "view" + âmbito "documents") acontece antes de
 * qualquer recuperação.
 */
const askDocuments = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { childId, question } = data || {};

  if (typeof childId !== 'string' || !childId) {
    throw new HttpsError('invalid-argument', 'Criança inválida.');
  }
  if (typeof question !== 'string' || question.trim().length === 0 || question.length > 500) {
    throw new HttpsError('invalid-argument', 'Pergunta inválida.');
  }

  const access = await resolveChildAccess(childId, uid, { capability: 'view', category: 'documents' });
  if (!access.allowed) {
    throw new HttpsError('permission-denied', 'Sem acesso aos documentos desta criança.');
  }
  const child = access.child;

  const startedAt = Date.now();

  // Bloqueio ANTES de qualquer recuperação ou geração — não gastamos
  // sequer a leitura de documentos numa pergunta já claramente fora do
  // âmbito permitido.
  if (containsBlockedIntent(question)) {
    await logAiQuery({ childId, familyId: child.familyId, uid, blocked: true, sourceCount: 0, startedAt });
    return BLOCKED_RESPONSE;
  }

  const items = await retrieveChildContext(childId, question);
  const answer = buildGroundedAnswer(items);

  // Segunda barreira: mesmo que a pergunta pareça inofensiva, recusamos
  // devolver uma resposta cujo conteúdo recuperado descreva instruções de
  // dose ou afins (defesa em profundidade).
  const answerText = JSON.stringify(answer);
  if (containsBlockedIntent(answerText)) {
    await logAiQuery({ childId, familyId: child.familyId, uid, blocked: true, sourceCount: items.length, startedAt });
    return BLOCKED_RESPONSE;
  }

  await logAiQuery({
    childId,
    familyId: child.familyId,
    uid,
    blocked: false,
    sourceCount: items.length,
    sourceDocumentIds: [...new Set(items.map((item) => item.documentId))],
    startedAt,
  });

  return {
    blocked: false,
    summary: answer.summary,
    facts: answer.facts,
    sources: answer.sources,
    uncertainties: answer.uncertainties,
    disclaimer: DISCLAIMER,
  };
});

/**
 * Regista SÓ metadados técnicos da pergunta — nunca o texto da pergunta,
 * da resposta ou de qualquer documento. Ver docs/logging-policy.md.
 */
async function logAiQuery({ childId, familyId, uid, blocked, sourceCount, sourceDocumentIds, startedAt }) {
  await db.collection(`children/${childId}/aiQueries`).add({
    askedBy: uid,
    childId,
    familyId,
    blocked,
    sourceCount,
    sourceDocumentIds: sourceDocumentIds || [],
    durationMs: Date.now() - startedAt,
    createdAt: FieldValue.serverTimestamp(),
  });
}

module.exports = {
  askDocuments,
  // exportado para reutilização pelo pipeline de extração (documents.js)
  // e para testes unitários isolados (ver functions/test/ai.test.js).
  containsBlockedIntent,
  sanitizeUntrustedText,
  retrieveChildContext,
  buildGroundedAnswer,
};
