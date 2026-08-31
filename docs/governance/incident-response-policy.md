# Política de resposta a incidentes de dados pessoais — RASCUNHO

> Ver `README.md` desta pasta. Este documento cobre as **obrigações
> legais e organizacionais** de um incidente (quem decide, prazos,
> quem é notificado). Os **passos técnicos** (como conter, investigar,
> corrigir) ficam no runbook técnico — ver
> `docs/runbooks/incident-response.md` (Etapa 5, tarefa 36). Um
> incidente real segue os dois documentos em paralelo.

## O que conta como incidente de dados pessoais

Qualquer violação de segurança que resulte, acidental ou ilicitamente,
na destruição, perda, alteração, divulgação ou acesso não autorizados a
dados pessoais tratados pela Sobredot — RGPD art. 4.º/12. Exemplos
concretos para este produto:

- Uma falha de isolamento que permita a uma família ver dados de outra
  (o pior caso, e o critério de bloqueio nº1 do lançamento).
- Um segredo (chave de fornecedor, conta de serviço) exposto
  publicamente.
- Acesso indevido por uma conta comprometida (ex.: palavra-passe fraca
  reutilizada).
- Um administrador a aceder a conteúdo fora do que o painel
  operacional permite (ver `docs/admin-dashboard.md`) — não deveria ser
  tecnicamente possível, mas conta como incidente se acontecer.
- Perda de disponibilidade que impeça a família de exercer os seus
  direitos (ex.: exportação/eliminação avariada durante um período
  prolongado) — só é incidente de dados se afetar confidencialidade,
  integridade ou disponibilidade dos dados pessoais em si, a confirmar
  caso a caso com o jurista.

## Papéis e decisão

| Papel | Responsabilidade |
|---|---|
| [a preencher — responsável técnico] | Deteta/recebe o alerta, aciona o runbook técnico, contém o incidente |
| [a preencher — responsável de privacidade/jurídico] | Decide se o incidente é notificável à CNPD e/ou aos titulares, redige as comunicações |
| [a preencher — responsável final] | Aprova a comunicação às famílias afetadas, se aplicável |

Nesta fase (equipa pequena), estes papéis podem recair sobre a mesma
pessoa — mas a decisão de notificar ou não deve ficar sempre registada
por escrito, com justificação, mesmo quando a resposta é "não é
notificável".

## Prazos (RGPD art. 33.º e 34.º)

- **Até 72 horas** após tomar conhecimento do incidente: notificação à
  CNPD, salvo se for improvável que o incidente resulte em risco para
  os direitos e liberdades das pessoas (essa avaliação tem de ficar
  documentada, mesmo quando a conclusão é "não notificar").
- **Sem atraso indevido**: comunicação direta aos titulares afetados
  (neste caso, aos responsáveis parentais/tutores, nunca à criança
  diretamente) quando o incidente for suscetível de resultar em elevado
  risco para os seus direitos e liberdades.
- Um incidente contido antes de qualquer exposição real de dados
  (ex.: uma vulnerabilidade encontrada e corrigida sem exploração
  confirmada) pode não ser notificável — mas a avaliação e a decisão
  continuam a ter de ficar registadas.

## Conteúdo mínimo do registo interno de um incidente (independentemente de ser notificável)

- Data/hora de deteção e de ocorrência (se diferentes).
- Natureza do incidente e categorias/volume aproximado de dados/pessoas
  afetadas.
- Medidas de contenção já tomadas.
- Avaliação de risco e decisão de notificar ou não, com justificação.
- Se notificado: data da notificação à CNPD e/ou aos titulares, e cópia
  do texto enviado.

O painel administrativo (`docs/admin-dashboard.md`) já tem uma coleção
simples de incidentes operacionais (`incidents`) — serve para o registo
técnico do dia a dia, mas **não substitui** o registo formal de um
incidente de dados pessoais nos moldes acima, que deve ser mantido
separadamente com o detalhe jurídico exigido.

## Comunicação às famílias afetadas (quando aplicável)

Deve incluir, em linguagem simples (nunca jargão técnico, mesmo dirigida
a adultos, dado o contexto emocionalmente sensível):

1. O que aconteceu, em termos concretos.
2. Que dados foram (ou podem ter sido) afetados.
3. O que a Sobredot já fez para conter e corrigir.
4. O que a família pode fazer (ex.: mudar a palavra-passe).
5. Um contacto direto para perguntas.

## Pendências para o jurista

- [ ] Confirmar/preencher os papéis responsáveis.
- [ ] Confirmar o modelo de comunicação à CNPD e às famílias.
- [ ] Confirmar se é necessário um seguro de responsabilidade civil
      cibernética antes do piloto com dados reais.
