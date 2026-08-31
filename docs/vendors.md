# Inventário de fornecedores e requisitos de contratação

Este documento lista todos os fornecedores de terceiros usados ou
previstos, e o que tem de ser verificado/contratado **antes** de qualquer
um deles processar dados reais de uma criança.

## Estado atual (Etapas 1–3)

| Fornecedor | Usado para | Estado | Dados reais tocados? |
|---|---|---|---|
| Google Firebase (Authentication, Firestore, Storage, Functions, App Check) | Backend completo | **Real**, configuração pronta | Ainda não (sem projeto de produção criado) |
| Netlify | Alojamento do frontend | **Real**, configuração pronta | Não (só ficheiros estáticos) |
| — Antivírus/antimalware | Análise de ficheiros carregados | **Não contratado** — interface pronta (`functions/src/antivirus.js`), bloqueia sempre em produção até haver um serviço real | N/A |
| — OCR | Reconhecimento de texto em imagens/PDFs digitalizados | **Não contratado** — interface pronta (`functions/src/ocr.js`), documento fica em erro explícito até haver um serviço real | N/A |
| — Fornecedor de IA (extração estruturada avançada, "Perguntar aos documentos") | Organizar informação de documentos aprovados | **Não contratado.** Usa-se sempre um adaptador mock/heurístico local (`functions/src/extraction.js`, `functions/src/ai.js`) — nunca uma chamada de rede a um modelo de terceiros | N/A |
| — Fornecedor de e-mail transacional | Envio de e-mails de convite/verificação | **Não contratado** para convites (o link é copiado manualmente pelo proprietário); verificação de e-mail usa o mecanismo nativo do Firebase Auth | N/A |

## Requisitos antes de contratar um fornecedor de IA real

Antes de ligar qualquer serviço de IA externo ao gateway em
`functions/src/ai.js`, é obrigatório documentar e verificar,
por escrito, no mínimo:

1. **Contrato / Acordo de Processamento de Dados (DPA).** Cláusulas de
   responsabilidade, RGPD (arts. 28 e seguintes), e se aplicável
   Cláusulas Contratuais-Tipo para transferências fora da UE/EEE.
2. **Retenção.** Por quanto tempo o fornecedor guarda o texto enviado e
   as respostas geradas — o objetivo é o mínimo tecnicamente necessário,
   idealmente zero retenção além da duração do pedido.
3. **Localização do processamento.** Em que região(ões) os servidores do
   fornecedor processam os dados — coerência com a residência de dados
   na UE já assumida para o resto do sistema (ver
   `docs/firebase-setup.md`, "Região").
4. **Subcontratantes.** Lista de subprocessadores do próprio fornecedor
   (ex.: se usam infraestrutura de nuvem de outra empresa) e onde estão.
5. **Uso dos dados para treino.** Confirmação explícita, contratual, de
   que o conteúdo enviado **não é usado para treinar nenhum modelo geral
   do fornecedor** — nem para o cliente Sobredot nem para terceiros. Isto
   é um requisito não negociável do produto (ver
   `docs/architecture.md`, "Camada de IA privada").
6. **Isolamento por pedido.** Confirmação de que o fornecedor não mistura
   contexto entre pedidos de clientes diferentes (multi-tenancy segura).
7. **Direito de auditoria/certificações** relevantes (ex.: SOC 2, ISO
   27001) proporcionais à sensibilidade dos dados (dados de crianças,
   potencialmente dados de saúde).

Só depois desta verificação documentada é que `functions/src/ai.js`
deve trocar o adaptador mock por uma chamada real — a arquitetura já
prevê essa substituição sem alterar o resto do sistema (o "gateway" é a
única fronteira que muda).

## Por que o adaptador é sempre mock nesta etapa

- Não existe, nesta fase do produto, nenhum contrato assinado com um
  fornecedor de IA.
- Os documentos usados em desenvolvimento são sempre sintéticos (nomes e
  conteúdo fictícios).
- O adaptador mock (`buildGroundedAnswer` em `functions/src/ai.js`) tem
  uma propriedade importante: **nunca pode inventar factos**, porque só
  reorganiza o que já foi recuperado e filtrado por criança — o que
  torna o isolamento entre crianças verificável por teste (ver o teste
  canário em `tests/rules/aiRetrieval.canary.test.js`) de uma forma que
  seria muito mais difícil de garantir com um modelo de linguagem real
  sem as mesmas garantias de grounding.
