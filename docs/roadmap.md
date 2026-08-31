# Roadmap — cinco etapas

Este documento acompanha a construção gradual da Sobredot. Cada etapa deve
ser concluída, validada e aprovada antes de avançar para a seguinte.

## Etapa 1 — Fundação do produto (esta etapa)

- Estrutura de projeto, sistema de design, protótipo navegável com dados
  fictícios, i18n preparado, documentação inicial, configuração de
  build/deploy sem segredos reais.
- Sem autenticação real, sem upload de documentos, sem IA.

## Etapa 2 — Autenticação e contas reais (prevista)

- Ligação ao Firebase Authentication (email/palavra-passe e/ou
  fornecedores sociais, a decidir).
- Modelo de conta: encarregado de educação, criança, convite de
  colaboradores (escola/profissional), papéis e permissões.
- Firestore: modelo de dados real para crianças, registos e relações,
  substituindo os dados fictícios em `src/data/mock/`.
- Regras de segurança do Firestore alinhadas com `docs/threat-model.md`
  (nenhum acesso automático da ODE a dados sensíveis).
- Firebase App Check ativado.

## Etapa 3 — Registo completo e sincronização (prevista)

- Persistência real dos registos das dez categorias (hoje só locais).
- Edição e remoção de registos, histórico de alterações.
- Sincronização entre dispositivos/colaboradores da mesma criança.
- Notificações básicas (ex.: lembrete de medicação), sem automação clínica.

## Etapa 4 — Documentos e relatórios (prevista)

- Upload de laudos, avaliações e relatórios para o Cloud Storage.
- Geração de relatórios/resumos do percurso a partir dos registos
  existentes (sem IA nesta etapa — resumo estruturado, não interpretativo).
- Controlo de partilha explícito por documento e por pessoa.

## Etapa 5 — Insights com IA (prevista)

- Cruzamento assistido por IA entre registos do quotidiano e documentos
  carregados, sempre apresentado como **apoio à compreensão**, nunca como
  diagnóstico, prescrição ou decisão automática.
- Explicabilidade mínima: toda a sugestão de insight deve indicar em que
  registos/documentos se baseia.
- Revisão de privacidade dedicada antes do lançamento desta etapa, dado o
  processamento de dados de saúde por terceiros (modelo de IA).

---

Este roadmap é indicativo e pode ser ajustado à medida que cada etapa é
validada com utilizadores reais (famílias, escolas, profissionais e
equipa da Oficina das Emoções).
