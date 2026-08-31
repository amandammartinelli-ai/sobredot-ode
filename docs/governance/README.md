# Governança e privacidade — Etapa 5

> **Estado: RASCUNHO.** Todos os documentos desta pasta foram escritos
> por engenharia, a partir do sistema real (`docs/data-model.md`,
> `firestore.rules`, `functions/src/*.js`), para servirem de ponto de
> partida a uma revisão jurídica formal — nunca como aconselhamento
> jurídico nem como substituto dela. **Nenhum é válido para uso com
> dados reais de crianças até ser revisto e aprovado por um jurista
> qualificado em proteção de dados em Portugal/UE** (ver
> `docs/pilot-plan.md`, portão 2, critério de bloqueio). Em particular,
> nenhuma "base jurídica" indicada abaixo está confirmada — são a
> hipótese mais provável de engenharia, marcada explicitamente como "a
> validar".

## Índice

| Documento | Cobre |
|---|---|
| [`data-map.md`](./data-map.md) | Mapa de dados: o quê, para quê, base jurídica a validar, origem, armazenamento, região, acesso, fornecedor, retenção, eliminação, partilha |
| [`dpia.md`](./dpia.md) | Rascunho de Avaliação de Impacto sobre a Proteção de Dados (AIPD/DPIA) |
| [`ropa.md`](./ropa.md) | Rascunho de Registo de Atividades de Tratamento (RAT/ROPA) |
| [`privacy-policy-draft.md`](./privacy-policy-draft.md) | Rascunho de política de privacidade orientada à família |
| [`terms-draft.md`](./terms-draft.md) | Rascunho de termos de utilização |
| [`parental-consent-draft.md`](./parental-consent-draft.md) | Rascunho de consentimento parental/do titular do poder paternal |
| [`child-information-draft.md`](./child-information-draft.md) | Informação adequada à idade para a criança (assentimento, não consentimento legal) |
| [`incident-response-policy.md`](./incident-response-policy.md) | Política de resposta a incidentes de dados pessoais (obrigações RGPD, papéis, prazos) |
| [`data-rights.md`](./data-rights.md) | Como os direitos do titular dos dados (acesso, retificação, portabilidade, restrição, apagamento) estão implementados |

`docs/vendors.md` (já existente desde a Etapa 3) cobre os requisitos de
contratação de fornecedores — não duplicado aqui.

## Porque ficam separados de `docs/threat-model.md` e `docs/security-hardening.md`

Esta pasta é sobre **obrigações legais e organizacionais** (o que a
Sobredot tem de comunicar, pedir consentimento, e a quem, ao abrigo do
RGPD e da legislação portuguesa aplicável a dados de crianças). Os
outros dois documentos são sobre **medidas técnicas** (regras,
autenticação, quotas). Uma AIPD, por exemplo, refere-se às medidas
técnicas como evidência de mitigação, mas o documento em si é uma
análise de risco para o titular dos dados, não uma especificação de
sistema.
