# Mapa de páginas — estado após Etapa 3

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
| `#/insights` | `insightsView` | autenticado + família | sim | Aviso de que o painel de cruzamentos ainda não existe; atalho para "Perguntar aos documentos" |
| `#/reports` | `reportsView` | autenticado + família | sim | Estado vazio (Etapa 4) |
| `#/family` | `familyView` | autenticado + família | sim | Membros, convites, concessões de acesso por criança, consentimentos, auditoria |
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
