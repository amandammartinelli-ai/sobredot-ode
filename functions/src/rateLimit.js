/**
 * Limites de utilização (anti-abuso) para operações caras ou sensíveis —
 * sobretudo as que envolvem o gateway de IA. Sempre "falha segura": se o
 * limite for excedido, a operação é recusada com uma mensagem clara,
 * nunca processada parcialmente nem ignorada silenciosamente.
 *
 * Implementado em Firestore (janela fixa, contador por transação) — não
 * depende de nenhum serviço externo de rate limiting. Os limites em si
 * são intencionalmente generosos para uso familiar normal e apertados o
 * suficiente para tornar um abuso automatizado caro/lento. Ver
 * docs/security-hardening.md, "Quotas e limites".
 */
const { HttpsError } = require('./regional');
const { db, Timestamp, FieldValue } = require('./init');
const { writeAuditEvent } = require('./audit');

/**
 * @param {string} key Identificador único do contador (ex.:
 *   `ai:ask:{uid}` ou `ai:ask:child:{childId}`).
 * @param {{limit: number, windowMs: number, action: string}} options
 */
async function enforceRateLimit(key, { limit, windowMs, action }) {
  const ref = db.doc(`rateLimits/${key}`);
  const now = Date.now();

  const exceeded = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    const windowStartMillis = data && data.windowStart ? data.windowStart.toMillis() : 0;

    if (!data || now - windowStartMillis > windowMs) {
      tx.set(ref, {
        windowStart: Timestamp.fromMillis(now),
        count: 1,
        action,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return false;
    }

    if (data.count >= limit) {
      return true;
    }

    tx.update(ref, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    return false;
  });

  if (exceeded) {
    // Só o metadado da ação — nunca o uid/childId aqui, para não tornar
    // este registo um segundo canal de identificação; o `key` já não é
    // guardado (só serviu para localizar o contador). Alimenta o painel
    // administrativo (docs/admin-dashboard.md, "Falhas") sem expor a
    // quem foi recusado o pedido.
    await writeAuditEvent({ action: 'abuse.rate_limited', metadata: { action } });
    throw new HttpsError(
      'resource-exhausted',
      'Demasiados pedidos num curto período. Tente novamente dentro de alguns minutos.'
    );
  }
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Limiares documentados e configuráveis — ver docs/security-hardening.md.
const LIMITS = {
  AI_ASK_PER_USER: { limit: 30, windowMs: HOUR_MS },
  AI_ASK_PER_CHILD: { limit: 15, windowMs: HOUR_MS },
  INSIGHTS_PER_USER: { limit: 10, windowMs: HOUR_MS },
  INSIGHTS_PER_CHILD: { limit: 5, windowMs: HOUR_MS },
  REPORT_PER_USER: { limit: 20, windowMs: HOUR_MS },
  SHARE_LINK_PER_USER: { limit: 10, windowMs: DAY_MS },
  EXPORT_PER_USER: { limit: 5, windowMs: DAY_MS },
};

/** Aplica um limite por utilizador E um limite por criança, em paralelo. */
async function enforcePerUserAndChildLimit(action, uid, childId, userLimit, childLimit) {
  await Promise.all([
    enforceRateLimit(`${action}:user:${uid}`, { ...userLimit, action }),
    enforceRateLimit(`${action}:child:${childId}`, { ...childLimit, action }),
  ]);
}

async function enforcePerUserLimit(action, uid, userLimit) {
  await enforceRateLimit(`${action}:user:${uid}`, { ...userLimit, action });
}

module.exports = {
  LIMITS,
  enforceRateLimit,
  enforcePerUserAndChildLimit,
  enforcePerUserLimit,
};
