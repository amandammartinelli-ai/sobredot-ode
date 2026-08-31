# Sistema de design — Sobredot

Fonte única de verdade: `src/styles/tokens.css`. Este documento explica o
raciocínio; o CSS é a implementação.

## Princípios

1. **Humano antes de tecnológico.** Cores terrosas e serenas, sem azuis
   "corporativos" frios nem tons clínicos/hospitalares.
2. **Acessível por omissão.** Contraste AA no mínimo, foco sempre visível,
   texto nunca abaixo de 14px, alvos de toque com pelo menos 44×44px.
3. **Mobile-first.** Todo o CSS parte do layout de telemóvel e adiciona
   comportamento em `min-width`, nunca o contrário.
4. **Sem duplicação de valores mágicos.** Cor, espaçamento, tipografia,
   sombra e raio vivem em variáveis CSS (`tokens.css`), nunca em valores
   soltos dentro de componentes.

## Cor

- **Marca**: verde acinzentado (`--color-brand-500 #3B6E63`), transmite
  calma e confiança sem ser "médico".
- **Acento**: dourado quente (`--color-accent-500 #E0A13D`), usado com
  moderação — atualmente só no botão central "REGISTAR".
- **Neutros**: escala quase monocromática com leve tom quente (não cinzento
  puro), para reforçar a sensação humana.
- **Semânticos**: sucesso, aviso, perigo, informação — sempre com par
  claro/escuro para fundo/texto com contraste suficiente.
- **Categorias de registo**: dez cores distintas mas todas de saturação
  moderada (nunca cores "berrantes"), para que a linha do tempo seja
  legível sem parecer um painel de alertas.

## Tipografia

- Fonte principal: `Atkinson Hyperlegible` (desenhada para legibilidade,
  incluindo baixa visão), com pilha de recurso para sistema operativo.
- Escala modular simples (`--font-size-xs` a `--font-size-3xl`).
- `line-height` generoso (1.5 no corpo, 1.25 em títulos) para leitura mais
  confortável, incluindo por pais/mães cansados a meio da noite.

## Espaçamento, raio, sombra

- Escala de espaçamento em múltiplos de 4px (`--space-1` a `--space-16`).
- Raios generosos (`--radius-lg`, `--radius-xl`, `--radius-full`) para uma
  estética acolhedora, evitando cantos muito retos.
- Sombras discretas (`--shadow-sm/md/lg`), nunca usadas para simular
  profundidade excessiva — o produto não deve parecer um "dashboard
  técnico".

## Estados e acessibilidade

- `:focus-visible` com contorno de 3px em todos os elementos interativos —
  nunca `outline: none` sem substituto.
- `.skip-link` (saltar para o conteúdo) é o primeiro elemento focável em
  qualquer carregamento de página.
- `prefers-reduced-motion` respeitado globalmente via `@media`, e também
  disponível como preferência explícita em Perfil → Acessibilidade
  (`data-reduced-motion` no `<html>`), para quem quer desativar animações
  independentemente da definição do sistema operativo.
- Todos os campos de formulário têm `<label>` associado; grupos de opções
  usam `role="radiogroup"`/`fieldset` semântico.
- Estados vazio/carregamento/erro/sucesso são componentes dedicados
  (`src/components/states/`), nunca apenas texto solto, e usam `role`
  apropriado (`status`, `alert`) para leitores de ecrã.

## Componentes principais

| Componente | Ficheiro | Uso |
|---|---|---|
| Cartão de resumo | `components/card.js` | Sono, humor, alimentação, medicação |
| Botão central de registo | `components/registerButton.js` | Ação principal do dashboard |
| Seletor de criança | `components/childSelector.js` | Trocar de criança ativa |
| Categoria (grelha de registo) | `components/categoryTile.js` | As 10 categorias |
| Categoria (selo/chip) | `components/categoryTile.js` (`createCategoryChip`) | Linha do tempo |
| Diálogo de confirmação | `components/confirmDialog.js` | Confirmar antes de guardar um registo |
| Estados vazio/carregamento/erro/sucesso | `components/states/` | Reutilizados em várias vistas |
| Aviso de demonstração | `components/demoBanner.js` | Sempre visível no topo |

## O que NÃO fazer

- Não introduzir uma nova cor, espaçamento ou sombra "à mão" num
  componente — adicionar token em `tokens.css` primeiro.
- Não remover o aviso de "Dados de demonstração" nem torná-lo discreto
  demais para ser notado.
- Não usar `outline: none` sem um substituto de foco visível equivalente.
