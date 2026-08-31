# Mapa de páginas — Etapa 1

| Rota | Vista | Acesso | Chrome (cabeçalho/nav) | Descrição |
|---|---|---|---|---|
| `#/` , `#/welcome` | `welcomeView` | Pública | Não | Apresentação, entrada em modo de demonstração, avisos de privacidade e limites do produto |
| `#/dashboard` | `dashboardView` | Demonstração | Sim | Seletor de criança, cartões de sono/humor/alimentação/medicação, botão REGISTAR, atalhos |
| `#/registar` | `registerView` | Demonstração | Sim | Grelha de 10 categorias → formulário local → confirmação → sucesso |
| `#/timeline` | `timelineView` | Demonstração | Sim | Lista cronológica de registos, com filtro por categoria |
| `#/documents` | `documentsView` | Demonstração | Sim | Estado vazio; upload desativado ("em breve") |
| `#/insights` | `insightsView` | Demonstração | Sim | Aviso explícito de que a IA ainda não está ativa |
| `#/reports` | `reportsView` | Demonstração | Sim | Estado vazio de relatórios |
| `#/profile` | `profileView` | Demonstração | Sim | Conta, crianças associadas, idioma, acessibilidade, privacidade, sair da demonstração |
| qualquer outra rota | `notFoundView` | Pública | Não | 404 interno, com atalho para o dashboard |

## Navegação principal

Presente em todas as rotas "de demonstração": Início, Linha do tempo,
Documentos, Insights, Relatórios, Perfil. Em ecrãs pequenos aparece fixa no
fundo; a partir de 1024px passa a barra lateral esquerda.

## Fluxo de registo (detalhe)

```
Categorias (10)
   │  (escolher categoria)
   ▼
Formulário local (nota opcional + intensidade)
   │  (guardar registo)
   ▼
Diálogo de confirmação
   │  (confirmar)
   ▼
Estado de sucesso ──► Novo registo (volta às categorias)
                  └──► Ver linha do tempo
```

Nesta etapa, "guardar" escreve apenas em `localStorage`
(`recordsService.createLocalRecord`) — nada é enviado para um servidor.

## Guarda de rotas

Rotas marcadas como não-públicas exigem uma "sessão" de demonstração ativa
(`authService.isAuthenticated()`). Sem ela, qualquer tentativa de aceder a
uma rota protegida redireciona para `#/welcome`. Isto não é segurança real
— é apenas para que o protótipo se comporte de forma coerente ao ser
recarregado ou partilhado.
