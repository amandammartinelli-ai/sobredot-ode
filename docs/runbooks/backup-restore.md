# Runbook — backups e restauro

Ver `docs/threat-model.md`, risco 19. **Nenhum backup está configurado
nesta etapa** (não existe ainda projeto Firebase de produção) — isto é
uma checklist a executar antes de qualquer piloto com dados reais, não
um registo do que já foi feito.

## Antes de dados reais (bloqueador de lançamento)

1. **Ativar exportações geridas do Firestore** (Google Cloud Console →
   Firestore → Importar/Exportar, ou `gcloud firestore export`) numa
   agenda regular (recomendação inicial: diária) para um bucket do
   Cloud Storage dedicado, numa região UE, com acesso restrito.
2. **Confirmar a retenção do bucket de backups** — versões antigas
   devem ter uma política de expiração própria (ex.: 30-90 dias),
   coerente com `docs/governance/data-map.md`.
3. **Cloud Storage (ficheiros do cofre de documentos)**: ativar
   versionamento de objetos no bucket de produção, para recuperar de
   uma eliminação acidental antes da purga de retenção normal (30 dias,
   `RETENTION_DAYS_AFTER_DELETE`).
4. **Restringir quem pode iniciar uma exportação/importação manual** a
   contas de administração da infraestrutura (não confundir com o papel
   de "administrador técnico" da aplicação, que nunca tem este acesso —
   ver `docs/threat-model.md`, risco 10).

## Testar um restauro (obrigatório antes do portão 2 do piloto)

Um backup nunca testado não conta como backup — ver
`docs/pilot-plan.md`.

1. Criar um projeto Firebase temporário, isolado (nunca o de
   produção nem o de staging).
2. Importar a exportação mais recente
   (`gcloud firestore import gs://<bucket>/<caminho-da-exportação>`)
   para esse projeto temporário.
3. Correr `npm run test:rules` contra esse projeto (ajustando
   `.firebaserc`/variáveis de ambiente temporariamente) para confirmar
   que os dados restaurados são estruturalmente válidos.
4. Verificar manualmente uma amostra: uma família, uma criança, um
   documento, um registo — confirmar que os dados batem certo com o que
   se esperava no momento da exportação.
5. Documentar a duração do processo (tempo até dados voltarem a estar
   disponíveis) — isto informa o objetivo de tempo de recuperação (RTO)
   comunicável às famílias em caso de incidente.
6. Apagar o projeto temporário no fim do teste.
7. Repetir este teste periodicamente (recomendação: a cada trimestre, ou
   depois de qualquer alteração estrutural relevante ao esquema de
   dados) — não é um exercício de uma vez só.

## Em caso de perda de dados real

1. Confirmar o âmbito exato da perda (que coleções/documentos, desde
   quando) antes de decidir restaurar — um restauro é ele próprio uma
   operação destrutiva sobre o estado atual.
2. Seguir `docs/governance/incident-response-policy.md` em paralelo —
   uma perda de dados de família/criança é, por definição, um incidente
   de dados pessoais a avaliar para notificação.
3. Restaurar para um projeto temporário primeiro (nunca diretamente
   sobre produção) e comparar com o estado atual antes de decidir o que
   efetivamente repor.
4. Nunca sobrescrever dados criados **depois** do momento da perda sem
   confirmação explícita de quem pediu o restauro.
