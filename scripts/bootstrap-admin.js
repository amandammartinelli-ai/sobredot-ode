/**
 * Atribui o papel de administrador técnico a UMA conta, uma única vez,
 * usando o Admin SDK com credenciais de serviço reais — NUNCA através de
 * um pedido HTTP (ver functions/src/adminClaims.js, `setAdminClaim`, que
 * só aceita ser chamada por um administrador já existente; este script
 * existe exatamente para o caso em que ainda não existe nenhum).
 *
 * Uso (contra um projeto Firebase REAL, nunca o emulador):
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/service-account.json \
 *     node scripts/bootstrap-admin.js --project=<project-id> --email=alguem@exemplo.pt --confirm
 *
 * Sem `--confirm`, o script só mostra o que faria (modo simulação) — é
 * deliberado: atribuir `admin:true` é uma ação de alto privilégio e
 * irreversível sem outra ação administrativa manual.
 *
 * Este script recusa-se a correr contra os hosts do Firebase Emulator
 * Suite — usar `scripts/seed-emulator.js` para desenvolvimento local.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function parseArgs(argv) {
  const args = {};
  argv.forEach((arg) => {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (match) args[match[1]] = match[2] ?? true;
  });
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      'Recusado: este script nunca deve correr contra o Firebase Emulator Suite. ' +
        'Use scripts/seed-emulator.js para desenvolvimento local.'
    );
  }

  if (!args.project) {
    throw new Error('Falta --project=<project-id>. Este script exige um projeto explícito, nunca um valor por omissão.');
  }
  if (!args.email && !args.uid) {
    throw new Error('Falta --email=<email> ou --uid=<uid> da conta a promover.');
  }

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: args.project,
  });
  const auth = getAuth(app);

  const user = args.uid ? await auth.getUser(args.uid) : await auth.getUserByEmail(args.email);

  console.log(`Projeto: ${args.project}`);
  console.log(`Conta encontrada: ${user.uid} (${user.email})`);
  console.log(`Custom claims atuais: ${JSON.stringify(user.customClaims || {})}`);

  if (!args.confirm) {
    console.log('\nModo simulação (sem --confirm) — nenhuma alteração foi feita.');
    console.log('Volte a correr com --confirm para atribuir admin:true a esta conta.');
    return;
  }

  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
  console.log(`\nConcluído: ${user.email} (${user.uid}) é agora administrador técnico.`);
  console.log('A alteração só tem efeito no próximo início de sessão / atualização de token dessa conta.');
  console.log('Registe esta ação fora da aplicação (ex.: ticket interno) — não existe auditoria automática para esta atribuição inicial, feita fora do Firestore.');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exitCode = 1;
});
