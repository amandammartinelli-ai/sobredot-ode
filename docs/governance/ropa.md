# Registo de Atividades de Tratamento (RAT/ROPA) — RASCUNHO

> Ver `README.md` desta pasta. Estrutura alinhada com o RGPD art. 30.º
> (registo do responsável pelo tratamento). Falta confirmar formalmente
> a identificação do responsável pelo tratamento e do encarregado de
> proteção de dados (se aplicável) — campos deixados como `[a preencher]`.

## Responsável pelo tratamento

- **Entidade**: [a preencher — Oficina das Emoções / entidade jurídica exata]
- **Contacto**: [a preencher]
- **Encarregado de proteção de dados (EPD/DPO)**: [a preencher — obrigatório confirmar se a escala/natureza dos dados exige a nomeação de um, ao abrigo do art. 37.º]

## Atividade de tratamento: "Registo e acompanhamento do percurso da criança"

| Campo (art. 30.º) | Conteúdo |
|---|---|
| Finalidades | Permitir à família registar, organizar e consultar de forma longitudinal informação sobre o percurso de desenvolvimento da criança; apoiar a comunicação com escola/profissionais mediante autorização explícita da família |
| Categorias de titulares | Crianças (objeto do registo, não titulares da conta); responsáveis parentais/tutores (titulares da conta); cuidadores familiares; colaboradores escolares; profissionais |
| Categorias de dados pessoais | Identificação (nome, data de nascimento da criança; nome/e-mail dos adultos); dados de categoria especial prováveis (saúde, necessidades específicas) nos registos de comportamento/emoções/medicação/documentos — ver `data-map.md` |
| Categorias de destinatários | Nenhum destinatário externo por omissão; colaboradores/profissionais só mediante concessão de acesso explícita, com âmbito e prazo definidos pela família |
| Transferências para países terceiros | Nenhuma nesta etapa — todo o processamento em `europe-west1` (UE) |
| Prazos de conservação previstos | Ver `data-map.md`, coluna "Retenção", por categoria de dado |
| Medidas técnicas e organizativas | Ver `docs/threat-model.md` e `docs/security-hardening.md` — isolamento por regras de segurança testado, quotas anti-abuso, auditoria imutável, TLS em trânsito e cifra em repouso (padrão Firebase), ausência de segredos no cliente |

## Atividade de tratamento: "Autenticação e gestão de conta"

| Campo | Conteúdo |
|---|---|
| Finalidades | Autenticar utilizadores, prevenir acesso não autorizado, comunicação operacional (recuperação de conta) |
| Categorias de titulares | Responsáveis parentais/cuidadores; colaboradores; profissionais |
| Categorias de dados | E-mail, palavra-passe (gerida pelo Firebase Auth, nunca acessível à aplicação), papel na família |
| Destinatários | Nenhum |
| Transferências | Nenhuma (Firebase Auth — a confirmar a região exata de processamento com o fornecedor, ver `data-map.md`) |
| Conservação | Enquanto a conta existir |
| Medidas | Autenticação gerida por fornecedor certificado (Google Firebase); nenhuma palavra-passe é armazenada nem vista pela aplicação |

## Atividade de tratamento: "Segurança, auditoria e anti-abuso"

| Campo | Conteúdo |
|---|---|
| Finalidades | Detetar e prevenir acesso indevido; evidenciar conformidade; limitar utilização abusiva de funcionalidades de IA |
| Base jurídica a validar | Interesse legítimo (art. 6.º/1/f) |
| Categorias de dados | Metadados técnicos de ações (nunca conteúdo — ver `docs/logging-policy.md`) |
| Destinatários | Administrador técnico interno (ver `docs/admin-dashboard.md`) |
| Conservação | Ver `data-map.md`, "Auditoria técnica" e "Dados técnicos internos" |

## Pendências para o jurista

- [ ] Confirmar identificação formal do responsável pelo tratamento e,
      se aplicável, nomear e registar o EPD/DPO.
- [ ] Confirmar se alguma atividade exige registo/notificação adicional
      à CNPD.
- [ ] Rever prazos de conservação face à AIPD (`dpia.md`).
- [ ] Assinar e datar; manter atualizado a cada alteração relevante do
      tratamento (novo fornecedor, nova finalidade, etc.).
