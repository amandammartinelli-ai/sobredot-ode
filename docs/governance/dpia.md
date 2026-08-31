# Avaliação de Impacto sobre a Proteção de Dados (AIPD/DPIA) — RASCUNHO

> Ver `README.md` desta pasta: rascunho de engenharia, não uma AIPD
> juridicamente válida. Uma AIPD real exige, ao abrigo do RGPD (art.
> 35.º), consulta ao encarregado de proteção de dados (se existir) e,
> nos casos aplicáveis, à CNPD — nenhuma das duas ocorreu.

## 1. Porque é necessária uma AIPD

O RGPD exige uma AIPD quando o tratamento é suscetível de resultar num
elevado risco para os direitos e liberdades das pessoas — em particular
quando envolve **dados de categoria especial em grande escala** (art.
9.º) ou **dados de crianças**. A Sobredot cruza as duas condições: dados
prováveis de saúde/necessidades específicas (ver `data-map.md`) sobre
crianças, que não são as titulares do consentimento. Uma AIPD é quase
certamente obrigatória antes de qualquer dado real — esta é a conclusão
mais importante deste rascunho, não uma formalidade.

## 2. Descrição do tratamento

- **Quem**: famílias (proprietário + cuidadores), com acesso pontual e
  temporário de colaboradores escolares/profissionais mediante
  concessão explícita.
- **O quê**: ver `data-map.md` — registos do quotidiano, medicação,
  documentos/laudos, e as narrativas/insights derivados deles.
- **Porquê**: dar às famílias uma visão longitudinal e organizada do
  percurso da criança, hoje dispersa por cadernos, memória e
  conversas soltas.
- **Como**: aplicação Web (Firebase Auth + Firestore + Storage + Cloud
  Functions, região UE), com um gateway de IA local (sem modelo de
  terceiros nesta etapa — ver `docs/vendors.md`) para "Perguntar aos
  documentos" e para gerar narrativas de padrões.

## 3. Necessidade e proporcionalidade

- O tratamento é necessário para o propósito declarado — não existe uma
  forma de dar "uma visão longitudinal" sem reter os registos ao longo
  do tempo.
- Minimização já aplicada: nenhum campo de texto livre é obrigatório
  para além do mínimo por categoria (ver `docs/data-model.md`); o
  gateway de IA nunca envia dados a um modelo de terceiros nesta etapa;
  os logs nunca contêm o conteúdo em si (ver `docs/logging-policy.md`).
- Pendência para o jurista: confirmar se o período de retenção "enquanto
  a família existir" (sem limite temporal automático para os registos
  em si, só para os técnicos) é proporcional, ou se deve haver um limite
  também para os dados de conteúdo.

## 4. Riscos identificados e mitigação

| Risco para o titular | Mitigação técnica existente | Resíduo / pendência |
|---|---|---|
| Acesso cruzado entre famílias | Isolamento por `firestore.rules` + `resolveChildAccess`, testado (86+ testes de integração, ver `docs/threat-model.md`) | Nenhuma falha conhecida; continua a ser o critério de bloqueio nº1 do lançamento |
| Um colaborador ver mais do que devia | Concessões de acesso com âmbito, capacidades e prazo explícitos, sem acesso por omissão | Depende da família conceder o âmbito correto — erro humano possível |
| A IA "inventar" factos sobre a criança (alucinação) ou fazer diagnóstico/prescrição | Resposta sempre fundamentada nos documentos recuperados, com bloqueio de padrões de diagnóstico/dose/certeza absoluta (ver `functions/src/ai.js`) e suite de avaliação dedicada (`tests/rules/aiSafetyEvals.integration.test.js`) | Os padrões de bloqueio são heurísticos (regex) — podem ter falsos negativos com fraseologia nova; nenhum modelo de IA real foi ainda avaliado |
| Exposição de dados de saúde num incidente de segurança | Cifra em trânsito e em repouso (padrão Firebase), regras de acesso, ausência de segredos no cliente | Sem seguro/plano de resposta a incidente formalizado com terceiros — ver `incident-response-policy.md` |
| Retenção indefinida de dados sensíveis | Direitos de eliminação/exportação implementados (`data-rights.md`) | Eliminação depende de pedido ativo da família — não há uma política de retenção máxima automática para o conteúdo em si |
| Criança sem capacidade de consentir, nem de ser ouvida sobre os dados que a descrevem | Informação adequada à idade prevista (`child-information-draft.md`) | Sem mecanismo real de assentimento ativo da criança (nem é claro que deva existir um, dependendo da idade) — decisão do jurista |
| Uso da funcionalidade de IA para decisões automáticas sobre a criança (ex.: escolares) | Bloqueio explícito de "decisão escolar automática" no gateway de IA | Depende de manter os padrões de deteção atualizados |

## 5. Direitos dos titulares

Ver `data-rights.md` para a implementação de acesso, retificação (via
edição direta pelos próprios ecrãs), portabilidade (exportação
estruturada), restrição de processamento por IA, e apagamento
(eliminação reforçada com prazo de reflexão).

**Titular dos direitos**: o(s) responsável(is) parental(is)/tutor(es)
da criança, nunca a criança diretamente nesta fase (ver
`child-information-draft.md`).

## 6. Conclusão (a preencher pelo jurista)

- [ ] Confirmar a base jurídica de cada categoria de dados
      (`data-map.md`).
- [ ] Confirmar se a mitigação técnica reduz o risco residual a um nível
      aceitável, ou se são necessárias medidas adicionais antes do
      portão 2 do piloto (`docs/pilot-plan.md`).
- [ ] Decidir se é necessária consulta prévia à CNPD (RGPD art. 36.º).
- [ ] Assinar e datar.
