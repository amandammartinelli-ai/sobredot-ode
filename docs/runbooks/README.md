# Runbooks operacionais — Etapa 5

Procedimentos passo-a-passo para quem estiver de plantão. Distintos dos
documentos narrativos (`docs/threat-model.md`,
`docs/security-hardening.md`, `docs/governance/`) — estes são para
seguir durante um incidente ou uma operação de rotina, não para ler uma
vez só.

| Runbook | Quando usar |
|---|---|
| [`backup-restore.md`](./backup-restore.md) | Configurar backups antes de dados reais; testar um restauro; recuperar de perda de dados |
| [`secret-rotation.md`](./secret-rotation.md) | Rotina anual, mudança de equipa, ou suspeita de exposição de um segredo |
| [`vulnerability-response.md`](./vulnerability-response.md) | PR do Dependabot; `npm audit`; aviso de segurança externo |
| [`incident-response.md`](./incident-response.md) | Passos técnicos de deteção/contenção/correção — corre em paralelo com `docs/governance/incident-response-policy.md` (obrigações legais) |
| [`deploy-rollback.md`](./deploy-rollback.md) | Reverter um deploy do frontend, de regras, de índices ou de Cloud Functions |
