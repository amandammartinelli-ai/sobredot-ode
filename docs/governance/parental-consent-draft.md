# Consentimento parental — RASCUNHO

> Ver `README.md` desta pasta. Este é o texto que, uma vez validado
> juridicamente, seria apresentado ao responsável parental/tutor **antes**
> de qualquer registo real de dados sobre a criança — não uma checkbox
> genérica de "aceito os termos". Precisa de confirmação jurídica sobre:
> (1) se consentimento explícito é de facto a base jurídica correta para
> cada categoria de dado (ver `data-map.md`), e (2) a formulação exata
> exigida para ser válida ao abrigo do RGPD art. 7.º e 9.º/2/a.

## Quando é pedido

No fim do processo de registo da conta, antes de introduzir o primeiro
dado sobre uma criança específica — nunca como uma condição genérica de
"aceitar os termos" misturada com outras autorizações.

## Texto proposto (a validar)

> **Consentimento para tratamento de dados sobre [nome da criança]**
>
> Como responsável parental/tutor de **[nome da criança]**, confirmo
> que:
>
> 1. Compreendi o que a Sobredot regista e guarda sobre a minha criança,
>    para quê, e por quanto tempo — conforme explicado na
>    [Política de Privacidade](./privacy-policy-draft.md).
> 2. Autorizo o registo e o tratamento de informação sobre o percurso de
>    desenvolvimento da minha criança nesta aplicação, incluindo
>    informação que pode revelar dados de saúde ou de necessidades
>    específicas.
> 3. Compreendo que posso, a qualquer momento, ver, corrigir, exportar,
>    restringir o uso de inteligência artificial sobre, ou pedir a
>    eliminação completa destes dados — sem qualquer penalização.
> 4. Compreendo que este consentimento pode ser retirado a qualquer
>    momento, e que retirá-lo não afeta a legalidade do tratamento já
>    feito antes da retirada.
> 5. Compreendo que a Sobredot **não substitui** avaliação médica,
>    psicológica ou educativa profissional.
>
> ☐ Confirmo e autorizo.
>
> [Assinatura eletrónica / registo de aceitação com data e hora]

## Requisitos técnicos já implementados

- O consentimento, uma vez dado, fica registado com data/hora
  (`families/{familyId}/consents`, `children/{childId}/consents`).
- A retirada do consentimento é implementada como o pedido de
  eliminação/restrição de processamento — ver
  [`data-rights.md`](./data-rights.md).

## Pendências para o jurista

- [ ] Confirmar se o consentimento deve ser por categoria de dado
      separadamente (ex.: um para "registos gerais", outro específico
      para "medicação") em vez de um único bloco.
- [ ] Confirmar a formulação exata do texto para validade legal.
- [ ] Confirmar o que acontece quando há mais do que um responsável
      parental e nem todos concordam (ex.: pais separados) —
      atualmente o sistema não distingue este caso.
- [ ] Confirmar o processo para uma criança que atinja a maioridade
      durante o uso da aplicação (transição de titularidade dos dados).
