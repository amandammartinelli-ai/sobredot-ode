# Sobredot

**Sobredot — uma solução da Oficina das Emoções**

Uma visão integrada e longitudinal da criança: registos de família, escola
e profissionais em emoções, comportamentos, sono, alimentação, medicação,
escola, comunicação, sensorialidade, conquistas e observações.

> ⚠️ **Etapa 1 de 5.** Este repositório contém, por enquanto, um protótipo
> navegável com dados totalmente fictícios. Não existe autenticação real,
> upload de documentos ou IA. Ver `docs/roadmap.md` para as próximas etapas.

## O que a Sobredot não faz

A Sobredot não diagnostica, não prescreve, não substitui profissionais de
saúde ou educação e não toma decisões automáticas sobre a criança.

## Stack técnica

- HTML5 semântico, CSS responsivo (mobile-first, com variáveis de design),
  JavaScript moderno em módulos ES — sem React, Vue ou outra framework de
  UI.
- [Vite](https://vitejs.dev) usado apenas como ferramenta de
  desenvolvimento e build.
- [Vitest](https://vitest.dev) + jsdom para testes unitários.
- Deploy previsto no [Netlify](https://netlify.com).
- Backend previsto em [Firebase](https://firebase.google.com)
  (Authentication, Firestore, Cloud Storage, Cloud Functions, App Check) —
  nesta etapa existe apenas a camada de configuração (`src/config/`), sem
  ligação real.

## Estrutura do projeto

```
sobredot-ode/
├── index.html                 # Ponto de entrada HTML
├── public/                    # Ficheiros estáticos (favicon, etc.)
├── src/
│   ├── main.js                 # Bootstrap da aplicação
│   ├── styles/                 # tokens, base, layout, componentes (CSS)
│   ├── i18n/                   # Textos centralizados (pt)
│   ├── router/                 # Router baseado em hash (#/rota)
│   ├── views/                  # Uma pasta por ecrã (dashboard, registo, ...)
│   ├── components/             # Componentes reutilizáveis (cartões, estados, ...)
│   ├── services/                # Regras de acesso a dados (hoje: localStorage)
│   ├── data/mock/                # Dados fictícios da demonstração
│   ├── config/                   # Configuração (ex.: Firebase, só estrutura)
│   └── utils/                    # Utilitários (DOM, formatação)
├── tests/unit/                 # Testes com Vitest
├── docs/                       # Documentação do produto e arquitetura
├── netlify.toml                # Configuração de build/deploy no Netlify
├── .env.example                # Nomes de variáveis, valores fictícios
└── package.json
```

Ver `docs/architecture.md` para uma explicação mais detalhada de cada
camada, e `docs/sitemap.md` para o mapa de páginas.

## Pré-requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Instalação

```bash
npm install
```

## Ambiente local

Copie o ficheiro de exemplo e ajuste se necessário (nesta etapa os valores
fictícios já são suficientes para correr a aplicação):

```bash
cp .env.example .env
```

## Executar em desenvolvimento

```bash
npm run dev
```

Abre em `http://localhost:5173`.

## Testes

```bash
npm run test        # corre a suite uma vez
npm run test:watch  # modo watch
```

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

## Deploy (Netlify)

O `netlify.toml` já define o comando de build (`npm run build`) e a pasta
de publicação (`dist`). Basta ligar o repositório ao Netlify — cada branch
e pull request recebe automaticamente um deploy preview. Não é necessário
nenhum redirecionamento de SPA, porque a navegação usa router em hash
(`#/rota`) — ver `docs/decisions.md`.

**Nunca** adicione credenciais reais ao `.env`, ao `netlify.toml` ou a
qualquer ficheiro versionado. Em produção, configure as variáveis de
ambiente diretamente no painel do Netlify.

## Dados de demonstração

Todos os nomes e registos apresentados são fictícios (ex.: "Matias
Exemplo", "Beatriz Fictícia"). A interface mostra sempre um aviso "Dados de
demonstração" — nunca escondido — enquanto não existir backend real.

## Documentação

Ver a pasta [`docs/`](./docs):

- `product-vision.md` — visão do produto
- `architecture.md` — arquitetura técnica
- `sitemap.md` — mapa de páginas
- `design-system.md` — sistema de design
- `threat-model.md` — modelo de ameaças inicial
- `decisions.md` — decisões técnicas registadas
- `roadmap.md` — roadmap das cinco fases
