# Modelo de ameaças inicial — Sobredot

Documento vivo. Nesta etapa não existe backend nem dados reais, pelo que a
maioria dos riscos abaixo é **prospetiva** — descreve o que terá de ser
verdade quando o Firebase for ligado, e serve como checklist para as
próximas etapas.

## O que está fora de âmbito nesta etapa

- Não há autenticação real, não há transmissão de dados a um servidor, não
  há dados pessoais reais de nenhuma criança. O "modo de demonstração" é
  apenas um estado de interface guardado em `localStorage` do próprio
  dispositivo do utilizador.
- Não avaliamos aqui a segurança do Netlify ou do GitHub em si — assume-se
  a configuração padrão segura dessas plataformas.

## Ativos a proteger (quando houver dados reais)

1. **Registos do quotidiano da criança** (emoções, comportamentos, sono,
   alimentação, medicação, escola, comunicação, sensorialidade, conquistas,
   observações) — dados sensíveis sobre uma criança e, indiretamente, sobre
   a família.
2. **Documentos/laudos** (fase futura) — potencialmente dados de saúde,
   categoria especial ao abrigo do RGPD.
3. **Identidade e papel de quem regista** (família, escola, profissional).
4. **Metadados de relação** (`relationshipOrigin`: ODE, parceiro, direta).

## Atores e confiança

| Ator | Confiança | Nota |
|---|---|---|
| Encarregado de educação | Alta, dono do consentimento | Deve poder rever/revogar partilhas |
| Escola/profissional convidado | Média, âmbito limitado | Acesso deve ser explícito, nunca automático |
| Oficina das Emoções (ODE) | Média, **não automática** | `relationshipOrigin: 'ode'` identifica a proveniência da relação, não concede acesso aos dados sensíveis por si só |
| Sobredot (operador da plataforma) | Alta, mas minimizada | Acesso técnico deve ser auditável e mínimo |
| Terceiro não autorizado | Nula | Superfícies: dispositivo partilhado, link mal partilhado, falha de configuração |

## Riscos identificados e mitigação prevista

### 1. Acesso indevido por proximidade da ODE
**Risco:** por a Sobredot ser "uma solução da Oficina das Emoções", presumir-se
implicitamente que a ODE vê tudo o que é registado sobre os seus alunos.
**Mitigação:** `relationshipOrigin` é um metadado de proveniência, não uma
permissão. O acesso da ODE a dados de uma criança específica terá sempre de
ser um consentimento explícito e revogável, nunca herdado automaticamente
da relação de matrícula. A documentar formalmente nas regras de segurança
do Firestore quando forem escritas.

### 2. Exposição de segredos no frontend
**Risco:** credenciais reais do Firebase (ou de outro serviço) a serem
commitadas no repositório ou publicadas no bundle do cliente.
**Mitigação já aplicada nesta etapa:**
- `.env` está no `.gitignore`; só `.env.example` (valores fictícios) é
  versionado.
- `src/config/firebase.config.js` só lê `import.meta.env`, nunca contém
  valores hardcoded.
- Nenhum segredo de servidor (chave privada, token de serviço) pertence ao
  frontend — isso ficará sempre em Cloud Functions.
**Mitigação futura:** Firebase App Check para reduzir abuso de API mesmo
com a configuração pública do cliente exposta (comportamento esperado do
Firebase Web SDK).

### 3. Dados de demonstração confundidos com dados reais
**Risco:** alguém a rever a demonstração concluir, erradamente, que os
dados apresentados são reais, ou usar o protótipo com dados reais de uma
criança verdadeira.
**Mitigação já aplicada nesta etapa:**
- Aviso persistente "Dados de demonstração" sempre visível, nunca escondido
  atrás de um clique.
- Nomes claramente fictícios (ex.: "Matias Exemplo", "Beatriz Fictícia").
- Nenhum campo aceita, nesta etapa, upload de ficheiros reais.

### 4. Falsa sensação de autenticação/segurança
**Risco:** o botão "Entrar em modo de demonstração" ser confundido com um
verdadeiro início de sessão seguro.
**Mitigação já aplicada nesta etapa:** o texto é explícito quanto a ser uma
demonstração; não existe campo de palavra-passe nem qualquer elemento
visual que imite formulários de autenticação real (ex.: nenhum ícone de
cadeado, nenhuma referência a "sessão segura").

### 5. IA a ser percebida como já ativa ou como decisora
**Risco:** a área de Insights sugerir, mesmo que involuntariamente, que já
existe análise automática ou recomendação clínica.
**Mitigação já aplicada nesta etapa:** o texto da vista de Insights afirma
explicitamente "A IA ainda não está ativa nesta versão" e explica que,
mesmo no futuro, o objetivo é apoiar a compreensão — nunca diagnosticar,
prescrever ou decidir.

### 6. Retenção de dados locais indesejada
**Risco:** dados de demonstração ficarem no dispositivo depois de a pessoa
terminar a exploração (relevante mesmo sendo dados fictícios, por hábito e
por preparar o padrão certo para quando os dados forem reais).
**Mitigação já aplicada nesta etapa:** opção explícita em Perfil →
Privacidade para "Apagar dados locais desta demonstração", que limpa tudo o
que a Sobredot guardou no `localStorage` do dispositivo.

## Perguntas em aberto para etapas futuras

- Como é revogado, na prática, o consentimento de partilha com a escola ou
  com a ODE, depois de já ter sido concedido?
- Que dados ficam no Firestore vs. Cloud Storage (documentos) e como são as
  regras de segurança de cada um?
- Como é feita a exportação/eliminação de dados a pedido do titular
  (direitos RGPD)?
- Qual o modelo de partilha entre múltiplos cuidadores da mesma criança
  (ex.: pai e mãe em agregados separados)?
