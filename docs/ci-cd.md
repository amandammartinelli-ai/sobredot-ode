# CI/CD e fluxo de branches — Etapa 5

## Fluxo de branches

- **Branch principal (`main`)** — protegido (ver "Proteção de branch"
  abaixo). É o único branch a partir do qual o Netlify publica produção
  (ver `docs/deploy-netlify.md`) e o único que os utilizadores reais
  veriam num piloto.
- **Branches de funcionalidade** (`feat/...`, `fix/...`,
  `chore/...`) — todo o trabalho é feito num branch próprio e integrado
  por *pull request*; nunca commit direto a `main`.
- Cada PR aberto contra `main` recebe automaticamente um **deploy
  preview** do Netlify (ver `docs/deploy-netlify.md`) e corre o workflow
  de CI (`.github/workflows/ci.yml`).

## Workflow de CI (`.github/workflows/ci.yml`)

Corre em cada PR e em cada push a `main`, com três jobs independentes
(falham independentemente, todos têm de passar):

| Job | O que verifica |
|---|---|
| `frontend` | `npm run lint`, `npm test` (testes unitários), `npm run build` |
| `functions` | `npm run lint` e `npm run test` dentro de `functions/` |
| `rules` | `npm run test:rules` — as 86 regras/testes de integração contra o Firebase Emulator Suite (Firestore + Storage), com um projeto de demonstração (`demo-sobredot-tests`) — nunca um projeto real |

Nenhum destes jobs precisa de segredos nem de acesso a um projeto
Firebase real: os testes de regras usam sempre o emulador. Isto significa
que o CI corre em qualquer fork ou PR externo sem expor credenciais.

## O que fica fora deste CI

- **Deploy automático de `firestore.rules`/`storage.rules`/Cloud
  Functions** — feito manualmente com `firebase deploy`, nunca por este
  workflow (ver "Critérios de bloqueio" em `docs/pilot-plan.md`: nenhuma
  alteração de regras ou índices vai para produção sem um plano de
  reversão documentado e revisão humana).
- **Auditoria de acessibilidade automatizada** (axe-core/Playwright) —
  ver `docs/accessibility.md`, deixada fora por introduzir uma
  dependência pesada nova sem decisão explícita do produto.
- **Publicação em produção** — inteiramente da responsabilidade do
  Netlify a partir de `main`, nunca deste workflow.

## Proteção de branch recomendada para `main`

Esta sessão não tem (nem deveria usar sem pedido explícito) permissão
para alterar as definições de administração do repositório GitHub — a
proteção de branch é uma alteração de infraestrutura partilhada. Fica
aqui documentado o que deve ser configurado manualmente em *Settings →
Branches → Branch protection rules* antes de qualquer piloto:

- **Require a pull request before merging** — sem exceções, incluindo
  para administradores.
- **Require approvals** — pelo menos 1 (ver `.github/CODEOWNERS`: hoje
  há uma só pessoa responsável, pelo que este requisito só se torna
  eficaz assim que exista uma segunda pessoa a rever código).
- **Require status checks to pass before merging**, com os três jobs do
  CI (`frontend`, `functions`, `rules`) marcados como obrigatórios, e
  **Require branches to be up to date before merging**.
- **Require conversation resolution before merging.**
- **Do not allow bypassing the above settings** (nem para
  administradores).
- **Restrict force pushes** e **Restrict deletions** no branch principal.
- **Require signed commits** — recomendado, não bloqueador.

## Dependabot e segredos

- `.github/dependabot.yml` — atualizações semanais de dependências npm
  (raiz e `functions/`, com as dependências de desenvolvimento agrupadas
  para reduzir o número de PRs) e das próprias GitHub Actions usadas no
  workflow.
- **Secret scanning + push protection** — devem ser ativados em
  *Settings → Code security* (nome exato varia consoante o plano do
  repositório/organização). Nenhum segredo real chegou alguma vez a
  existir neste repositório (só a configuração pública do Firebase Web,
  que não é secreta — ver `docs/threat-model.md`), mas a proteção deve
  ficar ativa antes de qualquer credencial real (chave de fornecedor de
  IA, conta de serviço) ser sequer criada.
- **`.github/CODEOWNERS`** — pede revisão automática em qualquer
  alteração a `firestore.rules`, `storage.rules` ou `functions/`, mesmo
  antes de existir uma segunda pessoa na equipa (nesse caso serve só
  como documentação de intenção).

## Pull requests

`.github/pull_request_template.md` inclui uma checklist de testes
locais e uma secção específica de "isolamento de dados e privacidade" —
obrigatória para qualquer alteração a regras, Cloud Functions ou
consultas ao Firestore/Storage, dado que uma falha de isolamento entre
famílias é, pela própria definição desta etapa, um bloqueador de
lançamento (ver `docs/pilot-plan.md`).
