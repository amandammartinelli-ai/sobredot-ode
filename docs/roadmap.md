# Roadmap — cinco etapas

Este documento acompanha a construção gradual da Sobredot. Cada etapa deve
ser concluída, validada e aprovada antes de avançar para a seguinte.

## Etapa 1 — Fundação do produto ✅ concluída

- Estrutura de projeto, sistema de design, protótipo navegável com dados
  fictícios, i18n preparado, documentação inicial, configuração de
  build/deploy sem segredos reais.
- Sem autenticação real, sem upload de documentos, sem IA.

## Etapa 2 — Identidade, família, criança, permissões e registos ✅ concluída

- Firebase Authentication real (e-mail/palavra-passe, verificação de
  e-mail, recuperação de palavra-passe). Login social preparado, não
  ativado.
- Modelo de dados real: utilizadores, famílias, membros, convites,
  crianças, consentimentos, concessões de acesso, registos quotidianos
  estruturados, medicamentos, auditoria — ver `docs/data-model.md`.
- Papéis: responsável proprietário, cuidador familiar, colaborador da
  escola, profissional revisor, administrador técnico (sem acesso a
  conteúdo sensível por padrão) — ver `docs/permissions.md`.
- Regras do Firestore deny-by-default, custom claims só do servidor,
  auditoria imutável pelo cliente — 31 testes automatizados contra o
  Firebase Emulator Suite (`npm run test:rules`).
- Onboarding, gestão de família/convites/acessos, registo estruturado
  com as 10 categorias, linha do tempo com filtros/edição/histórico,
  dashboard com estatísticas descritivas simples, área de
  consentimentos.

## Etapa 3 — Cofre de Documentos e IA privada ✅ concluída

- Cloud Storage privado, sem acesso direto do cliente — upload/download
  sempre por URL assinada emitida por uma Cloud Function que verifica a
  permissão no Firestore (ver `docs/decisions.md`, decisão 14).
- Pipeline servidor de validação e extração: verificação de conteúdo
  real (assinatura de bytes), extração de texto real (PDF/DOCX),
  extração estruturada por heurística de secções, revisão humana
  obrigatória antes de qualquer item entrar na visão integrada.
- Interfaces reais de antivírus e OCR, sem serviço ligado — bloqueiam
  explicitamente em vez de simular segurança/capacidade inexistente.
- Gateway de IA privado ("Perguntar aos documentos"): isolamento por
  criança e família decidido sempre no servidor, defesa contra prompt
  injection, bloqueio de pedidos de diagnóstico/prescrição/alteração de
  medicação, respostas sempre citáveis. Nenhum fornecedor de IA real
  contratado — adaptador mock/heurístico, nunca usado para treinar
  nenhum modelo (ver `docs/vendors.md`).
- Teste canário de isolamento entre crianças na recuperação de contexto
  de IA (`tests/rules/aiRetrieval.canary.test.js`).

## Etapa 4 — Inteligência Integrada e relatórios controlados ✅ concluída

- Motor de métricas determinístico e motor de cruzamentos estatísticos
  descritivos, rigorosamente separados da narrativa — ver
  `docs/insights.md` para fórmulas, limiares e o modelo completo de
  insight (nunca calcula na camada de narrativa, nunca afirma causa,
  nunca inventa um número — garantido por três guardas testadas:
  `assertNoCausalLanguage`, `assertNumbersAreGrounded`,
  `containsBlockedIntent`).
- Área "Visão Integrada": resumo do período, padrões observados,
  estratégias com melhores resultados, pontos para conversa, gráficos
  acessíveis (com alternativa em tabela, nunca só por cor), comparação
  entre documentos, perguntas para a próxima consulta, metas
  acompanháveis com origem sempre identificada.
- Validação profissional opcional, reutilizando as concessões de acesso
  da Etapa 2 (nunca exige "cadastro profissional"): comentar, confirmar
  ou contestar um insight, sem nunca editar o registo original.
- Relatórios com escopo escolhido pela família (módulos, documentos,
  período), pré-visualização de informação sensível, impressão em HTML,
  e partilha por link temporário/revogável cujo conteúdo fica congelado
  no momento da criação — nunca uma leitura direta do Firestore (ver
  `docs/decisions.md`, decisão 18).
- Biblioteca de recursos educativos da ODE, opcional e claramente
  separada da análise da criança — nunca sugerida automaticamente.
- 49 testes de regras/integração (`npm run test:rules`) e 53 testes de
  Cloud Functions (`npm run test:functions`), incluindo os obrigatórios
  desta etapa: amostra pequena, período sem dados, fontes contraditórias,
  fuso horário, registo apagado, documento substituído, insight
  contestado, profissional revogado, relatório com escopo parcial, link
  expirado.

## Etapa 5 — Preparação para produção e lançamento (prevista)

- Ligação real a um fornecedor de IA, só depois de satisfeitos todos os
  requisitos contratuais documentados em `docs/vendors.md` (DPA,
  retenção, localização, subcontratantes, não uso para treino) —
  substituindo os adaptadores mock/heurísticos das Etapas 3 e 4.
- Geração real de PDF no servidor para relatórios (a Etapa 4 só entrega
  HTML imprimível — ver `docs/insights.md`, "Limitações conhecidas").
- Validação end-to-end de URLs assinadas de Storage num ambiente com
  credenciais reais (não verificável no sandbox de desenvolvimento desta
  etapa — ver `docs/firebase-setup.md`).
- Serviço real de antivírus e, se necessário, de OCR.
- Revisão de privacidade e segurança dedicada antes de qualquer dado
  real, incluindo avaliação de impacto se aplicável.
- Multi-família por criança (ex.: pais em agregados separados) — ver
  `docs/decisions.md`, decisão 11.
- Envio real de e-mail para convites (fornecedor a contratar).
- Notificações (push/e-mail) sem conteúdo sensível, alinhadas com
  `docs/logging-policy.md`.
- Auditoria e monitorização operacional para produção (alertas,
  dashboards de saúde do sistema).
- Deploy de produção do Firebase (projeto real, região confirmada,
  regras de Storage/Firestore publicadas, App Check obrigatório sem
  modo de depuração).

---

Este roadmap é indicativo e pode ser ajustado à medida que cada etapa é
validada com utilizadores reais (famílias, escolas, profissionais e
equipa da Oficina das Emoções).
