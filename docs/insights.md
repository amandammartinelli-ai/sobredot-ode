# Inteligência Integrada — fórmulas, limiares e modelo de insight (Etapa 4)

Este documento é a referência de verdade para tudo o que a "Visão
Integrada" calcula e mostra. Qualquer alteração às fórmulas ou aos
limiares tem de ser refletida aqui e testada em
`functions/test/metrics.test.js`, `functions/test/patterns.test.js` e
`functions/test/insights.test.js`.

## Separação arquitetural (não negociável)

| Camada | Onde vive | O que pode fazer |
|---|---|---|
| **(A) Métricas determinísticas** | `functions/src/metrics.js` | Contagens, médias, medianas, percentagens, distribuições. Funções puras, sem IA. |
| **(B) Padrões estatísticos descritivos** | `functions/src/patterns.js` | Taxas de coocorrência entre categorias, sempre com amostra e confiança. Nunca afirma causa. Funções puras. |
| **(C) Narrativa** | `functions/src/insights.js` | Interpola os números de (A)/(B) em frases fixas. Nunca calcula, nunca inventa um número, nunca afirma causa. Equivalente ao adaptador mock da Etapa 3: organiza, não gera livremente. |

Todas as funções de (A) e (B) são puras (sem `Date.now()` implícito, sem
I/O) — recebem a hora "agora" e o fuso horário como argumentos
explícitos, para serem testáveis com conjuntos de dados conhecidos e
imunes ao fuso horário do processo do servidor.

## Períodos

`resolvePeriod(periodKey, customRange, now)` — `periodKey` ∈ `'7d' | '30d'
| '90d' | 'custom'`. Para `'custom'`, `customRange` tem de indicar
`start`/`end` (aceita `Date`, string ISO ou número de milissegundos).

## Amostra e distribuição de fontes

`buildSampleInfo(records, period, timeZone)` devolve:

- `sampleSize` — registos ativos (não eliminados) dentro do período.
- `totalDays`, `daysWithRecords`, `daysWithoutRecords`.
- `sourceDistribution` — `{ family, school, professional, other }`.

O dia de calendário de cada registo (`dayKey`) é sempre calculado num
fuso horário **explícito** (`Intl.DateTimeFormat` com `timeZone`), nunca
no fuso horário do processo Node do servidor — testado explicitamente
com o mesmo instante UTC a cair em dias/baldes horários diferentes
consoante o fuso pedido (`tests/rules` e `functions/test/metrics.test.js`).

## Limiares documentados e configuráveis

Todos em `functions/src/metrics.js`, exportados como `THRESHOLDS`:

| Limiar | Valor | Efeito |
|---|---|---|
| `MIN_SAMPLE_FOR_PATTERN` | 5 | Abaixo disto, um padrão nunca é mostrado — aparece "dados insuficientes". |
| `MIN_FOR_MEDIUM_CONFIDENCE` | 15 | A partir daqui, confiança sobe de "baixa" para "média". |
| `MIN_FOR_HIGH_CONFIDENCE` | 30 | A partir daqui, confiança "alta". |
| `MIN_DAYS_FOR_TIME_OF_DAY` | 3 | Dias distintos mínimos para calcular distribuição por hora do dia. |

`confidenceForSampleSize(n)` mapeia diretamente estes limiares para
`'insufficient' | 'low' | 'medium' | 'high'`.

## Métricas calculadas (`metrics.js`)

Frequência por categoria, distribuição de intensidade (com tendência
"mais/menos intensidade alta na segunda metade do período" — nunca
"melhorou"/"piorou"), duração (média/mediana), distribuição por hora do
dia, contexto (`onde`/`com quem` mais frequentes), recorrência de
antecedentes, sono (despertares noturnos), alimentação (menções de
apetite/recusa), adesão à medicação (dias com registo vs. dias com dose
efetivamente marcada como dada — nunca confunde "sem registo" com "não
tomou"), participação escolar, comunicação, sensorialidade.

## Cruzamentos (`patterns.js`)

Todos usam `coOccurrenceByDay` — uma taxa de coocorrência genérica entre
uma condição e um resultado, agrupada por dia de calendário (fuso
explícito): `rateWithCondition` vs. `rateWithoutCondition`, mais
`insufficientData`/`confidence`. **Nunca** devolve "causa" — só a
contagem e a taxa.

| Cruzamento | Condição | Resultado |
|---|---|---|
| `analyzeSleepVsIntensity` | despertares noturnos / sono referido como fraco | intensidade emocional alta |
| `analyzeEnvironmentVsDysregulation` | menção a ambiente ruidoso/cheio | intensidade alta ou comportamento registado |
| `analyzeFoodHydrationVsWellbeing` | recusa alimentar registada | sinais de mal-estar |
| `analyzeMedicationVsEffects` | dose de medicação marcada como dada | efeitos colaterais ou intensidade alta |
| `analyzeSchoolEventsVsEmotions` | registo escolar no dia | intensidade emocional alta |
| `analyzeStrategiesVsOutcomes` | estratégia de regulação registada | resultado descrito como positivo |
| `analyzeDocumentRecommendationsVsObservations` | recomendação/estratégia confirmada num documento aprovado | registos do quotidiano com palavras semelhantes (correspondência simples por palavra-chave, sem NLP — mesma limitação documentada na Etapa 3, decisão 17) |
| `compareAssessments` | — | compara dois documentos (o mais recente e o anterior) por categoria/texto normalizado: o que permaneceu, mudou, surgiu, deixou de constar. **Nunca** interpreta ausência como "resolvido" — a limitação é sempre incluída no resultado. |

## Modelo de Insight

Cada insight persistido em `children/{childId}/insights/{insightId}`
contém exatamente os campos pedidos:

| Campo | Descrição |
|---|---|
| `title` | Título neutro (nunca causal, nunca clínico). |
| `factualObservation` | Frase montada por template a partir de números já calculados. |
| `possiblePattern` | Frase de coocorrência ("foi observado em conjunto"), `null` quando `insufficientData`. |
| `evidence[]` | Cada número citado no texto tem de estar aqui — ver "Verificação de fundamentação" abaixo. |
| `metricsSnapshot` (implícito em `evidence`) | — |
| `period` | `{ key, startAt, endAt }`. |
| `sources[]` | Fontes presentes nos dados considerados. |
| `sampleSize`, `daysWithRecords`, `daysWithoutRecords` | — |
| `confidence` | `'insufficient' \| 'low' \| 'medium' \| 'high'`. |
| `limitations[]` | Sempre inclui, no mínimo, o aviso de que uma queda de episódios pode significar melhoria, falta de registos ou mudança de ambiente, e que a análise não substitui profissionais. |
| `safeActions[]` | Sempre `{id:'continue_observing', label:'Continuar a observar'}` e `{id:'discuss_with_professional', label:'Levar esta pergunta ao profissional'}` — nunca orientação clínica. |
| `generatedAt`, `generatedBy`, `methodVersion` | `methodVersion` atual: `insights-v1`. |
| `status` | `'not_reviewed' \| 'family_reviewed' \| 'professional_validated' \| 'contested'`. |
| `deletedAt` | Exclusão lógica (reservado; nenhuma função apaga insights nesta etapa). |

`children/{childId}/insights/{insightId}/statusHistory/{entryId}` — uma
entrada imutável por mudança de estado: `status`, `actorUid`,
`actorRole` (`'family' | 'professional'`), `comment`, `createdAt`.

### Guardas de qualidade da narrativa (defesa em profundidade)

Três verificações correm sobre **todo** insight antes de ser persistido
(`functions/src/insights.js`, aplicadas no fim de
`buildInsightsForPeriod`):

1. **`assertNoCausalLanguage(text)`** — deteta "provoca", "causa"/"causou"/"causam",
   "faz com que", "leva a", "responsável por", "desencadeia", "por
   causa de". Se algum padrão bate, o insight é substituído por um texto
   seguro ("Insight indisponível").
2. **`assertNumbersAreGrounded(text, evidence)`** — extrai todos os
   números do texto e verifica que cada um aparece literalmente entre os
   valores de `evidence`. Isto obrigou a incluir explicitamente na
   evidência números que, à primeira vista, pareciam "óbvios" mas não
   estavam citados em lado nenhum (ex.: `totalDays` no resumo do
   período, `matches.length` nas recomendações documentais) — um
   verdadeiro caso de teste que falhou durante o desenvolvimento e
   obrigou a corrigir o código, não o teste.
3. **`containsBlockedIntent(text)`** (reutilizada de `ai.js`) — o mesmo
   bloqueio de diagnóstico/prescrição/medicação/classificação da Etapa
   3, aplicado também à narrativa de insights.

Qualquer violação substitui o insight completo por um texto de bloqueio
neutro, nunca expõe o texto original problemático.

## Processo de validação profissional

Reutiliza integralmente o mecanismo de concessões de acesso da Etapa 2
(`accessGrants`/`accessIndex`) — não existe um convite "profissional"
separado:

1. A família cria uma concessão (`createAccessGrant`) com
   `role: 'professional_reviewer'`, `capabilities` incluindo `'validate'`
   e `scopeCategories` incluindo `'insights'` (novo pseudo-âmbito desta
   etapa, a par de `'documents'` e `'goals'`).
2. A família recebe um link (`#/colaborador/{childId}/{grantId}`) para
   partilhar diretamente com a pessoa — o mesmo padrão de link manual dos
   convites de família (decisão 13), nunca envio automático de e-mail.
3. A pessoa convidada (só precisa de uma conta autenticada normal — "não
   exige cadastro profissional", ver `docs/permissions.md`) abre o link,
   confirma a aceitação (`acceptAccessGrant`, que verifica que o e-mail
   corresponde) e passa a aceder a `#/colaborador/{childId}`.
4. Nessa área, só vê os insights (nunca os registos originais, a menos
   que a concessão também cubra essas categorias) e só pode **comentar,
   confirmar ou contestar** — nunca editar `evidence`/`factualObservation`.
   Isto é garantido estruturalmente: `setInsightStatus` só altera
   `status` e acrescenta uma entrada em `statusHistory`; nunca toca em
   mais nenhum campo do documento.
5. A família revoga o acesso a qualquer momento
   (`revokeAccessGrant`) — a concessão expirada/revogada é sempre
   verificada em tempo real (`resolveChildAccess`), nunca por um campo
   `status` armazenado. Testado explicitamente com uma concessão
   expirada perdendo a capacidade de validar
   (`tests/rules/insightsAndReports.integration.test.js`).

## Fluxo de relatórios e partilha

1. **Construção** (`generateReport`) — o utilizador escolhe período,
   módulos (`summary`, `timeline`, `insights`, `documents`, `goals`) e,
   para o módulo de documentos, exatamente que documentos aprovados
   incluir. O servidor recusa qualquer documento que não esteja
   `approved` e não eliminado, mesmo que pedido explicitamente. Devolve
   também `sensitivePreview` (contagem de registos, se inclui
   medicação, quantos documentos) para a pré-visualização obrigatória de
   informação sensível.
2. **Impressão** — o relatório é sempre HTML, com uma secção
   `#report-printable` pronta para `window.print()`. **Não existe
   geração binária de PDF no servidor nesta etapa** — "Guardar como PDF"
   usa a função nativa de impressão do browser sobre este HTML. Ver
   "Limitações conhecidas" abaixo.
3. **Partilha** (`createReportShareLink`) — o conteúdo é **recalculado
   no servidor** a partir dos parâmetros (nunca aceite do cliente já
   pronto) e guardado **congelado** em `reportSnapshot` no momento da
   criação — uma alteração posterior aos dados originais não muda o que
   já foi partilhado. Um token opaco (32 bytes aleatórios) é gerado; só
   o seu hash SHA-256 é guardado em Firestore. O link
   (`#/relatorio-partilhado/{childId}/{shareId}/{token}`) nunca é uma
   leitura direta do Firestore — só a Cloud Function `getSharedReport`
   verifica o hash (comparação "timing-safe",
   `crypto.timingSafeEqual`) e devolve o conteúdo. Nenhum dado sensível
   entra no próprio link — o token é opaco, sem relação com nome da
   criança/família.
4. **Revogação e expiração** — `revokeReportShareLink` marca
   `revokedAt`; `getSharedReport` recusa sempre que `revokedAt` esteja
   definido ou `expiresAt` já tenha passado, com mensagens distintas
   ("revogada" vs. "expirou"), testado explicitamente.
5. Todo relatório traz sempre o aviso: "apoio à comunicação e ao
   acompanhamento; não constitui diagnóstico ou orientação médica."

## Biblioteca ODE

`src/data/mock/odeLibrary.js` + `#/biblioteca-ode` — recursos educativos
gerais, acessível só por navegação explícita da família (nunca sugerida
automaticamente pela IA, nunca misturada com um insight). Nenhum recurso
é apresentado como necessidade clínica nem como produto pago.

## Limitações conhecidas desta etapa

- **Sem geração binária de PDF** — só HTML imprimível (ver acima).
- **Correspondência por palavra-chave, não NLP** — tanto
  `analyzeDocumentRecommendationsVsObservations` como o gateway de IA da
  Etapa 3 usam correspondência simples de palavras, não embeddings.
- **`evolution` só compara os dois documentos aprovados mais recentes** —
  não existe ainda uma linha temporal completa de todas as avaliações.
- **Filtros da Visão Integrada** (fonte/categoria/contexto) afetam só o
  resumo do período calculado no cliente; os padrões/cruzamentos abaixo
  são sempre calculados pelo servidor sobre todos os registos do
  período selecionado (sem esses filtros adicionais) — documentado na
  própria interface.
- **"Perguntas para a próxima consulta" ficam em `localStorage`**, por
  dispositivo — não são sincronizadas entre dispositivos nem partilhadas
  automaticamente com quem tem acesso à criança.
- **Um profissional nunca gera insights** — só a família (ver
  `generateInsights`); o profissional só comenta/valida/contesta os já
  existentes.
