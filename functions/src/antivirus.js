/**
 * Interface de análise antimalware — NUNCA simulada como segura.
 *
 * Esta etapa não tem acesso, no ambiente onde corre, a nenhum serviço real
 * de antivírus (ex.: ClamAV num Cloud Run próprio, ou uma API de terceiro
 * contratada). Em vez de fingir que os ficheiros são analisados, o
 * adaptador por omissão RECUSA sempre — o pipeline fica bloqueado em
 * "quarantine" até que um adaptador real seja configurado.
 *
 * Para desenvolvimento local (emulador), um adaptador explícito de
 * passagem está disponível, mas só quando a função corre dentro do
 * próprio emulador (FUNCTIONS_EMULATOR=true, definido automaticamente
 * pelo Firebase, nunca pelo nosso código) — nunca em produção, mesmo que
 * mal configurado.
 *
 * Para ligar um serviço real: implemente `scanBuffer(buffer)` devolvendo
 * `{ clean: boolean, reason?: string, engine: string }` e substitua
 * `getAntivirusAdapter()` abaixo. Nenhuma outra parte do pipeline precisa
 * de mudar.
 */

class BlockingAntivirusAdapter {
  // eslint-disable-next-line class-methods-use-this
  async scanBuffer() {
    return {
      clean: false,
      engine: 'none',
      reason: 'Nenhum serviço de antivírus real está configurado nesta implantação.',
    };
  }
}

class DevPassthroughAntivirusAdapter {
  // eslint-disable-next-line class-methods-use-this
  async scanBuffer() {
    return {
      clean: true,
      engine: 'dev-passthrough (SÓ EMULADOR — nunca usar em produção)',
      reason: null,
    };
  }
}

function getAntivirusAdapter() {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  const explicitDevOverride = process.env.SOBREDOT_AV_DEV_PASSTHROUGH === 'true';

  if (isEmulator && explicitDevOverride) {
    return new DevPassthroughAntivirusAdapter();
  }
  return new BlockingAntivirusAdapter();
}

module.exports = { getAntivirusAdapter, BlockingAntivirusAdapter, DevPassthroughAntivirusAdapter };
