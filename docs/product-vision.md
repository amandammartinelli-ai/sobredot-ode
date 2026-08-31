# Visão do produto — Sobredot

## O que é

A Sobredot é uma aplicação web que cria uma **visão integrada e longitudinal
da criança**, reunindo registos do quotidiano feitos pela família, pela
escola e por profissionais que a acompanham. Os registos cobrem dez áreas:
emoções, comportamentos, sono, alimentação, medicação, escola, comunicação,
sensorialidade, conquistas e observações.

O nome comercial completo, usado em comunicações e rodapés, é:

> **Sobredot — uma solução da Oficina das Emoções**

## Para quem

- **Famílias diretas** — pais, mães e encarregados de educação que querem
  acompanhar o percurso do filho ou filha.
- **Alunos e alunas da Oficina das Emoções (ODE)** — crianças já
  acompanhadas pela ODE, cuja família ou a própria ODE inicia o registo.
- **Instituições parceiras** — escolas, clínicas ou outras entidades que
  colaboram com a família no acompanhamento da criança.

Esta distinção de origem (`ode`, `partner`, `direct`) está prevista desde já
na arquitetura de dados (ver `architecture.md`), mas **não implica acesso
automático da ODE a dados sensíveis** — é apenas metadado de proveniência da
relação, para que regras de acesso futuras possam ser construídas sobre ele
de forma explícita e auditável.

## O que a Sobredot faz

- Regista, de forma simples e acessível, observações do dia a dia da
  criança nas dez categorias acima.
- Organiza esses registos numa linha do tempo navegável.
- Prevê espaço para carregar documentos (laudos, avaliações, relatórios) —
  ainda não implementado nesta etapa.
- Prevê, para uma fase futura, cruzar registos do quotidiano com
  documentos através de IA, para apoiar a compreensão do percurso.

## O que a Sobredot NÃO faz

Isto é uma fronteira de produto deliberada, repetida em toda a interface:

- **Não diagnostica.**
- **Não prescreve** tratamentos, medicação ou intervenções.
- **Não substitui** profissionais de saúde, terapia ou educação.
- **Não toma decisões automáticas** sobre a criança.

Qualquer funcionalidade futura de IA (insights, cruzamento de dados) serve
para **apoiar a compreensão humana**, nunca para decidir em nome de quem
cuida da criança.

## Tom e princípios de conceção

- Linguagem humana, serena e respeitosa — nunca hospitalar, nunca
  infantilizada, nunca excessivamente técnica.
- Privacidade desde a conceção: nada escondido, nenhum "dark pattern",
  consentimento sempre visível.
- Acessibilidade como requisito de base, não extra: contraste, foco visível,
  navegação por teclado, redução de movimento, textos claros.
- Mobile-first: a maioria dos registos do quotidiano acontece a partir de um
  telemóvel, muitas vezes em contextos de pouco tempo disponível.

## Fases previstas

Ver `roadmap.md` para o detalhe das cinco fases de construção do produto.
