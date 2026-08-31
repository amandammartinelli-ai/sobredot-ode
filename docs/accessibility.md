# Acessibilidade — auditoria WCAG 2.2 AA (Etapa 5)

## Metodologia

Auditoria automatizada com [axe-core](https://github.com/dequelabs/axe-core)
(regras `wcag2a`, `wcag2aa`, `wcag22aa`), executada via Playwright contra os
15 ecrãs principais da aplicação a correr contra o Firebase Emulator Suite
com dados sintéticos: boas-vindas, login, criar conta, recuperar
palavra-passe, dashboard, registar, linha do tempo, documentos, Visão
Integrada, relatórios, família, perfil, perfil da criança (novo e
existente), biblioteca ODE.

Isto cobre teclado/foco/labels/estrutura de forma automatizada e
reprodutível, mas **não substitui** teste manual com leitores de ecrã
reais (NVDA, JAWS, VoiceOver) nem com utilizadores reais de tecnologia de
apoio — ver "O que fica para verificação humana" abaixo.

## Resultado inicial e correções aplicadas

A primeira passagem encontrou 8 violações em 3 dos 12 ecrãs testados.
Todas foram corrigidas nesta etapa; a segunda passagem confirmou 0
violações nos 15 ecrãs:

| Violação (axe) | Onde | Correção |
|---|---|---|
| `color-contrast` (grave) | Chips de categoria no resumo do dashboard | A cor da categoria deixou de ser usada como fundo com texto escuro por cima (falhava 4.5:1 em várias combinações) — passou a ser só o contorno; fundo e texto ficam sempre no par de alto contraste do tema (`src/styles/components.css`, `.category-chip`). |
| `label` (crítica) | Campos "Título"/"Descrição"/"Data alvo" do formulário de metas (Visão Integrada) | Os `<label>` existiam visualmente mas nunca estavam associados ao campo (faltava `for`/`id`) — corrigido em `src/views/insights/insightsView.js`. |
| `select-name` (crítica) | Filtros "Categoria"/"Fonte" (Visão Integrada), período (Relatórios), criança (Família, secção de acessos), idioma (Perfil) | Mesmo problema — `<label>` sem `for`/`id`, ou nenhum rótulo acessível. Corrigido nas quatro vistas; o seletor de idioma (desativado, uma só opção) recebeu `aria-label`. |
| `list` (grave) | Lista "Perguntas para a próxima consulta" (Visão Integrada) | O estado vazio inseria um `<p>` diretamente dentro de um `<ul>` (inválido — só `<li>` pode ser filho direto). Corrigido para usar um `<li>` também no estado vazio. |

Nenhuma destas correções alterou o comportamento funcional — só a
associação semântica entre rótulos/campos e a paleta de cores dos chips.

## Verificações manuais feitas nesta etapa

- **Zoom/reflow**: viewport reduzido a 640×400 (equivalente a ~200% de
  zoom num ecrã de referência) — sem scroll horizontal indesejado.
- **Ecrã móvel real**: emulação de iPhone SE (375×667, `isMobile`,
  `hasTouch`) no dashboard e na Visão Integrada — layout responsivo
  correto, sem overflow horizontal, barra de navegação inferior fixa
  utilizável.
- **Redução de movimento**: já existente desde a Etapa 2
  (`profile.reducedMotionLabel`, aplicada via `html[data-reduced-motion]`
  em `base.css`) — confirmado que continua a funcionar.
- **Rede lenta**: emulação de 50 kbps / 400 ms de latência (Chrome DevTools
  Protocol) — o ecrã de login ainda carrega, mas confirma a necessidade de
  reduzir o tamanho do bundle inicial (ver "Desempenho" em
  `docs/security-hardening.md` e a divisão de código feita nesta etapa).
- **Perda de ligação**: submissão de login com a rede desligada a meio —
  o Firebase SDK devolve um erro tratado (`describeAuthError`), a
  aplicação não trava nem mostra um ecrã em branco.

## O que fica para verificação humana

Estes pontos não podem ser verificados de forma fiável por uma ferramenta
automatizada nesta sessão de desenvolvimento — ficam como pendência
explícita antes de qualquer piloto com utilizadores reais (ver
`docs/pilot-plan.md`, portão 2):

- **Leitores de ecrã reais** (NVDA/JAWS no Windows, VoiceOver no
  macOS/iOS, TalkBack no Android) — o axe-core valida estrutura/nomes
  acessíveis, mas não a experiência real de navegação por leitor de ecrã
  (ordem de leitura, anúncios de mudança de estado, etc.).
- **Dispositivos móveis físicos reais** — a emulação do Playwright cobre
  viewport/toque, mas não hardware real (teclados virtuais, gestos do
  sistema operativo, leitores de ecrã móveis).
- **Utilizadores reais com necessidades de acessibilidade diversas** —
  nenhuma ferramenta automatizada substitui testar com pessoas reais.
- **PDFs gerados** — a Etapa 4 só gera HTML imprimível (sem geração
  binária de PDF no servidor — ver `docs/insights.md`), pelo que a
  acessibilidade de um PDF real fica para quando essa capacidade for
  implementada (Etapa 5+, ver `docs/roadmap.md`).
- **Gráficos** — os gráficos de barras acessíveis (`accessibleBarChart.js`)
  já incluem descrição textual, unidades, amostra e uma tabela
  alternativa (requisito da Etapa 4), mas o teste com leitor de ecrã real
  sobre esse componente específico ainda não foi feito.

## Como voltar a correr a auditoria

Não está integrada no CI desta etapa (ver `docs/security-hardening.md`,
"O que fica fora do CI"). Para repetir localmente:

1. Arrancar emuladores + seed + `npm run dev` (ver README).
2. Instalar `axe-core` (`npm install axe-core` num diretório à parte, ou
   como dependência de desenvolvimento se se decidir formalizar este
   passo no futuro).
3. Usar Playwright para injetar `axe.min.js` em cada rota e correr
   `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a',
   'wcag2aa', 'wcag22aa'] } })`.

Recomendação para uma etapa futura: formalizar isto como um passo de CI
(`npm run test:a11y`) com Playwright como dependência de desenvolvimento
do projeto — não implementado agora para não introduzir uma dependência
pesada nova sem decisão explícita do produto.
