## O que muda e porquê

<!-- Uma explicação curta do problema resolvido ou da funcionalidade
adicionada — o "porquê", não só o "o quê" (isso já se vê no diff). -->

## Como foi testado

<!-- Testes automatizados novos/atualizados? Testado manualmente contra
os emuladores? Testado num deploy preview do Netlify? -->

- [ ] `npm run lint` e `npm run lint --prefix functions` sem avisos novos
- [ ] `npm test` (frontend) e `npm run test:functions` sem falhas
- [ ] `npm run test:rules` sem falhas (obrigatório em qualquer alteração
      a `firestore.rules`, `storage.rules` ou a lógica de acesso)
- [ ] `npm run build` sem erros

## Isolamento de dados e privacidade

<!-- Só relevante se a alteração tocar em regras, Cloud Functions,
consultas ao Firestore/Storage ou em qualquer caminho que leia/escreva
dados de família ou de criança. -->

- [ ] Não introduz nenhuma forma de uma família aceder a dados de outra
      família (ver `docs/threat-model.md`)
- [ ] Não acrescenta conteúdo sensível a nenhum log ou evento de
      auditoria (ver `docs/logging-policy.md`)
- [ ] N/A — esta alteração não toca em dados de família/criança

## Checklist antes de pedir revisão

- [ ] Sem segredos, chaves ou credenciais no diff
- [ ] Documentação relevante atualizada (`docs/`) se o comportamento mudou
- [ ] O branch de destino é o branch principal protegido, não outro branch de trabalho
