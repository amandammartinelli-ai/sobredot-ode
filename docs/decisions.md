# Decisões técnicas — registo (ADR resumido)

## 1. Vite apenas como ferramenta de build, sem framework de UI

**Decisão:** usar Vite (template vanilla) só para desenvolvimento e build;
o código de aplicação é HTML/CSS/JS puro, com módulos ES nativos.
**Motivo:** requisito explícito do produto. Evita também bloatware e
mantém o bundle pequeno (~28KB JS, ~17KB CSS antes de gzip nesta etapa).
**Alternativas consideradas:** React/Vue foram explicitamente excluídos.

## 2. Router baseado em hash (`#/rota`), sem `history.pushState`

**Decisão:** navegação através de `window.location.hash`.
**Motivo:** funciona em qualquer alojamento estático sem nenhuma
configuração de servidor — cada "rota" é, para o Netlify, sempre o mesmo
`index.html`. Isto significa que **não é necessário nenhum redirecionamento
de SPA** no `netlify.toml` (nenhuma regra `/* -> /index.html`), o que
cumpre a instrução de só adicionar esse redirecionamento se a navegação
realmente exigir.
**Custo aceite:** URLs menos "limpos" (`/#/dashboard` em vez de
`/dashboard`). Aceitável para um protótipo; pode ser revisto se, numa fase
futura, houver necessidade de partilhar links profundos indexáveis por
motores de busca.

## 3. `localStorage` como única fonte de estado nesta etapa

**Decisão:** toda a persistência (sessão de demonstração, criança
selecionada, registos criados, preferências) passa por
`src/services/storageService.js`.
**Motivo:** não há backend ainda; isolar o acesso ao `localStorage` num
único módulo torna trivial substituí-lo por Firestore/Firebase Auth mais
tarde, sem tocar nas vistas.

## 4. Sem gestor de estado nem virtual DOM

**Decisão:** cada vista é uma função que devolve um nó DOM; vistas com
estado interno (ex. `registerView`) gerem-no com variáveis de closure e
voltam a desenhar-se explicitamente via `mount()`.
**Motivo:** a complexidade da aplicação nesta etapa não justifica um
gestor de estado dedicado. Reavaliar se o número de vistas com estado
partilhado entre si crescer significativamente.

## 5. Camada de configuração Firebase sem SDK

**Decisão:** `src/config/firebase.config.js` só lê variáveis de ambiente e
devolve objetos simples; o pacote `firebase` não é sequer uma dependência
nesta etapa.
**Motivo:** requisito explícito da Etapa 1 ("crie somente a camada de
configuração"). Evita peso morto no bundle e falsas expectativas de que o
backend já está ligado.

## 6. Internacionalização com dicionário simples, sem biblioteca

**Decisão:** `t(chave)` resolve caminhos aninhados num objeto JS simples
(`src/i18n/pt.js`).
**Motivo:** suficiente para um único idioma nesta etapa, sem custo de
dependência. Se um segundo idioma for adicionado, `src/i18n/index.js` já
suporta múltiplos dicionários (`setLocale`, `getAvailableLocales`) sem
alterações estruturais.

## 7. Origem da relação como metadado, não como permissão

**Decisão:** `relationshipOrigin` (`ode` | `partner` | `direct`) em cada
criança fictícia é puramente informativo nesta etapa.
**Motivo:** registar a decisão de produto de que a ODE **não** tem acesso
automático a dados sensíveis só por a criança ser sua aluna — ver
`threat-model.md`, risco 1.

## 8. Diálogo de confirmação implementado à mão, sem `<dialog>` nativo

**Decisão:** `components/confirmDialog.js` implementa um modal acessível
manualmente (fecho com Escape, foco inicial no botão de confirmação, foco
devolvido ao elemento anterior ao fechar) em vez do elemento `<dialog>`
nativo do HTML.
**Motivo:** maior controlo imediato sobre o comportamento de foco em todos
os motores de navegação suportados nesta fase. Reavaliar `<dialog>` nativo
numa próxima etapa à medida que o suporte e as necessidades de estilo
ficarem mais claros.
