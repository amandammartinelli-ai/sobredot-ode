# Mapa de dados — RASCUNHO (ver `README.md` desta pasta)

Construído a partir do esquema real (`docs/data-model.md`). "Base
jurídica a validar" nunca é uma conclusão — é a hipótese de engenharia
mais plausível ao abrigo do RGPD, para um jurista confirmar, ajustar ou
rejeitar. Sem essa confirmação, nenhuma linha desta tabela autoriza o
processamento de dados reais.

## Convenções da tabela

- **Região**: `europe-west1` (Bélgica) para Firestore/Storage/Functions
  — ver `docs/firebase-setup.md`, "Região". Nenhum dado sai da UE/EEE
  nesta etapa.
- **Fornecedor**: só Google Firebase nesta etapa — ver `docs/vendors.md`
  para o que falta contratar antes de ligar qualquer outro.
- **Partilha**: com quem os dados são partilhados por desenho do
  produto (nunca partilha com terceiros para fins de marketing/venda —
  isso nunca acontece em nenhuma categoria).

## Dados de identidade e conta

| | |
|---|---|
| **Dado** | Nome, e-mail, palavra-passe (gerida só pelo Firebase Auth, nunca vista pela aplicação) |
| **Finalidade** | Autenticação, comunicação operacional (recuperação de conta, notificações do próprio produto) |
| **Base jurídica a validar** | Execução de contrato (RGPD art. 6.º/1/b) — necessário para prestar o serviço pedido |
| **Origem** | Fornecido diretamente pelo titular no registo |
| **Armazenamento** | Firebase Authentication + `users/{uid}` (Firestore) |
| **Região** | UE (europe-west1 para Firestore; Firebase Auth não permite escolher região de forma independente — a confirmar com o fornecedor se isto é aceitável) |
| **Acesso** | O próprio utilizador; administrador técnico só a metadados operacionais (nunca a palavra-passe, que nem a Sobredot consegue ler) |
| **Fornecedor** | Google Firebase |
| **Retenção** | Enquanto a conta existir; eliminada com o pedido de eliminação da família (ver "Direitos da família" abaixo) — nota: a conta Firebase Auth em si não é apagada automaticamente nesta etapa (ver `docs/governance/data-rights.md`, "Fora do âmbito") |
| **Eliminação** | Manual/pendente — ver nota acima |
| **Partilha** | Nenhuma |

## Dados estruturais de família e criança

| | |
|---|---|
| **Dado** | Nome da família, nome e data de nascimento da criança, papel de cada membro (`families`, `children`, `members`) |
| **Finalidade** | Organizar o acesso e a visão por criança — o núcleo do produto |
| **Base jurídica a validar** | Execução de contrato; para a criança, também interesse legítimo dos pais/responsáveis no acompanhamento (a confirmar a formulação exata) |
| **Origem** | Fornecido pela família |
| **Armazenamento** | Firestore, `families/{familyId}`, `children/{childId}` |
| **Região** | UE (europe-west1) |
| **Acesso** | Membros da família; colaboradores/profissionais com concessão de acesso ativa e explícita (nunca por omissão) |
| **Fornecedor** | Google Firebase |
| **Retenção** | Enquanto a família existir; eliminação lógica imediata (`deletedAt`) ao remover uma criança, eliminação física com o pedido de eliminação da família |
| **Eliminação** | `softDeleteChild` (lógica) e `deleteFamilyDataCompletely` (física, ver `docs/governance/data-rights.md`) |
| **Partilha** | Com colaboradores escolares/profissionais só dentro do âmbito e prazo de uma concessão de acesso explícita (`accessGrants`) |

## Registos do quotidiano (10 categorias)

| | |
|---|---|
| **Dado** | Emoções, comportamentos, sono, alimentação, medicação, escola, comunicação, sensorialidade, conquistas, observações — texto livre e campos estruturados por categoria (`children/{childId}/records`) |
| **Finalidade** | O propósito central do produto: construir uma visão longitudinal do percurso da criança |
| **Base jurídica a validar** | **Categoria especial de dados pessoais** (RGPD art. 9.º) sempre que revele informação de saúde ou de necessidades específicas — provavelmente **consentimento explícito** (art. 9.º/2/a) dos pais/responsáveis, nunca só o art. 6.º; a confirmar caso a caso por categoria (ex.: "conquistas" pode não ser categoria especial, "medicação" quase certamente é) |
| **Origem** | Fornecido pela família, ou por um colaborador escolar/profissional com concessão ativa e capacidade `register` |
| **Armazenamento** | Firestore, com histórico imutável de versões anteriores (`.../records/{id}/history`) |
| **Região** | UE (europe-west1) |
| **Acesso** | Membros da família; colaboradores/profissionais só nas categorias e capacidades expressamente concedidas |
| **Fornecedor** | Google Firebase |
| **Retenção** | Enquanto a família existir; eliminação física com o pedido de eliminação da família |
| **Eliminação** | Eliminação lógica imediata pelo utilizador (`softDeleteRecord`); física com `deleteFamilyDataCompletely` |
| **Partilha** | Com colaboradores/profissionais só dentro do âmbito de uma concessão ativa |

## Medicamentos

| | |
|---|---|
| **Dado** | Nome, dose, horário, quem prescreveu (`children/{childId}/medications`) |
| **Finalidade** | Registo de medicação em curso, para consulta pela família e por profissionais autorizados |
| **Base jurídica a validar** | Categoria especial de dados de saúde (art. 9.º) — consentimento explícito, a confirmar |
| **Origem** | Fornecido pela família |
| **Armazenamento** | Firestore |
| **Região** | UE |
| **Acesso** | Família; colaboradores/profissionais só com `scopeCategories` incluindo `'medication'` |
| **Fornecedor** | Google Firebase |
| **Retenção/Eliminação** | Igual aos registos do quotidiano |
| **Partilha** | Igual aos registos do quotidiano |

## Documentos/laudos (Cofre de Documentos)

| | |
|---|---|
| **Dado** | Ficheiros carregados (avaliações, relatórios escolares/clínicos) e o texto extraído deles; metadados (emissor, especialidade, tipo, data) |
| **Finalidade** | Centralizar documentação da criança e permitir "Perguntar aos documentos" |
| **Base jurídica a validar** | Categoria especial de dados de saúde (quase sempre) — consentimento explícito, a confirmar |
| **Origem** | Carregado pela família, escola ou profissional (com concessão ativa) |
| **Armazenamento** | Ficheiro em Cloud Storage; metadados e texto extraído em Firestore (`children/{childId}/documents`) |
| **Região** | UE (europe-west1) |
| **Acesso** | Família; colaboradores/profissionais com `scopeCategories` incluindo `'documents'` |
| **Fornecedor** | Google Firebase (armazenamento); nenhum fornecedor de OCR/antivírus real contratado ainda — ver `docs/vendors.md` |
| **Retenção** | 30 dias após eliminação lógica antes da remoção física do ficheiro (`RETENTION_DAYS_AFTER_DELETE`, `functions/src/documents.js`); eliminação imediata com o pedido de eliminação da família |
| **Eliminação** | `purgeExpiredDocuments` (faxina diária) e `deleteFamilyDataCompletely` |
| **Partilha** | Igual aos registos do quotidiano |

## Perguntas de IA ("Perguntar aos documentos")

| | |
|---|---|
| **Dado** | Metadados da pergunta (quem, quando, bloqueada/emergência, número/IDs de fontes) — **nunca o texto da pergunta nem da resposta** (ver `docs/logging-policy.md`) |
| **Finalidade** | Auditoria de segurança e limites de utilização; a resposta em si nunca é persistida |
| **Base jurídica a validar** | Interesse legítimo (segurança/anti-abuso) para os metadados; a resposta gerada não é "dado" persistido |
| **Origem** | Gerado pelo sistema a cada pedido |
| **Armazenamento** | Firestore, `children/{childId}/aiQueries` |
| **Região** | UE |
| **Acesso** | Administrador técnico (só contagens agregadas via painel — ver `docs/admin-dashboard.md`) |
| **Fornecedor** | Nenhum — o gateway de IA usa um adaptador local, nunca um modelo de terceiros nesta etapa (ver `docs/vendors.md`) |
| **Retenção** | 180 dias (`AI_QUERY_LOG_RETENTION_DAYS`), depois apagado por `purgeOldTechnicalLogs` |
| **Eliminação** | Automática por retenção; imediata com o pedido de eliminação da família |
| **Partilha** | Nenhuma |

## Insights, metas e relatórios partilhados

| | |
|---|---|
| **Dado** | Narrativas geradas a partir de padrões nos registos (`insights`), metas acompanháveis (`goals`), relatórios exportáveis e os seus links de partilha temporários (`reportShares`) |
| **Finalidade** | Apoiar decisões da família e comunicação com terceiros (ex.: escola) |
| **Base jurídica a validar** | Mesma base dos registos de origem (herda a categoria especial quando deriva de dados de saúde) |
| **Origem** | Gerado pelo sistema a partir de dados já existentes, ou introduzido pela família (metas) |
| **Armazenamento** | Firestore |
| **Região** | UE |
| **Acesso** | Família; um link de partilha de relatório dá acesso de leitura só ao conteúdo selecionado, com prazo de validade |
| **Fornecedor** | Google Firebase |
| **Retenção/Eliminação** | Igual aos registos do quotidiano; um link de partilha pode ser revogado a qualquer momento pela família |
| **Partilha** | Só através de um link de partilha explicitamente criado pela família, nunca automática |

## Auditoria técnica

| | |
|---|---|
| **Dado** | Ação, autor, alvo, `familyId`/`childId`, metadados técnicos — nunca conteúdo (ver `docs/logging-policy.md`) |
| **Finalidade** | Transparência para a família (histórico de acessos) e deteção de abuso |
| **Base jurídica a validar** | Interesse legítimo (segurança) e obrigação legal (evidenciar conformidade) |
| **Origem** | Gerado pelo sistema |
| **Armazenamento** | Firestore, `auditLog` |
| **Região** | UE |
| **Acesso** | Proprietário da própria família (só os seus eventos); administrador técnico |
| **Fornecedor** | Google Firebase |
| **Retenção** | Sem expiração automática definida nesta etapa — pendência a decidir com o jurista (comparar com prazos de prescrição aplicáveis) |
| **Eliminação** | Nunca pelo cliente (imutável por desenho) |
| **Partilha** | Nenhuma |

## Dados técnicos internos (sem valor pessoal direto)

| | |
|---|---|
| **Dado** | Contadores de limite de utilização (`rateLimits`), incidentes operacionais (`incidents`) |
| **Finalidade** | Anti-abuso e saúde operacional — nunca identificam uma família/criança de forma legível (ver `docs/admin-dashboard.md`) |
| **Base jurídica a validar** | Interesse legítimo (segurança/operação) |
| **Armazenamento** | Firestore |
| **Região** | UE |
| **Retenção** | 7 dias para contadores de limite (`RATE_LIMIT_COUNTER_RETENTION_DAYS`); incidentes sem expiração automática (registo histórico deliberado) |

## O que ainda falta neste mapa

- **Menores de idade e assentimento**: a criança não é titular de conta
  nem presta consentimento — ver
  `docs/governance/child-information-draft.md` para a abordagem de
  informação adequada à idade, sem transferir a responsabilidade do
  consentimento parental para a criança.
- **Transferências internacionais**: nenhuma nesta etapa (tudo em
  `europe-west1`); se um fornecedor de IA real vier a ser contratado, a
  sua localização/subprocessadores têm de ser adicionados aqui antes de
  ativar (ver `docs/vendors.md`).
- **Prazo de conservação do `auditLog`**: por decidir com o jurista.
