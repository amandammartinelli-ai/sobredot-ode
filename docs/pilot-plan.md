# Plano de piloto — Etapa 5

Este documento define como a Sobredot passa de "candidata a piloto"
(o que esta etapa entrega) para uso com dados reais de crianças, em três
portões sucessivos — nunca de uma vez. **Nenhum portão avança
automaticamente**: cada transição exige confirmação humana explícita
contra os critérios de saída do portão anterior.

## Critérios de bloqueio do lançamento (aplicam-se a TODOS os portões com dados reais — portões 2 e 3)

Qualquer um dos seguintes bloqueia o avanço, sem exceção:

- Um teste de isolamento entre famílias/crianças a falhar
  (`npm run test:rules`).
- Uma regra do Firestore/Storage permissiva identificada (revisão
  manual + testes, `docs/threat-model.md`).
- Um segredo exposto (repositório, log, bundle do cliente).
- Ausência de uma via funcional de eliminação de dados a pedido da
  família (`docs/governance/data-rights.md`).
- Um fornecedor de IA real ligado sem as condições contratuais mínimas
  documentadas em `docs/vendors.md`.
- Falta de revisão jurídica dos documentos em `docs/governance/`
  (todos continuam marcados como rascunho até essa revisão).
- Ausência de uma política de resposta a incidentes operacional
  (`docs/governance/incident-response-policy.md` +
  `docs/runbooks/incident-response.md`).
- Um relatório ou insight gerado pela aplicação sem fontes citáveis
  (violação do "grounding" — ver `docs/architecture.md` e os testes de
  `functions/src/insights.js`/`ai.js`).
- A IA a produzir uma resposta que diagnostica, prescreve, ou decide
  automaticamente algo sobre a criança (ver
  `tests/rules/aiSafetyEvals.integration.test.js` — uma regressão aqui
  é sempre bloqueadora, nunca "aceitável por agora").
- Uma falha de acessibilidade crítica (bloqueia um utilizador de
  completar uma tarefa essencial — ver `docs/accessibility.md`).

Nenhuma pessoa, incluindo quem escreve este documento, está autorizada
a declarar a aplicação pronta para dados reais enquanto algum destes
critérios estiver ativo.

## Portão 1 — equipa interna, só dados sintéticos

**Objetivo:** validar que a aplicação funciona ponta a ponta num
ambiente o mais parecido possível com produção, sem qualquer risco para
uma criança real.

- **Critérios de entrada:** suíte de testes completa verde
  (`npm test`, `npm run test:functions`, `npm run test:rules`), build
  de produção sem erros, ambientes Netlify/Firebase separados
  configurados (`docs/deploy-netlify.md`).
- **Quem participa:** só a equipa que constrói o produto.
- **Dados:** exclusivamente sintéticos — os mesmos usados em
  desenvolvimento (`scripts/seed-emulator.js` e equivalente em
  staging).
- **Dono:** [a preencher — responsável técnico].
- **Critérios de saída:** nenhum bug bloqueador encontrado no uso real
  de todos os fluxos principais durante pelo menos [a preencher —
  período, ex.: 2 semanas] de uso ativo pela equipa; nenhum critério de
  bloqueio do lançamento ativo.

## Portão 2 — grupo pequeno e controlado, com consentimento, com apoio próximo

**Objetivo:** a primeira exposição a dados reais de crianças, com o
menor número de famílias que ainda permita aprendizagem real.

- **Critérios de entrada (além do fim do Portão 1):**
  - Revisão jurídica formal de todos os documentos em
    `docs/governance/` concluída, com as bases jurídicas confirmadas
    (não só a hipótese de engenharia).
  - Backup configurado **e testado** (`docs/runbooks/backup-restore.md`).
  - Nenhum critério de bloqueio do lançamento ativo.
  - Consentimento parental (`docs/governance/parental-consent-draft.md`,
    versão final aprovada) obtido por escrito de cada família
    participante, antes do primeiro registo real.
- **Quem participa:** um número pequeno de famílias reais (recomendação
  inicial: não mais de [a preencher — ex.: 5-10] famílias), escolhidas
  com um perfil de utilização representativo mas que aceitem
  ativamente o papel de piloto (não utilizadores anónimos vindos de um
  anúncio público).
- **Dados:** reais, pela primeira vez — com todos os direitos da
  família (`docs/governance/data-rights.md`) totalmente operacionais
  desde o primeiro dia.
- **Apoio próximo:** um canal direto e dedicado (ex.: um número de
  telefone/e-mail respondido pela mesma pessoa que acompanha o piloto,
  não um formulário genérico) — [a preencher — canal exato]. Resposta
  esperada em [a preencher — prazo, ex.: 24h úteis].
- **Dono:** [a preencher — responsável pelo acompanhamento do piloto,
  pode ou não ser a mesma pessoa do Portão 1].
- **Critérios de saída:**
  - Nenhum incidente de dados pessoais não resolvido
    (`docs/governance/incident-response-policy.md`).
  - Revisão da precisão/utilidade das narrativas de IA com as famílias
    participantes (feedback direto, não só métricas técnicas) — sem
    queixas de conteúdo incorreto ou fora de âmbito não corrigidas.
  - Feedback de acessibilidade de utilizadores reais recolhido (ver
    `docs/accessibility.md`, "O que fica para verificação humana").

## Portão 3 — expansão gradual

**Objetivo:** crescer o número de famílias de forma controlada,
aprendendo a cada incremento, nunca de uma vez para "todos".

- **Critérios de entrada (além do fim do Portão 2):** análise
  documentada de incidentes (zero ou todos resolvidos e com lição
  aprendida aplicada), precisão/utilidade percebida pelas famílias do
  Portão 2, e feedback geral positivo o suficiente para justificar
  expandir.
- **Ritmo:** incrementos pequenos e espaçados (ex.: duplicar o número
  de famílias, esperar, avaliar, só depois duplicar de novo) — nunca um
  salto direto para disponibilidade pública.
- **Reavaliação a cada incremento:** os critérios de bloqueio do
  lançamento aplicam-se sempre, a cada novo grupo — um portão já
  ultrapassado pode voltar a fechar se uma condição deixar de se
  verificar (ex.: um incidente novo, uma regressão de acessibilidade).
- **Dono:** [a preencher].

## Suspender a IA sem derrubar a base

Em qualquer portão, se surgir uma dúvida séria sobre a segurança ou
qualidade das respostas de IA (ex.: um caso real de conteúdo incorreto
reportado por uma família, ou uma falha encontrada na suíte de
avaliação), a funcionalidade de IA deve poder ser desligada **sem
afetar o resto da aplicação** — a família continua a registar,
consultar e exportar os seus dados normalmente.

**Procedimento:**

1. Desativar as funções `askDocuments` e `generateInsights` (Firebase
   Console → Functions → desativar/pausar a função, ou fazer deploy de
   uma versão que responde sempre com um estado "temporariamente
   indisponível" explicado à família em vez de processar o pedido).
2. Confirmar, por teste manual rápido, que o resto da aplicação
   (registos, documentos, família, exportação) continua a funcionar
   normalmente.
3. Comunicar às famílias ativas que a funcionalidade está temporariamente
   suspensa e porquê, em linguagem simples.
4. Investigar e corrigir (ver `docs/runbooks/incident-response.md`).
5. Reativar só depois de a suíte de avaliação de segurança da IA
   (`tests/rules/aiSafetyEvals.integration.test.js`) passar
   integralmente, incluindo um teste novo que cubra o caso concreto
   encontrado.

Nenhuma parte deste procedimento depende de eliminar ou tocar nos
registos/documentos já guardados — a suspensão é sempre reversível e
isolada à camada de IA.

## Acesso administrativo de emergência — decisão

**Decisão: não implementar nenhum mecanismo de acesso administrativo de
emergência a conteúdo de família/criança.** Nem sequer com
aprovação/prazo/alerta à família — como o próprio pedido desta etapa
sugeriu como alternativa aceitável, mas condicionada a ser "realmente
necessário".

**Porquê não é necessário:**

- Nenhum caso de suporte identificado até agora exige ver o *conteúdo*
  de uma família para ser resolvido — problemas técnicos (uma função a
  falhar, uma quota excedida) são visíveis através de metadados
  agregados (`docs/admin-dashboard.md`) e da auditoria
  (`docs/logging-policy.md`), sem nunca precisar de ler um registo, um
  documento ou uma resposta de IA.
- Um pedido de suporte que genuinamente precise de ver conteúdo (ex.:
  "o meu registo de ontem desapareceu") pode ser resolvido com a
  família a partilhar o seu próprio ecrã ou uma captura, nunca com um
  administrador a aceder diretamente à conta dela.
- `firestore.rules` já nega estruturalmente a `isAdmin()` qualquer
  leitura de `children/*/records`, `children/*/medications`,
  `children/*/documents` ou `children/*/consents` (ver
  `docs/threat-model.md`, risco 10) — introduzir um mecanismo de
  emergência exigiria abrir deliberadamente essa fronteira, que hoje é
  absoluta e verificada por teste.
- Cada mecanismo de exceção introduzido é, ele próprio, uma superfície
  de ataque nova e um ponto de falha de confiança — o custo de o manter
  seguro (aprovação, prazo, alerta, auditoria reforçada, testes
  dedicados) só se justifica por uma necessidade real, que não existe.

**Isto permanece uma decisão revisível**, não definitiva: se, durante o
Portão 2 ou 3, surgir um caso de suporte real que comprovadamente não
possa ser resolvido de outra forma, esta decisão deve ser revisitada
explicitamente — nunca contornada informalmente (ex.: um administrador
a pedir a uma família para "só lhe mostrar o ecrã" de forma recorrente
seria um sinal de que a decisão precisa de ser reaberta, com desenho
adequado, não ignorada).

## Papéis (a preencher antes do Portão 2)

| Papel | Pessoa | Responsabilidade |
|---|---|---|
| Dono do piloto | [a preencher] | Decide avanço/recuo entre portões |
| Responsável técnico | [a preencher] | Runbooks, incidentes técnicos |
| Responsável de privacidade/jurídico | [a preencher] | Revisão de `docs/governance/`, decisões de notificação |
| Apoio às famílias (Portão 2+) | [a preencher] | Canal direto de suporte |
