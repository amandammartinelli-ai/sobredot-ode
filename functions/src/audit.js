/**
 * Auditoria — escrita exclusivamente do lado do servidor.
 *
 * `writeAuditEvent` é usada pelas próprias Cloud Functions (callables e
 * gatilhos). Os gatilhos `onWrite` abaixo cobrem ainda as escritas feitas
 * DIRETAMENTE pelo cliente (ex.: criar uma criança, submeter um registo)
 * que as regras do Firestore permitem sem passar por nenhuma função — a
 * auditoria fica assim garantida mesmo nesses casos, porque um gatilho
 * `onWrite` do Firestore dispara sempre, seja a escrita do cliente SDK ou
 * do Admin SDK. Usamos a API v1 de Functions porque só ela expõe
 * `context.auth.uid` (o utilizador autenticado que fez a escrita) nos
 * gatilhos do Firestore — a API v2 (Eventarc) não transporta essa
 * informação da mesma forma.
 *
 * O cliente NUNCA escreve em auditLog (ver firestore.rules) — só chega lá
 * por este caminho.
 */
const { regionalFunctions: functions } = require('./regional');
const { db } = require('./init');
const { FieldValue } = require('firebase-admin/firestore');

async function writeAuditEvent({ action, actorUid, actorRole, targetType, targetId, familyId, childId, metadata }) {
  await db.collection('auditLog').add({
    action,
    actorUid: actorUid || null,
    actorRole: actorRole || (actorUid ? 'user' : 'system'),
    targetType,
    targetId: targetId || null,
    familyId: familyId || null,
    childId: childId || null,
    // Metadados técnicos apenas — nunca conteúdo de registos, documentos ou
    // notas. Ver docs/logging-policy.md.
    metadata: metadata || {},
    createdAt: FieldValue.serverTimestamp(),
  });
}

const onChildWrite = functions.firestore
  .document('children/{childId}')
  .onWrite(async (change, context) => {
    const actorUid = context.auth ? context.auth.uid : null;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return null;

    let action = 'child.updated';
    if (!before) action = 'child.created';
    else if (!before.deletedAt && after.deletedAt) action = 'child.deleted';

    return writeAuditEvent({
      action,
      actorUid,
      targetType: 'child',
      targetId: context.params.childId,
      familyId: after.familyId,
      childId: context.params.childId,
    });
  });

const onRecordWrite = functions.firestore
  .document('children/{childId}/records/{recordId}')
  .onWrite(async (change, context) => {
    const actorUid = context.auth ? context.auth.uid : null;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return null;

    let action = 'record.updated';
    if (!before) action = 'record.created';
    else if (!before.deletedAt && after.deletedAt) action = 'record.deleted';

    return writeAuditEvent({
      action,
      actorUid,
      targetType: 'record',
      targetId: context.params.recordId,
      familyId: after.familyId || null,
      childId: context.params.childId,
      // Só metadados: categoria e origem, nunca notas ou conteúdo do registo.
      metadata: { categoryId: after.categoryId, source: after.source },
    });
  });

module.exports = { writeAuditEvent, onChildWrite, onRecordWrite };
