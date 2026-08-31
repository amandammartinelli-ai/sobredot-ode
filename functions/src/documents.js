/**
 * Cofre de Documentos — pipeline servidor de validação e extração.
 *
 * Todo o processamento acontece aqui, em Cloud Functions, NUNCA no
 * browser (ver docs/architecture.md). Os estados possíveis de um
 * documento são exatamente os pedidos: selected, uploading, quarantine,
 * verifying, extracting, pending_review, approved, rejected, error — mais
 * "eliminado", que é um eixo ortogonal (`deletedAt`) sobreposto a
 * qualquer um destes estados (ver docs/data-model.md).
 *
 * Idempotência: o gatilho `onFinalize` do Storage pode, em teoria, ser
 * entregue mais do que uma vez para o mesmo ficheiro. A transação inicial
 * só avança o estado se o documento ainda estiver em "uploading" — uma
 * segunda entrega do mesmo evento não repete o trabalho. Há um limite de
 * tentativas (`MAX_ATTEMPTS`) para evitar processamento infinito em caso
 * de falha persistente.
 */
const crypto = require('crypto');
const { regionalFunctions: functions, HttpsError } = require('./regional');
const { db, admin } = require('./init');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { detectRealMimeType, declaredTypeMatchesReal } = require('./contentSniff');
const { getAntivirusAdapter } = require('./antivirus');
const { extractPagesFromBuffer, extractStructuredItemsFromPages } = require('./extraction');
const { getOcrAdapter } = require('./ocr');
const { requireAuth, requireChildFamilyOwner, resolveChildAccess, getFamilyMember } = require('./util');

const PATH_PATTERN = /^documents\/([^/]+)\/([^/]+)\/([^/]+)\/(\d+)$/;
const MAX_ATTEMPTS = 3;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 200;
const SIGNED_URL_TTL_MS = 5 * 60 * 1000; // 5 minutos
const ALLOWED_DECLARED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

async function markDocument(docRef, fields) {
  await docRef.update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Gatilho principal: dispara quando um ficheiro termina de ser enviado
 * para o Storage no caminho do cofre de documentos
 * (documents/{familyId}/{childId}/{documentId}/{version}).
 */
const onDocumentUpload = functions.storage.object().onFinalize(async (object) => {
  const match = PATH_PATTERN.exec(object.name || '');
  if (!match) return null;

  const [, , childId, documentId, versionStr] = match;
  const version = Number(versionStr);
  const docRef = db.doc(`children/${childId}/documents/${documentId}`);

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return false;
    const doc = snap.data();
    if (doc.deletedAt) return false;
    if (doc.status !== 'uploading') return false;

    const attempts = (doc.processingAttempts || 0) + 1;
    if (attempts > MAX_ATTEMPTS) {
      tx.update(docRef, {
        status: 'error',
        errorReason: 'max_retries_exceeded',
        processingAttempts: attempts,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return false;
    }

    tx.update(docRef, {
      status: 'quarantine',
      processingAttempts: attempts,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (!claimed) return null;

  const bucket = admin.storage().bucket(object.bucket);
  const file = bucket.file(object.name);

  try {
    const [buffer] = await file.download();

    if (buffer.length > MAX_BYTES) {
      await markDocument(docRef, { status: 'rejected', errorReason: 'file_too_large' });
      return null;
    }

    // --- 1. Antimalware --------------------------------------------
    const av = getAntivirusAdapter();
    const scanResult = await av.scanBuffer(buffer);
    if (!scanResult.clean) {
      // Fica em quarentena — nunca avança sem uma análise real. Ver
      // antivirus.js: não simulamos segurança que não existe.
      await markDocument(docRef, {
        status: 'quarantine',
        errorReason: 'antivirus_unavailable_or_infected',
        errorDetail: { engine: scanResult.engine, detail: scanResult.reason },
      });
      return null;
    }

    // --- 2. Verificação de conteúdo real -----------------------------
    await markDocument(docRef, { status: 'verifying' });

    const docSnap = await docRef.get();
    const doc = docSnap.data();
    const declaredType = doc.pendingUpload && doc.pendingUpload.mimeType;
    const realType = detectRealMimeType(buffer);

    if (!declaredTypeMatchesReal(declaredType, realType)) {
      await markDocument(docRef, {
        status: 'rejected',
        errorReason: 'mime_mismatch',
        errorDetail: { declaredType, realType },
      });
      return null;
    }

    // --- 3. Extração de texto / OCR ----------------------------------
    await markDocument(docRef, { status: 'extracting' });

    const extraction = await extractPagesFromBuffer(buffer, realType);

    if (extraction.unsupported) {
      await markDocument(docRef, { status: 'rejected', errorReason: 'unsupported_type' });
      return null;
    }

    let { pages } = extraction;
    if (extraction.ocrRequired) {
      const ocr = getOcrAdapter();
      const ocrResult = await ocr.recognizeText(buffer);
      if (!ocrResult.available) {
        await markDocument(docRef, {
          status: 'error',
          errorReason: 'ocr_unavailable',
          errorDetail: { detail: ocrResult.reason },
        });
        return null;
      }
      pages = ocrResult.pages;
    }

    if (pages.length > MAX_PAGES) {
      await markDocument(docRef, { status: 'rejected', errorReason: 'too_many_pages', errorDetail: { pages: pages.length } });
      return null;
    }

    // --- 4. Normalização + divisão em trechos + classificação --------
    // (a normalização é feita dentro de extractStructuredItemsFromPages;
    // "trechos" = os excertos curtos já produzidos por item)
    const structuredItems = extractStructuredItemsFromPages(pages);

    // --- 5. Armazenamento ---------------------------------------------
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    await db
      .collection(`children/${childId}/documents/${documentId}/versions`)
      .doc(String(version))
      .set({
        version,
        storagePath: object.name,
        declaredMimeType: declaredType,
        realMimeType: realType,
        byteSize: buffer.length,
        checksum,
        pages: pages.length,
        uploadedBy: doc.createdBy,
        createdAt: FieldValue.serverTimestamp(),
      });

    const batch = db.batch();
    structuredItems.forEach((item) => {
      const itemRef = db.collection(`children/${childId}/documents/${documentId}/extractionItems`).doc();
      batch.set(itemRef, {
        ...item,
        sourceVersionId: String(version),
        // --- 6. Aguarda revisão humana obrigatória --------------------
        reviewStatus: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    await markDocument(docRef, {
      status: 'pending_review',
      currentVersion: version,
      pages: pages.length,
      extractionItemCount: structuredItems.length,
      pendingUpload: null,
    });

    return null;
  } catch (error) {
    await markDocument(docRef, {
      status: 'error',
      errorReason: 'unexpected_error',
      errorDetail: { message: String((error && error.message) || error) },
    });
    return null;
  }
});

/**
 * Aprova um documento — só depois de TODOS os itens extraídos terem sido
 * revistos por um humano (confirmados, editados ou rejeitados). É isto
 * que impede uma extração automática de entrar na visão integrada sem
 * confirmação humana, mesmo que o cliente tente saltar o passo.
 */
const approveDocument = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { childId, documentId } = data || {};
  if (typeof childId !== 'string' || !childId || typeof documentId !== 'string' || !documentId) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  await requireChildFamilyOwner(childId, uid);

  const docRef = db.doc(`children/${childId}/documents/${documentId}`);
  const docSnap = await docRef.get();
  if (!docSnap.exists || docSnap.data().deletedAt) {
    throw new HttpsError('not-found', 'Documento não encontrado.');
  }
  if (docSnap.data().status !== 'pending_review') {
    throw new HttpsError('failed-precondition', 'O documento não está à espera de revisão.');
  }

  const pendingItems = await db
    .collection(`children/${childId}/documents/${documentId}/extractionItems`)
    .where('reviewStatus', '==', 'pending')
    .limit(1)
    .get();

  if (!pendingItems.empty) {
    throw new HttpsError(
      'failed-precondition',
      'Ainda existem itens extraídos por rever antes de aprovar o documento.'
    );
  }

  await markDocument(docRef, { status: 'approved', approvedBy: uid, approvedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

const rejectDocument = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { childId, documentId, reason } = data || {};
  if (typeof childId !== 'string' || !childId || typeof documentId !== 'string' || !documentId) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  await requireChildFamilyOwner(childId, uid);

  const docRef = db.doc(`children/${childId}/documents/${documentId}`);
  const docSnap = await docRef.get();
  if (!docSnap.exists || docSnap.data().deletedAt) {
    throw new HttpsError('not-found', 'Documento não encontrado.');
  }

  await markDocument(docRef, {
    status: 'rejected',
    rejectedBy: uid,
    rejectedReason: typeof reason === 'string' ? reason.slice(0, 500) : null,
  });
  return { ok: true };
});

/**
 * Cria o registo de metadados inicial de um documento (estado "selected")
 * e devolve uma URL de upload assinada, de curta duração, para a próxima
 * versão. O cliente nunca escreve diretamente no bucket (ver
 * storage.rules) — este é o único caminho de entrada para um ficheiro no
 * cofre de documentos.
 */
const getDocumentUploadUrl = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { childId, documentId, mimeType, byteSize } = data || {};

  if (typeof childId !== 'string' || !childId || typeof documentId !== 'string' || !documentId) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }
  if (!ALLOWED_DECLARED_TYPES.includes(mimeType)) {
    throw new HttpsError('invalid-argument', 'Tipo de ficheiro não permitido.');
  }
  if (typeof byteSize !== 'number' || byteSize <= 0 || byteSize > MAX_BYTES) {
    throw new HttpsError('invalid-argument', 'Tamanho de ficheiro inválido.');
  }

  const docRef = db.doc(`children/${childId}/documents/${documentId}`);
  const docSnap = await docRef.get();
  if (!docSnap.exists || docSnap.data().deletedAt) {
    throw new HttpsError('not-found', 'Documento não encontrado.');
  }
  const doc = docSnap.data();

  // Só a família (nunca um colaborador externo, mesmo com concessão) pode
  // enviar ficheiros para o cofre de documentos nesta etapa.
  const member = await getFamilyMember(doc.familyId, uid);
  if (!member) {
    throw new HttpsError('permission-denied', 'Sem permissão para enviar documentos desta criança.');
  }
  if (!['selected', 'approved', 'rejected', 'error'].includes(doc.status)) {
    throw new HttpsError('failed-precondition', 'O documento já está a ser processado.');
  }

  const nextVersion = (doc.currentVersion || 0) + 1;
  const storagePath = `documents/${doc.familyId}/${childId}/${documentId}/${nextVersion}`;

  await docRef.update({
    status: 'uploading',
    pendingUpload: { mimeType, byteSize },
    updatedAt: FieldValue.serverTimestamp(),
  });

  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const [url] = await file.getSignedUrl({
    action: 'write',
    expires: Date.now() + SIGNED_URL_TTL_MS,
    contentType: mimeType,
  });

  return { url, storagePath, version: nextVersion, expiresAt: Date.now() + SIGNED_URL_TTL_MS };
});

/**
 * Gera uma URL de acesso temporário (assinada no servidor) para
 * visualizar/descarregar uma versão de um documento. Reverifica sempre a
 * permissão no servidor — este é o único caminho de leitura de um
 * ficheiro do cofre de documentos, já que o cliente nunca acede
 * diretamente ao bucket (ver storage.rules).
 */
const getDocumentDownloadUrl = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { childId, documentId, version } = data || {};
  if (
    typeof childId !== 'string' || !childId ||
    typeof documentId !== 'string' || !documentId ||
    !Number.isInteger(version)
  ) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  const access = await resolveChildAccess(childId, uid, { capability: 'view', category: 'documents' });
  if (!access.allowed) {
    throw new HttpsError(
      'permission-denied',
      access.reason === 'grant_expired'
        ? 'A sua concessão de acesso a esta criança expirou.'
        : 'Sem acesso aos documentos desta criança.'
    );
  }

  const versionSnap = await db.doc(`children/${childId}/documents/${documentId}/versions/${version}`).get();
  if (!versionSnap.exists) {
    throw new HttpsError('not-found', 'Versão do documento não encontrada.');
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(versionSnap.data().storagePath);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });

  return { url, expiresAt: Date.now() + SIGNED_URL_TTL_MS };
});

/**
 * Faxina de retenção: elimina fisicamente do Storage as versões de
 * documentos cujo documento-pai já está marcado como eliminado há mais
 * tempo do que a política de retenção configurada. A eliminação lógica
 * (deletedAt) acontece sempre primeiro e é imediata; isto só trata da
 * limpeza física, mais tarde.
 */
const RETENTION_DAYS_AFTER_DELETE = 30;

const purgeExpiredDocuments = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const cutoff = Timestamp.fromMillis(
    Date.now() - RETENTION_DAYS_AFTER_DELETE * 24 * 60 * 60 * 1000
  );

  const toPurge = await db
    .collectionGroup('documents')
    .where('deletedAt', '<=', cutoff)
    .get();

  const bucket = admin.storage().bucket();

  await Promise.all(
    toPurge.docs.map(async (docSnap) => {
      const versionsSnap = await docSnap.ref.collection('versions').get();
      await Promise.all(
        versionsSnap.docs.map((versionDoc) =>
          bucket
            .file(versionDoc.data().storagePath)
            .delete({ ignoreNotFound: true })
            .catch(() => null)
        )
      );
      await docSnap.ref.update({ purgedAt: FieldValue.serverTimestamp() });
    })
  );

  return null;
});

module.exports = {
  onDocumentUpload,
  approveDocument,
  rejectDocument,
  getDocumentUploadUrl,
  getDocumentDownloadUrl,
  purgeExpiredDocuments,
};
