# Runbook — rotação de segredos

Ver `docs/threat-model.md`, risco 2, e `docs/security-hardening.md`
para o inventário do que é e não é secreto no sistema atual.

## Inventário de segredos (o que existe hoje)

| Segredo | Onde vive | Nunca deve estar em |
|---|---|---|
| Conta de serviço do Firebase Admin SDK (produção) | Ambiente de execução das Cloud Functions (gerido pela própria plataforma) / variável local só para `scripts/bootstrap-admin.js` | Repositório git, `.env` commitado, logs |
| Chave reCAPTCHA (App Check) | Variável de ambiente Netlify (`VITE_FIREBASE_APPCHECK_SITE_KEY`) — é uma chave PÚBLICA por natureza (visível no bundle do cliente), não segredo no sentido estrito | — |
| Futura chave de fornecedor de IA (quando contratado — ver `docs/vendors.md`) | Secret Manager do Google Cloud, referenciado pela Cloud Function em runtime | Código-fonte, variável de ambiente do frontend (nunca — o frontend nunca fala diretamente com um fornecedor de IA) |
| Palavra-passe da conta de demonstração (`scripts/seed-emulator.js`) | Só existe no Auth Emulator local — nunca uma credencial real, não aplicável a rotação |

## Quando rodar um segredo

- Rotina: pelo menos uma vez por ano, ou sempre que uma pessoa com
  acesso a um segredo deixa a equipa.
- Urgente: suspeita de exposição (commit acidental, log com o valor,
  dispositivo comprometido) — rodar **imediatamente**, antes de
  investigar a causa a fundo.

## Procedimento — conta de serviço do Firebase Admin SDK

1. Google Cloud Console → IAM & Admin → Service Accounts → selecionar a
   conta → separador "Keys".
2. Criar uma nova chave.
3. Atualizar a variável de ambiente/segredo onde a chave antiga estava
   configurada (nunca committar a nova chave a lado nenhum do
   repositório).
4. Confirmar que o novo valor funciona (ex.: correr
   `scripts/bootstrap-admin.js` em modo `--dry-run` contra um projeto de
   teste).
5. **Só depois** de confirmado o novo valor: revogar/apagar a chave
   antiga na mesma página.
6. Registar a rotação (data, motivo) — ver
   `docs/governance/incident-response-policy.md` se a rotação foi
   motivada por suspeita de exposição.

## Procedimento — futura chave de fornecedor de IA

1. Gerar uma nova chave no painel do fornecedor.
2. Atualizar o valor no Secret Manager do Google Cloud (nunca noutro
   sítio).
3. Confirmar que a Cloud Function lê o novo valor sem reiniciar
   manualmente nada de especial (o Secret Manager já trata isso).
4. Revogar a chave antiga no painel do fornecedor.

## Se um segredo for encontrado exposto (git, log, ecrã partilhado)

1. Rodar o segredo imediatamente (procedimento acima) — antes de
   qualquer outra investigação.
2. Se exposto em git: mesmo depois de removido de um commit novo, o
   valor antigo continua no histórico — a chave tem de ser considerada
   comprometida e rodada, nunca "limpa" do histórico como solução
   suficiente por si só.
3. Seguir `docs/governance/incident-response-policy.md` para avaliar se
   isto é um incidente de dados pessoais notificável (depende do que o
   segredo dava acesso).
