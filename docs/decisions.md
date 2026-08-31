# Decisões técnicas — registo (ADR resumido)

## 1. Vite apenas como ferramenta de build, sem framework de UI

**Decisão:** usar Vite (template vanilla) só para desenvolvimento e build;
o código de aplicação é HTML/CSS/JS puro, com módulos ES nativos.
**Motivo:** requisito explícito do produto. Evita também bloatware e
mantém o bundle pequeno (~28KB JS, ~17KB CSS antes de gzip nesta etapa).
**Alternativas consideradas:** React/Vue foram explicitamente excluídos.

## 2. Router baseado em hash (`#/rota`), sem `history.pushState`

**Decisão:** navegação através de `window.location.hash`.
**Motivo:** funciona em qualquer alojamento estático sem nenhuma
configuração de servidor — cada "rota" é, para o Netlify, sempre o mesmo
`index.html`. Isto significa que **não é necessário nenhum redirecionamento
de SPA** no `netlify.toml` (nenhuma regra `/* -> /index.html`), o que
cumpre a instrução de só adicionar esse redirecionamento se a navegação
realmente exigir.
**Custo aceite:** URLs menos "limpos" (`/#/dashboard` em vez de
`/dashboard`). Aceitável para um protótipo; pode ser revisto se, numa fase
futura, houver necessidade de partilhar links profundos indexáveis por
motores de busca.

## 3. `localStorage` como única fonte de estado nesta etapa

**Decisão:** toda a persistência (sessão de demonstração, criança
selecionada, registos criados, preferências) passa por
`src/services/storageService.js`.
**Motivo:** não há backend ainda; isolar o acesso ao `localStorage` num
único módulo torna trivial substituí-lo por Firestore/Firebase Auth mais
tarde, sem tocar nas vistas.

## 4. Sem gestor de estado nem virtual DOM

**Decisão:** cada vista é uma função que devolve um nó DOM; vistas com
estado interno (ex. `registerView`) gerem-no com variáveis de closure e
voltam a desenhar-se explicitamente via `mount()`.
**Motivo:** a complexidade da aplicação nesta etapa não justifica um
gestor de estado dedicado. Reavaliar se o número de vistas com estado
partilhado entre si crescer significativamente.

## 5. Camada de configuração Firebase sem SDK

**Decisão:** `src/config/firebase.config.js` só lê variáveis de ambiente e
devolve objetos simples; o pacote `firebase` não é sequer uma dependência
nesta etapa.
**Motivo:** requisito explícito da Etapa 1 ("crie somente a camada de
configuração"). Evita peso morto no bundle e falsas expectativas de que o
backend já está ligado.

## 6. Internacionalização com dicionário simples, sem biblioteca

**Decisão:** `t(chave)` resolve caminhos aninhados num objeto JS simples
(`src/i18n/pt.js`).
**Motivo:** suficiente para um único idioma nesta etapa, sem custo de
dependência. Se um segundo idioma for adicionado, `src/i18n/index.js` já
suporta múltiplos dicionários (`setLocale`, `getAvailableLocales`) sem
alterações estruturais.

## 7. Origem da relação como metadado, não como permissão

**Decisão:** `relationshipOrigin` (`ode` | `partner` | `direct`) em cada
criança fictícia é puramente informativo nesta etapa.
**Motivo:** registar a decisão de produto de que a ODE **não** tem acesso
automático a dados sensíveis só por a criança ser sua aluna — ver
`threat-model.md`, risco 1.

## 8. Diálogo de confirmação implementado à mão, sem `<dialog>` nativo

**Decisão:** `components/confirmDialog.js` implementa um modal acessível
manualmente (fecho com Escape, foco inicial no botão de confirmação, foco
devolvido ao elemento anterior ao fechar) em vez do elemento `<dialog>`
nativo do HTML.
**Motivo:** maior controlo imediato sobre o comportamento de foco em todos
os motores de navegação suportados nesta fase. Reavaliar `<dialog>` nativo
numa próxima etapa à medida que o suporte e as necessidades de estilo
ficarem mais claros.

## 9. Firestore/Cloud Functions em `europe-west1`

**Decisão:** fixar `europe-west1` (Bélgica) para o Firestore e para
todas as Cloud Functions (`functions/src/regional.js`), em vez do valor
por omissão `us-central1`.
**Motivo:** residência de dados na União Europeia. Documentado
explicitamente em `docs/firebase-setup.md` que isto **não é, por si só,
garantia de conformidade** legal — é uma condição técnica necessária,
não suficiente.

## 10. Estrutura e membros da família só por Cloud Functions

**Decisão:** `families/{id}` e `families/{id}/members/{uid}` têm
`allow write: if false` para o cliente; toda a mutação passa por
`createFamily`, `inviteFamilyMember`, `acceptFamilyInvite`,
`removeFamilyMember` (Admin SDK).
**Motivo:** elimina, por construção, a possibilidade de um utilizador se
autoatribuir o papel de "owner" ou entrar numa família alheia através de
uma escrita direta — mais simples e mais seguro do que tentar validar
esse cenário só com regras declarativas (que teriam de lidar com
condições de corrida entre a criação da família e a do primeiro
membro).

## 11. Uma família por utilizador nesta etapa

**Decisão:** `createFamily`/`acceptFamilyInvite` recusam se o utilizador
já pertencer a alguma família (verificado por
`collectionGroup('members').where('uid','==',uid)`).
**Motivo:** simplifica significativamente o modelo de descoberta de
família (`users/{uid}.familyId` como ponteiro único) nesta etapa.
**Custo aceite:** não suporta ainda, por exemplo, dois cuidadores em
agregados separados que sejam ambos "donos" de famílias diferentes com
a mesma criança — ver `docs/roadmap.md` para trabalho futuro
(multi-família).

## 12. `users/{uid}.familyId` como ponteiro, nunca como permissão

**Decisão:** o perfil do utilizador guarda `familyId`, escrito só pelo
servidor, lido pelo cliente para saber "a que família pertenço" ao
iniciar sessão num dispositivo novo.
**Motivo:** sem isto, um login num browser sem cache local nunca
encontraria uma família já existente (não há, por desenho, forma segura
de "listar as minhas famílias" via uma consulta arbitrária do cliente —
ver `docs/permissions.md`). O campo é deliberadamente **não confiável
para decidir acesso**: mesmo que um cliente malicioso o alterasse (o que
as regras já impedem), isso não concederia acesso real a nada, porque a
verdade continua a ser `families/{id}/members/{uid}`.

## 13. Convite de família por link manual, não por e-mail

**Decisão:** `inviteFamilyMember` devolve um link com token opaco para o
proprietário partilhar manualmente; não há envio automático de e-mail.
**Motivo:** enviar e-mail exigiria contratar e configurar um fornecedor
de e-mail transacional (ver `docs/vendors.md`) — fora do âmbito desta
etapa. Documentado como limitação conhecida.

## 14. Storage sem acesso direto do cliente — só URLs assinadas

**Decisão:** `storage.rules` nega sempre leitura/escrita direta do
cliente; upload e download passam sempre por uma Cloud Function
(`getDocumentUploadUrl`/`getDocumentDownloadUrl`) que gera uma URL
assinada de curta duração depois de verificar a permissão no Firestore.
**Motivo original considerado:** o padrão documentado pela Firebase para
autorizar Storage diretamente é usar regras que chamam
`firestore.get()`/`firestore.exists()` a partir de `storage.rules`.
**Porque foi abandonado:** durante o desenvolvimento, essa chamada entre
serviços foi reproduzida de forma determinística a falhar no Firebase
Emulator Suite deste ambiente — confirmado com um teste isolado que
seedava os documentos Firestore necessários (confirmados existentes via
leitura REST direta) e ainda assim `firestore.get()` dentro de
`storage.rules` devolvia um erro de valor nulo. Sem conseguir validar
essa funcionalidade de forma fiável, optou-se pelo desenho mais
conservador. **Resultado:** estritamente mais restritivo (nunca menos
seguro) e mais fácil de auditar (todo o acesso ao bucket fica registado
na execução de uma função específica).

## 15. `firebase-admin/firestore` (modular) em vez de `admin.firestore.FieldValue`

**Decisão:** todas as Cloud Functions importam `FieldValue`/`Timestamp`
de `require('firebase-admin/firestore')`, nunca através de
`admin.firestore.FieldValue`.
**Motivo:** descoberto durante testes manuais que o Firebase Functions
Emulator substitui `admin.firestore` (a função) por um invólucro próprio
que não preserva as propriedades estáticas do original
(`FieldValue`, `Timestamp`), causando `TypeError: Cannot read properties
of undefined` em produção-como-emulador. A API modular não está sujeita
a essa substituição e é, de qualquer forma, o caminho recomendado mais
recente do Admin SDK.

## 16. Testes de regras correm em série (`fileParallelism: false`)

**Decisão:** `vitest.rules.config.js` desativa o paralelismo entre
ficheiros de teste.
**Motivo:** todos os ficheiros em `tests/rules/` partilham a mesma
instância do Firestore Emulator (um único projeto,
`demo-sobredot-tests`). Alguns testes chamam `clearFirestore()`, que
apaga toda a base de dados do projeto — corrido em paralelo, um
ficheiro podia apagar os dados que outro tinha acabado de semear,
produzindo falhas intermitentes (observado e reproduzido durante o
desenvolvimento). Correr em série elimina essa classe de instabilidade
sem reduzir a cobertura dos testes.

## 17. Extração estruturada por heurística de secções, não por modelo de linguagem

**Decisão:** `functions/src/extraction.js` deteta secções por
cabeçalhos conhecidos em português (ex.: "Pontos fortes:",
"Recomendações:") em vez de chamar um modelo de IA para classificar o
texto.
**Motivo:** nenhum fornecedor de IA está contratado nesta etapa (ver
`docs/vendors.md`). A heurística é determinística, testável sem rede, e
tem uma propriedade de segurança importante — nunca produz uma
categoria sem correspondência real no texto (nunca "inventa"). Fica
documentado como um ponto de substituição futuro por um classificador
mais rico, mantendo a mesma interface (`extractStructuredItemsFromPages`).
