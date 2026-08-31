# Sobredot

**Sobredot — uma solução da Oficina das Emoções**

Uma visão integrada e longitudinal da criança: registos de família, escola
e profissionais em emoções, comportamentos, sono, alimentação, medicação,
escola, comunicação, sensorialidade, conquistas e observações.

> ⚠️ **Etapa 3 de 5.** Autenticação, famílias, permissões e registos
> quotidianos são reais e testados (Etapa 2). O cofre de documentos e a
> camada de IA privada existem e são reais na sua arquitetura de
> segurança/isolamento, mas usam adaptadores mock para antivírus, OCR e
> modelo de IA — ver `docs/architecture.md`, "O que é mock e o que é
> real". Ainda não existe um painel de cruzamentos completo (Etapa 4).
> Todos os dados usados são sintéticos. Ver `docs/roadmap.md`.

## O que a Sobredot não faz

A Sobredot não diagnostica, não prescreve, não substitui profissionais de
saúde ou educação e não toma decisões automáticas sobre a criança. A
camada de IA (quando ativa) organiza informação já revista por humanos —
nunca decide, nunca sugere doses, nunca classifica a criança.

## Stack técnica

- HTML5 semântico, CSS responsivo (mobile-first, com variáveis de design),
  JavaScript moderno em módulos ES — sem React, Vue ou outra framework de
  UI.
- [Vite](https://vitejs.dev) usado apenas como ferramenta de
  desenvolvimento e build.
- [Vitest](https://vitest.dev) + jsdom para testes unitários; testes
  dedicados de regras de segurança contra o Firebase Emulator Suite.
- [Firebase](https://firebase.google.com): Authentication, Firestore,
  Cloud Storage, Cloud Functions (`europe-west1`), App Check.
- Deploy do frontend no [Netlify](https://netlify.com).

## Estrutura do projeto

```
sobredot-ode/
├── index.html
├── public/
├── src/
│   ├── main.js
│   ├── firebase/                # Inicialização do SDK (app.js, appCheck.js)
│   ├── state/                    # Estado de sessão em memória (familyId)
│   ├── styles/, i18n/, router/   # Inalterados desde a Etapa 1
│   ├── views/                    # Um ficheiro por ecrã — ver docs/sitemap.md
│   ├── components/               # Componentes reutilizáveis
│   ├── services/                 # Uma camada de acesso a dados por área de negócio
│   ├── data/mock/                 # Dados fictícios (usados pelo seed do emulador)
│   ├── config/                    # Leitura de variáveis de ambiente
│   └── utils/                     # DOM, formatação, validação
├── functions/                   # Cloud Functions (Node.js, região europe-west1)
│   └── src/
│       ├── family.js, access.js  # Famílias, convites, concessões de acesso
│       ├── adminClaims.js, audit.js
│       ├── documents.js, extraction.js, antivirus.js, ocr.js, contentSniff.js
│       └── ai.js                 # Gateway de IA privado
├── firestore.rules, storage.rules, firestore.indexes.json
├── firebase.json, .firebaserc
├── scripts/seed-emulator.js     # Semear o emulador com dados fictícios
├── tests/unit/                  # Testes rápidos (sem emulador)
├── tests/rules/                 # Testes de segurança contra o emulador
├── docs/                        # Documentação — ver índice abaixo
├── netlify.toml
└── package.json
```

Ver `docs/architecture.md` para a arquitetura detalhada,
`docs/data-model.md` para o modelo de dados e `docs/permissions.md` para
o catálogo de permissões.

## Pré-requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Java 11+ (só necessário para o Firebase Emulator Suite)

## Instalação

```bash
npm install
npm --prefix functions install
```

## Ambiente local

```bash
cp .env.example .env
```

Os valores de exemplo já são suficientes para correr contra os
emuladores locais (`VITE_USE_EMULATORS=true` por omissão). Ajuste
`VITE_FIREBASE_PROJECT_ID` para corresponder ao projeto do emulador
(`demo-sobredot`, ver `.firebaserc`).

## Firebase Emulator Suite (desenvolvimento local)

```bash
npm run emulators          # arranca Auth, Firestore, Storage, Functions, UI
npm run seed:emulator      # noutra janela: semeia família/crianças/registos fictícios
npm run dev                # noutra janela: frontend em http://localhost:5173
```

Conta de demonstração criada pelo seed: `demo@sobredot.exemplo` /
`DemoSobredot123!` (só existe no Auth Emulator local).

Ver `docs/firebase-setup.md` para região, App Check, e uma nota
importante sobre variáveis de proxy em certos ambientes de
desenvolvimento em contentor.

## Executar em desenvolvimento

```bash
npm run dev
```

Abre em `http://localhost:5173`. Sem os emuladores a correr, os ecrãs
que dependem do Firebase (tudo a partir do login) não funcionam — é
esperado, não um erro.

## Testes

```bash
npm run test            # testes unitários rápidos (sem emulador)
npm run test:rules      # 31 testes de segurança contra o Firestore/Storage Emulator
npm run test:functions  # testes das Cloud Functions (lógica pura, sem emulador)
npm run lint            # eslint no frontend
npm --prefix functions run lint  # eslint nas Cloud Functions
```

`test:rules` prova, entre outras coisas: família A não acede a dados da
família B; um profissional com concessão expirada perde o acesso; um
colaborador escolar não lê medicação sem esse âmbito explícito;
registos de uma criança nunca aparecem misturados com os de outra;
ninguém se autopromove a administrador pelo cliente; a auditoria nunca
pode ser apagada ou alterada pelo cliente; e um teste canário garante
que uma resposta de IA sobre uma criança nunca cita documentos de outra.

## Lint

```bash
npm run lint
```

## Build de produção

```bash
npm run build
```

Gera a pasta `dist/`. Para pré-visualizar o build localmente:

```bash
npm run preview
```

## Deploy

### Frontend (Netlify)

O `netlify.toml` já define o comando de build (`npm run build`) e a pasta
de publicação (`dist`). Não é necessário nenhum redirecionamento de SPA
— a navegação usa router em hash (`#/rota`) — ver `docs/decisions.md`.
Configure as variáveis `VITE_FIREBASE_*` reais (do seu projeto Firebase
de produção) no painel do Netlify — **nunca** as commite.

### Backend (Firebase)

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage:rules,functions
```

Antes do primeiro deploy real:
1. Criar o projeto Firebase com Firestore na região `europe-west1` (ou
   `eur3`) — ver `docs/firebase-setup.md`.
2. Atualizar `.firebaserc` com o ID do projeto real.
3. Atribuir o primeiro administrador técnico manualmente (nunca através
   de um pedido HTTP) — ver comentário em
   `functions/src/adminClaims.js`.
4. Configurar App Check com uma chave reCAPTCHA v3 real, sem modo de
   depuração.

**Nunca** adicione credenciais reais a ficheiros versionados.

## Dados sintéticos

Todos os nomes e registos usados durante o desenvolvimento são
fictícios (ver `src/data/mock/`, `scripts/seed-emulator.js`). A
interface mostra sempre um aviso "Dados de demonstração".

## Limitações conhecidas desta etapa

- Sem envio real de e-mail de convite (o link é copiado manualmente).
- Sem fornecedor de antivírus/OCR/IA reais ligados — interfaces prontas,
  adaptadores mock/bloqueantes (nunca simulam segurança inexistente) —
  ver `docs/vendors.md`.
- Um utilizador só pertence a uma família nesta etapa.
- Geração de URLs assinadas de Storage não totalmente verificável em
  ambientes de desenvolvimento sem credenciais reais de assinatura — ver
  `docs/firebase-setup.md`.
- Painel de cruzamentos completo entre registos e documentos fica para a
  Etapa 4 — esta etapa só entrega a pergunta pontual "Perguntar aos
  documentos".

## Documentação

Ver a pasta [`docs/`](./docs):

- `product-vision.md` — visão do produto
- `architecture.md` — arquitetura técnica, incluindo cofre de documentos e IA
- `data-model.md` — modelo de dados completo
- `permissions.md` — catálogo de papéis e permissões
- `firebase-setup.md` — emuladores, região, App Check, segredos
- `vendors.md` — inventário de fornecedores e requisitos de contratação de IA
- `logging-policy.md` — o que pode e não pode ir para logs
- `sitemap.md` — mapa de páginas
- `design-system.md` — sistema de design
- `threat-model.md` — modelo de ameaças
- `decisions.md` — decisões técnicas registadas
- `roadmap.md` — roadmap das cinco fases
