# Arquitetura — Etapa 1

## Visão geral

```
┌─────────────────────────────────────────────────────────┐
│                     Navegador (cliente)                  │
│                                                           │
│  index.html                                              │
│    └── src/main.js  (bootstrap)                          │
│          ├── styles/*.css   (tokens, base, layout, comp.)│
│          ├── i18n/*         (textos centralizados, pt)   │
│          ├── router/router.js  (rotas em hash, #/rota)   │
│          ├── views/*        (uma pasta por ecrã)         │
│          ├── components/*   (reutilizáveis entre vistas) │
│          ├── services/*     (regras + acesso a dados)    │
│          │     └── storageService.js → localStorage      │
│          ├── data/mock/*    (dados fictícios da demo)    │
│          └── config/firebase.config.js (só configuração) │
└─────────────────────────────────────────────────────────┘
                          │
                          │  (etapas futuras)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                         Firebase                          │
│  Authentication · Firestore · Cloud Storage ·             │
│  Cloud Functions · App Check                               │
└─────────────────────────────────────────────────────────┘
```

Nesta etapa **não existe backend**. Todo o estado (criança selecionada,
sessão de demonstração, registos criados) vive em `localStorage`, através de
`src/services/storageService.js`, o único módulo que toca diretamente na
API do browser. Os restantes serviços (`authService`, `childrenService`,
`recordsService`, `preferencesService`) dependem dele, e não do
`localStorage` diretamente — isto torna trivial substituir o armazenamento
local por chamadas ao Firebase mais tarde, sem alterar as vistas.

## Camadas

| Camada | Pasta | Responsabilidade |
|---|---|---|
| Apresentação | `src/views/`, `src/components/` | Construir DOM, sem regras de negócio |
| Aplicação | `src/services/` | Regras de acesso a dados, hoje sobre localStorage/mock |
| Dados de demonstração | `src/data/mock/` | Dados fictícios, nunca reais |
| Infra/config | `src/config/` | Apenas leitura de variáveis de ambiente |
| Texto | `src/i18n/` | Único local de strings de interface |
| Navegação | `src/router/` | Mapeamento hash → vista, foco e visibilidade de UI |

## Router

Router muito simples baseado em `window.location.hash` (`#/dashboard`,
`#/registar`, etc.), sem dependências externas. Cada rota sabe:

- que função de vista renderizar;
- se é pública (`welcome`) ou exige "sessão" de demonstração;
- se mostra o cabeçalho/navegação (`showChrome`).

Ver `docs/decisions.md` para a justificação de não usar histórico do
browser (`pushState`) nesta etapa.

## Componentes vs. Vistas

- **Vistas** (`src/views/**/xxxView.js`) sabem montar um ecrã completo,
  orquestrando serviços e componentes. Cada uma exporta uma função
  `renderXxxView()` que devolve um nó DOM.
- **Componentes** (`src/components/`) são unidades reutilizáveis e sem
  estado próprio persistente (cartão, seletor de criança, estados vazio/
  carregamento/erro/sucesso, diálogo de confirmação).

Não existe nenhuma framework de UI: `src/utils/dom.js` expõe um pequeno
utilitário `h(tag, attrs, children)` para criar elementos DOM de forma
declarativa, inspirado em `hyperscript`, mas sem virtual DOM nem
reatividade — cada vista volta a desenhar-se explicitamente quando o seu
estado local muda (ver `registerView.js` para o exemplo mais elaborado).

## Autenticação (modo demonstração)

`src/services/authService.js` simula uma sessão local, claramente marcada
como demonstração (`demoMode: true`). Não existe palavra-passe, pedido de
rede, nem verificação de identidade — apenas um registo em `localStorage`
para que o router saiba se deve mostrar o ecrã de boas-vindas ou o
dashboard. A ligação ao **Firebase Authentication** fica para uma etapa
futura, mantendo a mesma interface pública (`getCurrentUser`,
`isAuthenticated`, `enterDemoMode`/`exitDemoMode`) para minimizar alterações
nas vistas.

## Configuração Firebase (só estrutura)

`src/config/firebase.config.js` lê variáveis de ambiente (`VITE_FIREBASE_*`)
e devolve um objeto de configuração. **Não importa o SDK do Firebase e não
inicializa nenhum serviço.** Isto existe apenas para que a etapa seguinte
tenha o "encaixe" pronto, sem introduzir dependências ou comportamento
antes de serem necessários.

## Internacionalização

`src/i18n/pt.js` centraliza todos os textos da interface num único
dicionário aninhado, acedido através de `t('caminho.da.chave')`
(`src/i18n/index.js`). Nenhuma vista ou componente deve conter texto fixo
em português diretamente — isto permite adicionar outros idiomas no futuro
sem tocar em lógica de UI.

## Origem da relação (ODE / parceiro / direta)

Cada criança fictícia (`src/data/mock/children.js`) tem um campo
`relationshipOrigin` com os valores `ode`, `partner` ou `direct`. Este
campo destina-se, em etapas futuras, a modelar quem pode ver o quê e a
registar como aquela relação começou — não concede, por si só, nenhum
acesso. Ver `docs/threat-model.md` para os princípios de controlo de
acesso previstos.
