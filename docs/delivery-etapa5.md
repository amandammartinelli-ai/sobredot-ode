# Entrega — Etapa 5 (robustecimento para piloto controlado)

> **Conclusão principal: a aplicação NÃO está pronta para dados reais.**
> Está pronta para o Portão 1 do piloto (equipa interna, dados
> sintéticos — ver `docs/pilot-plan.md`). Vários portões continuam
> pendentes antes do Portão 2 (primeiras famílias reais), listados na
> checklist go/no-go abaixo. Nenhum critério de bloqueio de segurança
> conhecido está ativo — os pendentes são sobretudo de natureza legal
> (revisão jurídica) e operacional (backups, papéis por preencher),
> não técnica.

## 1. Relatório de testes

Suíte completa, corrida integralmente no fim desta etapa:

| Suíte | Comando | Resultado |
|---|---|---|
| Unitários (frontend) | `npm test` | ✅ 25/25 |
| Cloud Functions (unitários) | `npm run test:functions` | ✅ 53/53 |
| Regras/integração (Firebase Emulator Suite) | `npm run test:rules` | ✅ 93/93 |
| Build de produção | `npm run build` | ✅ sem erros |
| Lint (frontend + functions) | `npm run lint` | ✅ sem avisos |

**Total: 171 testes automatizados, todos verdes.**

Cobertura por área (não exaustiva — ver os ficheiros de teste para o
detalhe):

- Isolamento entre famílias e crianças, incluindo o teste canário de
  recuperação de contexto de IA.
- As 14 categorias da suíte de avaliação de segurança da IA
  (`tests/rules/aiSafetyEvals.integration.test.js`).
- Direitos da família de ponta a ponta, incluindo eliminação física
  real de um ficheiro no Storage Emulator (não simulada).
- Limites de utilização (rate limiting) por utilizador e por criança.
- Painel administrativo: agregações corretas e ausência de nomes de
  família/criança na resposta.
- Regras do Firestore/Storage: autopromoção a admin, auditoria
  imutável, isolamento de concessões de acesso.

### Testes manuais (não automatizados nesta etapa)

- **Fumo de navegação** (Playwright, contra os emuladores): login como
  utilizador de demonstração, navegação pelas 8 rotas autenticadas
  principais — 0 erros de consola.
- **Painel administrativo** (Playwright): conta sem privilégio de
  administrador vê o estado "Sem acesso"; conta promovida vê números
  reais; criar e resolver um incidente funciona de ponta a ponta.
- **Acessibilidade** (axe-core via Playwright, WCAG 2A/2AA/2.2AA): 15
  ecrãs, 8 violações na primeira passagem, 0 na segunda — ver
  `docs/accessibility.md` para o detalhe e para o que fica só para
  verificação humana (leitores de ecrã reais, dispositivos físicos).
- **Rede lenta / perda de ligação**: verificado manualmente no ecrã de
  login — ver `docs/accessibility.md`.

## 2. Matriz de riscos (resumo — ver `docs/threat-model.md` para o detalhe completo)

| Risco | Categoria STRIDE | Probabilidade residual | Impacto | Estado |
|---|---|---|---|---|
| Acesso cruzado entre famílias/crianças | Information Disclosure | Baixa (testado extensivamente) | Crítico | Mitigado e testado |
| Conta comprometida (sem MFA) | Spoofing | Média | Alto | Mitigação parcial — pendência aberta (risco 14) |
| Enumeração de contas | Information Disclosure | — | Médio | **Resolvido nesta etapa** |
| Upload malicioso | Tampering / DoS | Baixa | Médio | Mitigado e testado |
| Prompt injection (documento) | Information Disclosure | Baixa | Alto | Mitigado e testado |
| Exfiltração via perguntas repetidas à IA | Information Disclosure | Baixa | Alto | Mitigado (isolamento estrutural + quotas) |
| Link de relatório partilhado exposto | Information Disclosure | Baixa | Alto | Mitigado e testado |
| Abuso administrativo | Elevation of Privilege | Baixa | Crítico | Mitigado por desenho (sem acesso a conteúdo, sem acesso de emergência) |
| Conteúdo sensível em logs | Information Disclosure | Baixa | Alto | Mitigado por política e por código |
| Perda de dados sem backup | — | **Alta enquanto não configurado** | Crítico | **Não mitigado — bloqueador do Portão 2** |
| Dependência de terceiros vulnerável | — | Baixa (Dependabot ativo) | Variável | Mitigado, monitorização contínua |
| IA a diagnosticar/prescrever/decidir | Information Disclosure | Baixa (bloqueio ativo + suíte dedicada) | Crítico | Mitigado e testado |
| Falha de acessibilidade crítica | — | Baixa (auditado) | Alto (exclui utilizadores) | Mitigado nesta etapa; leitores de ecrã reais por confirmar |

## 3. Pendências — bloqueadoras vs. não bloqueadoras

### Bloqueadoras para o Portão 2 (famílias reais)

- [ ] Revisão jurídica formal de todos os documentos em
      `docs/governance/` (nenhum é válido como está).
- [ ] Backup do Firestore/Storage configurado **e restauro testado**
      (`docs/runbooks/backup-restore.md`).
- [ ] Consentimento parental final aprovado
      (`docs/governance/parental-consent-draft.md`).
- [ ] Papéis do piloto preenchidos (`docs/pilot-plan.md`, tabela final).
- [ ] Projetos Firebase de staging/produção separados criados (hoje só
      existe o projeto de demonstração `demo-sobredot`).

### Não bloqueadoras (podem esperar pelo Portão 3 ou por uma etapa de produção)

- Autenticação multifator (MFA) — recomendação, não bloqueio do Portão 2.
- Fornecedor de IA real, geração real de PDF, OCR/antivírus reais — a
  aplicação continua a funcionar com os adaptadores mock/heurísticos
  atuais, que são deliberadamente conservadores (nunca fingem
  capacidade que não têm — ver `docs/threat-model.md`, risco 9).
- Verificação com leitores de ecrã reais e dispositivos físicos —
  recomendada antes do Portão 2, mas o estado automatizado atual (0
  violações axe-core) já é uma base sólida.
- Multi-família por criança (pais em agregados separados).

## 4. Manual operacional (índice)

| Preciso de... | Ver |
|---|---|
| Saber o estado de saúde do sistema agora | `docs/admin-dashboard.md` (painel `#/admin`) |
| Perceber uma ameaça específica | `docs/threat-model.md` |
| Configurar/testar backups | `docs/runbooks/backup-restore.md` |
| Rodar um segredo | `docs/runbooks/secret-rotation.md` |
| Responder a um aviso de vulnerabilidade | `docs/runbooks/vulnerability-response.md` |
| Responder a um incidente (técnico) | `docs/runbooks/incident-response.md` |
| Responder a um incidente (obrigações legais) | `docs/governance/incident-response-policy.md` |
| Reverter um deploy | `docs/runbooks/deploy-rollback.md` |
| Publicar uma alteração normal | `docs/ci-cd.md`, `docs/deploy-netlify.md` |
| Entender o que cada ambiente Netlify/Firebase serve | `docs/deploy-netlify.md` |

## 5. Custos e alertas

- **Sem projeto de produção criado nesta etapa** — não há custos reais
  de Firebase ainda a monitorizar.
- Antes do Portão 2: configurar alertas de orçamento na consola do
  Google Cloud (Billing → Budgets & alerts) — recomendação inicial: um
  alerta a 50%/90%/100% de um orçamento mensal conservador, revisto
  depois de observar o consumo real do Portão 1.
- As quotas aplicativas já implementadas (`docs/security-hardening.md`,
  secção 2) funcionam como um limite superior de custo por
  família/criança para as operações de IA, independentemente de
  alertas de faturação — a primeira linha de defesa contra um custo
  descontrolado é sempre a quota, nunca só o alerta.
- Notificações de falha de deploy do Netlify — ver
  `docs/deploy-netlify.md`, "Monitorização e alertas de deploy".

## 6. Manutenção

- **Dependências**: Dependabot semanal (`.github/dependabot.yml`) +
  `npm audit` antes de cada entrega — ver
  `docs/runbooks/vulnerability-response.md`.
- **Testes**: qualquer alteração a `firestore.rules`, Cloud Functions,
  ou lógica de acesso exige `npm run test:rules` verde antes de fundir
  (imposto pelo CI, `.github/workflows/ci.yml`).
- **Documentação viva**: `docs/threat-model.md` e `docs/decisions.md`
  devem ser atualizados a cada alteração relevante de risco ou de
  decisão de arquitetura — não são documentos "de uma vez só".
- **Auditoria de acessibilidade**: sem CI automatizado ainda (ver
  `docs/accessibility.md`, "Como voltar a correr a auditoria") — repetir
  manualmente antes de cada portão do piloto e depois de qualquer
  alteração visual significativa.
- **Revisão do painel administrativo**: rever periodicamente se as
  métricas mostradas continuam a ser as relevantes à medida que o
  piloto cresce (`docs/admin-dashboard.md`).

## 7. Checklist go/no-go

**Para o Portão 1 (equipa interna, dados sintéticos) — GO:**

- [x] Suíte de testes completa verde (171/171).
- [x] Build de produção sem erros.
- [x] CI configurado (`.github/workflows/ci.yml`).
- [x] Ambientes Netlify/Firebase documentados
      (`docs/deploy-netlify.md`) — a criar fisicamente antes do primeiro
      deploy real.
- [x] Nenhum critério de bloqueio do lançamento ativo
      (`docs/pilot-plan.md`).

**Para o Portão 2 (primeiras famílias reais) — NO-GO até:**

- [ ] Revisão jurídica de `docs/governance/` concluída.
- [ ] Backup configurado e restauro testado com sucesso.
- [ ] Projetos Firebase de staging/produção criados e separados do de
      demonstração.
- [ ] Consentimento parental final aprovado e pronto a usar.
- [ ] Papéis do piloto atribuídos a pessoas concretas.

Nenhuma destas pendências é de natureza técnica de segurança — a
aplicação em si (regras, isolamento, quotas, auditoria, direitos da
família, salvaguardas de IA) está tecnicamente pronta para o Portão 2;
o que falta é jurídico e operacional. Isto não diminui a exigência: o
critério desta etapa é explícito — **não declarar a aplicação pronta
para dados reais enquanto algum portão estiver pendente**, e vários
estão.

---

Commit desta entrega: `chore: harden Sobredot for controlled pilot`.
