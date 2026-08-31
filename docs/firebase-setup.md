# Configuração Firebase — desenvolvimento e produção

## Região

**`europe-west1` (Bélgica)** foi escolhida para Cloud Functions e para o
Firestore, por residência de dados na União Europeia.

> ⚠️ Escolher uma região da UE **não é, por si só, garantia de
> conformidade** com o RGPD ou qualquer outro regime legal. É uma
> condição técnica necessária, não suficiente — a conformidade real
> depende também de contratos com subcontratantes (ver
> `docs/vendors.md`), base legal para o tratamento, direitos dos
> titulares, avaliação de impacto quando aplicável, etc. Esta escolha
> técnica deve ser revista por quem tiver responsabilidade legal/DPO
> antes de qualquer lançamento com dados reais.

Ao criar o projeto Firebase real (produção):
1. Firestore → escolher explicitamente `europe-west1` (ou `eur3`
   multi-região) na criação da base de dados — **não pode ser mudado
   depois** sem migrar para um novo projeto.
2. Cloud Storage → escolher um bucket na mesma região.
3. Cloud Functions → `functions/src/regional.js` já fixa `europe-west1`
   para todas as funções; não é necessário configurar nada manualmente,
   mas confirme que a região está disponível para todos os triggers
   usados (Firestore, Storage, Auth, Pub/Sub agendado).

## Autenticação

E-mail/palavra-passe está ativo (`src/services/authService.js`):
criação de conta, início de sessão, verificação de e-mail, recuperação de
palavra-passe, terminar sessão. Login social (Google, etc.) está
preparado na arquitetura (o Firebase Auth suporta múltiplos
fornecedores sem alterar o modelo de dados) mas **não está ativado**
nesta etapa — para ativar, adicionar o fornecedor na consola do Firebase
e um botão correspondente em `src/views/auth/loginView.js`.

## Firebase App Check

`src/firebase/appCheck.js` inicializa o App Check com reCAPTCHA v3,
**apenas fora dos emuladores** (os emuladores não o exigem).

Para testar App Check localmente contra um projeto real (não o
emulador):
1. Defina `VITE_APPCHECK_DEBUG_MODE=true` no seu `.env` local.
2. Ao correr a aplicação, o SDK imprime um token de depuração na consola
   do browser na primeira execução.
3. Registe esse token manualmente em **Firebase Console → App Check →
   Apps → gerir tokens de depuração**.
4. **Nunca** comite esse token nem o publique no Netlify —
   `VITE_APPCHECK_DEBUG_MODE` tem de ser `false` (ou omitido) em
   qualquer build publicado.

## Firebase Emulator Suite

### Instalação e arranque

```bash
npm install               # já instala firebase-tools como devDependency
npm run emulators         # arranca Auth, Firestore, Storage, Functions, UI
```

A UI fica em `http://127.0.0.1:4000`. O estado é importado/exportado de
`.emulator-data/` (ignorado pelo git) através das flags `--import`/
`--export-on-exit` já configuradas no script `emulators`.

### Semear dados de demonstração

Com os emuladores a correr, noutra janela:

```bash
npm run seed:emulator
```

Cria uma família fictícia (`family-exemplo`), três crianças (dados de
`src/data/mock/`) e uma conta de demonstração:

```
demo@sobredot.exemplo / DemoSobredot123!
```

Esta palavra-passe só existe no Auth Emulator local — nunca é uma
credencial real e nunca deve ser usada num projeto real.

### Ligar o frontend aos emuladores

```bash
cp .env.example .env
```

`VITE_USE_EMULATORS=true` (valor por omissão) liga automaticamente
Auth, Firestore, Storage e Functions aos emuladores locais
(`src/firebase/app.js`). Ajuste `VITE_FIREBASE_PROJECT_ID` para
corresponder ao projeto do emulador (`demo-sobredot`, definido em
`.firebaserc`) para que o cliente veja os mesmos dados semeados.

### Testes de regras

```bash
npm run test:rules
```

Corre `tests/rules/**/*.test.js` contra um Firestore/Storage Emulator
Suite dedicado (projeto `demo-sobredot-tests`, isolado do ambiente de
desenvolvimento manual). Ver `docs/decisions.md` para a decisão de
correr estes ficheiros em série (`fileParallelism: false`) — todos
partilham a mesma instância de emulador.

### ⚠️ Nota específica deste ambiente de desenvolvimento (sandbox)

Neste ambiente de contentor isolado usado para construir a aplicação, a
variável de ambiente `HTTPS_PROXY` está definida globalmente para todo o
tráfego de saída. O `firebase-tools` (CLI) encaminha as suas próprias
chamadas HTTP internas — incluindo chamadas **entre os seus próprios
emuladores em `127.0.0.1`** — através dessa variável, sem respeitar
`NO_PROXY`. O gateway de saída deste sandbox bloqueia, corretamente,
tráfego para destinos internos passado por um proxy configurado para
saída externa, o que impede o emulador de Functions de registar gatilhos
do Firestore.

Isto **não acontece** numa máquina de desenvolvimento normal, num
executor de CI, ou em produção — só neste sandbox específico, por causa
da combinação particular de `HTTPS_PROXY` global + um cliente HTTP
interno do `firebase-tools` que não filtra `NO_PROXY`. A solução usada
durante o desenvolvimento (e documentada aqui para quem continuar a
trabalhar neste mesmo tipo de ambiente) foi correr os comandos do
Firebase CLI sem essas variáveis:

```bash
env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy npm run emulators
env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy npm run seed:emulator
env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy npm run test:rules
```

### Antivírus em desenvolvimento local (modo de depuração explícito)

Por omissão, o adaptador de antivírus (`functions/src/antivirus.js`)
**recusa sempre** — nenhum documento avança de "quarentena" sem uma
análise real. Isto é intencional: não simulamos segurança que não existe
(ver `docs/architecture.md`).

Para testar o resto do pipeline (verificação de conteúdo, extração)
localmente, sem um serviço de antivírus real, defina explicitamente, só
no emulador:

```bash
SOBREDOT_AV_DEV_PASSTHROUGH=true npm run emulators
```

Esta variável só tem efeito quando `FUNCTIONS_EMULATOR=true` (definido
automaticamente pelo próprio emulador) — nunca em produção, mesmo que
definida por engano.

### Limitação conhecida: URLs assinadas neste sandbox

`getDocumentUploadUrl`/`getDocumentDownloadUrl` usam
`file.getSignedUrl()` do Admin SDK, que exige credenciais reais capazes
de assinar (uma conta de serviço, ou `gcloud auth application-default
login`). Este sandbox de desenvolvimento não tem acesso a credenciais
reais nem à rede necessária para as obter, pelo que a geração de URLs
assinadas **falha aqui** com um erro de assinatura. Isto foi confirmado
diretamente (ver `docs/decisions.md`) e **não é uma limitação do
código** — funciona normalmente:
- em produção, onde a conta de serviço de execução das Cloud Functions
  tem automaticamente permissão de assinatura；
- em qualquer máquina de desenvolvimento com `gcloud auth
  application-default login` configurado uma vez.

A lógica de permissão partilhada por trás destas funções
(`resolveChildAccess`) foi validada isoladamente e com sucesso em
`tests/rules/resolveChildAccess.integration.test.js`, incluindo o caso de
concessão expirada. O resto do pipeline de processamento (validação,
extração, revisão) foi validado end-to-end fazendo o Admin SDK escrever
o ficheiro diretamente no bucket do emulador (contornando apenas o passo
de assinatura) — ver histórico de validação em `docs/decisions.md`.

## Segredos

| Tipo | Onde vive | Nunca vai para |
|---|---|---|
| Configuração pública do Firebase Web (`apiKey`, etc.) | `.env` do frontend (valores reais nunca commitados) | — (não é segredo, mas ainda assim fora do git) |
| Credenciais de administração (conta de serviço) | Variáveis de ambiente do ambiente de execução das Cloud Functions, geridas pela consola do Firebase/Google Cloud | GitHub, Netlify, browser |
| Chaves de fornecedores de IA (quando um for contratado) | Secret Manager do Google Cloud, acedido só pelas Cloud Functions | GitHub, Netlify, browser, logs |
| Token de depuração do App Check | Nunca gravado em ficheiro — só colado manualmente na consola | GitHub, Netlify |

Ver `docs/vendors.md` para o inventário de fornecedores e
`docs/logging-policy.md` para o que nunca pode aparecer em logs.
