// @vitest-environment node
//
// Testes de integração do anti-abuso (Etapa 5): chama diretamente
// enforceRateLimit/enforcePerUserAndChildLimit contra o Firestore
// Emulator, com o Admin SDK — mesmo padrão de
// resolveChildAccess.integration.test.js.
import { beforeEach, describe, it, expect } from 'vitest';
import { db } from '../../functions/src/init.js';
import { enforceRateLimit, enforcePerUserAndChildLimit } from '../../functions/src/rateLimit.js';

beforeEach(async () => {
  const snap = await db.collection('rateLimits').listDocuments();
  await Promise.all(snap.map((d) => d.delete()));
});

describe('enforceRateLimit', () => {
  it('permite pedidos dentro do limite', async () => {
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await enforceRateLimit('test:a', { limit: 3, windowMs: 60000, action: 'test' });
    }
  });

  it('recusa (falha segura) quando o limite é excedido na mesma janela', async () => {
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await enforceRateLimit('test:b', { limit: 3, windowMs: 60000, action: 'test' });
    }
    await expect(enforceRateLimit('test:b', { limit: 3, windowMs: 60000, action: 'test' })).rejects.toThrow(
      /Demasiados pedidos/
    );
  });

  it('reinicia a contagem numa nova janela', async () => {
    for (let i = 0; i < 2; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await enforceRateLimit('test:c', { limit: 2, windowMs: 1, action: 'test' });
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    await enforceRateLimit('test:c', { limit: 2, windowMs: 1, action: 'test' });
  });

  it('contadores de chaves diferentes são independentes', async () => {
    await enforceRateLimit('test:d1', { limit: 1, windowMs: 60000, action: 'test' });
    await enforceRateLimit('test:d2', { limit: 1, windowMs: 60000, action: 'test' });
  });
});

describe('enforcePerUserAndChildLimit', () => {
  it('aplica os dois limites (utilizador e criança) — o mais apertado vence', async () => {
    const userLimit = { limit: 5, windowMs: 60000 };
    const childLimit = { limit: 2, windowMs: 60000 };

    await enforcePerUserAndChildLimit('ai_ask_test', 'uid-1', 'child-1', userLimit, childLimit);
    await enforcePerUserAndChildLimit('ai_ask_test', 'uid-1', 'child-1', userLimit, childLimit);

    // Terceiro pedido para a mesma criança excede o limite por criança,
    // mesmo que o limite por utilizador ainda não tenha sido atingido.
    await expect(
      enforcePerUserAndChildLimit('ai_ask_test', 'uid-1', 'child-1', userLimit, childLimit)
    ).rejects.toThrow(/Demasiados pedidos/);
  });

  it('o limite por criança não afeta outra criança do mesmo utilizador', async () => {
    const userLimit = { limit: 10, windowMs: 60000 };
    const childLimit = { limit: 1, windowMs: 60000 };

    await enforcePerUserAndChildLimit('ai_ask_test2', 'uid-2', 'child-a', userLimit, childLimit);
    await enforcePerUserAndChildLimit('ai_ask_test2', 'uid-2', 'child-b', userLimit, childLimit);
  });
});
