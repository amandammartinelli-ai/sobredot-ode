# Mapa de páginas — estado após Etapa 4

| Rota | Vista | Acesso | Chrome | Descrição |
|---|---|---|---|---|
| `#/`, `#/welcome` | `welcomeView` | público | não | Apresentação, CTAs para login/criar conta, limites do produto |
| `#/login` | `loginView` | público | não | Início de sessão; aceita parâmetros extra de convite pendente |
| `#/signup` | `signupView` | público | não | Criação de conta |
| `#/reset-password` | `resetPasswordView` | público | não | Recuperação de palavra-passe |
| `#/aceitar-convite/:familyId/:inviteId/:token` | `acceptInviteView` | público (pede login se necessário) | não | Aceitar convite de família |
| `#/onboarding` | `onboardingView` | autenticado | não | Criar família + primeira criança |
| `#/dashboard` | `dashboardView` | autenticado + família | sim | Seletor de criança, cartões, botão REGISTAR, estatísticas dos últimos 7 dias |
| `#/crianca/novo`, `#/crianca/:id` | `childProfileView` | autenticado + família | sim | Criar/editar perfil da criança |
| `#/registar` | `registerView` | autenticado + família | sim | 10 categorias → formulário estruturado → confirmação → sucesso |
| `#/timeline` | `timelineView` | autenticado + família | sim | Linha do tempo com filtros (categoria, fonte), edição, eliminação lógica, histórico |
| `#/documents` | `documentsView` | autenticado + família | sim | Lista/filtros de documentos, upload, "Perguntar aos documentos" |
| `#/documento/:childId/:documentId` | `documentDetailView` | autenticado + família | sim | Metadados, revisão da extração, versões, aprovação/rejeição, eliminação |
| `#/insights` | `insightsView` | autenticado + família | sim | Visão Integrada: resumo, padrões/cruzamentos, estratégias, pontos para conversa, perguntas para a próxima consulta, metas |
| `#/reports` | `reportsView` | autenticado + família | sim | Construir relatório (módulos/documentos/período), pré-visualização sensível, impressão, links de partilha |
| `#/relatorio-partilhado/:childId/:shareId/:token` | `sharedReportView` | público (token verificado no servidor) | não | Vista só de leitura de um relatório partilhado, sem sessão |
| `#/biblioteca-ode` | `odeLibraryView` | autenticado + família | sim | Recursos educativos opcionais da ODE, separados da análise da criança |
| `#/colaborador/:childId` (e `/:grantId` na primeira vez) | `collaboratorView` | autenticado (sem família) | não | Área do colaborador externo: aceitar concessão; ver/validar/contestar insights dentro do âmbito concedido |
| `#/family` | `familyView` | autenticado + família | sim | Membros, convites, concessões de acesso por criança (agora com âmbitos `insights`/`goals`), consentimentos, auditoria |
| `#/profile` | `profileView` | autenticado + família | sim | Conta, verificação de e-mail, acessibilidade, privacidade, atalho para Família |
| qualquer outra | `notFoundView` | público | não | 404 interno |

## Guardas de acesso

Três níveis (`src/router/router.js`):

- **público** — sem sessão necessária.
- **autenticado** — exige sessão Firebase Auth; sem família ainda,
  redireciona para onboarding se tentar aceder a uma rota "autenticado +
  família".
- **autenticado + família** — exige `users/{uid}.familyId` resolvido
  (`findMyFamilyId`); sem isso, redireciona para `#/onboarding`.

## Fluxo de registo (detalhe)

```
Categorias (10)
   │ (escolher categoria)
   ▼
Formulário estruturado (campos comuns + detalhe por categoria)
   │ (validação: tem de haver algum conteúdo preenchido)
   │ (guardar registo)
   ▼
Diálogo de confirmação
   │ (confirmar)
   ▼
Estado de sucesso ──► Novo registo (volta às categorias)
                  └──► Ver linha do tempo
```

## Fluxo do cofre de documentos (detalhe)

```
Documentos (lista + filtros)
   │ (carregar documento: metadados + ficheiro)
   ▼
selected → uploading → quarantine → verifying → extracting → pending_review
   │                                                              │
   │                                                   (revisão humana
   │                                                    item a item)
   ▼                                                              ▼
 (erro/rejeitado)                                    approved ──► visão integrada
```

## Fluxo da Inteligência Integrada (detalhe)

```
Visão Integrada → "Atualizar leitura de padrões" (só família)
   │
   ▼
generateInsights (servidor): métricas + padrões + narrativa grounded
   │
   ▼
children/{childId}/insights (persistidos, status "não revisto")
   │
   ├── família: "Continuar a observar" / "Revisto pela família"
   │
   └── profissional convidado (âmbito "insights" + capacidade "validate")
           │ (#/colaborador/{childId})
           ▼
       "Validado por profissional" ou "Contestado" (+ comentário,
        histórico imutável — nunca edita o registo original)
```

## Fluxo de relatórios e partilha (detalhe)

```
Relatórios → escolher período + módulos + documentos aprovados
   │
   ▼
Pré-visualização (com aviso de informação sensível)
   │
   ├── Imprimir / Guardar como PDF (HTML imprimível do browser)
   │
   └── Criar link de partilha temporário
           │ (conteúdo recalculado e CONGELADO no servidor)
           ▼
      #/relatorio-partilhado/{childId}/{shareId}/{token} (sem sessão)
           │
           └── revogável a qualquer momento pela família; expira sozinho
```

## Fluxo de concessão de acesso (detalhe)

```
Família → Acessos de escola e profissionais
   │ (conceder: e-mail, papel, capacidades, âmbito, validade)
   ▼
Concessão "pendente" ──► pessoa convidada aceita (e-mail tem de corresponder)
   │
   ▼
Concessão "ativa" (visível para a família, revogável a qualquer momento)
```
