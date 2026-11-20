# Notas Fiscais (NF-e via Bling) — beta privado

## O que existe hoje

- Módulo visível e funcional **só** para a conta `jessicamarianecosta@gmail.com`,
  checada pelo ID estável do Supabase Auth (`lib/notasFiscais/betaAccess.ts`),
  nunca pelo e-mail enviado pelo browser. Gate em três camadas, igual ao
  Catálogo Online: `middleware.ts` (UI dá 404, API dá 403), e de novo em
  toda rota de API (`lib/notasFiscais/server-auth.ts`).
- Conexão OAuth 2.0 com o Bling, uma por empresa (`bling_connections`),
  tokens cifrados com AES-256-GCM (`lib/notasFiscais/crypto.ts`).
- Fluxo: escolher um pedido em `/notas-fiscais` → revisar dados
  aproveitados do pedido/cliente/produtos e o que falta preencher →
  criar a nota como **rascunho** no Bling (`POST /nfe`) → confirmar
  explicitamente o envio à SEFAZ (`POST /nfe/{id}/enviar`), em tela
  separada. Nenhuma chamada de envio roda automaticamente.
- Só NF-e (nota de produto). `fiscal_invoices.invoice_type` já existe
  para permitir NFC-e/NFS-e no futuro sem migração nova, mas nada disso
  está implementado.
- Prevenção de duplicidade: índice único parcial em
  `fiscal_invoices(order_id)` para notas "vivas", e a rota de criação
  nunca gera uma segunda nota no Bling para o mesmo pedido se uma
  tentativa anterior já chegou a receber um `bling_invoice_id` — mesmo
  que essa tentativa tenha falhado depois (ex.: timeout no envio).

## Status desta validação (2026-11-20)

A primeira versão deste módulo foi escrita sem conseguir alcançar
`developer.bling.com.br` — os nomes de campo vinham do changelog e de
guias de parceiros, nunca da referência oficial. Nesta sessão, o host
**foi alcançado** (referência interativa em `/referencia` + o OpenAPI em
`/build/assets/openapi-*.json`, ambos lidos por completo pelo navegador),
e o código foi corrigido para bater com o schema real. A lista abaixo
separa o que ficou **confirmado diretamente na doc oficial** do que
**ainda depende de testar contra a conta Bling de verdade conectada** —
o Bling não oferece um ambiente de testes/sandbox para a API v3 de NF-e
(ver seção própria abaixo), então essa segunda lista só se resolve
emitindo de fato uma nota real.

### Confirmado na doc oficial (referência interativa + OpenAPI)

- Criar a nota (`POST /nfe`) e enviá-la à SEFAZ
  (`POST /nfe/{idNotaFiscal}/enviar`) são chamadas **separadas** — o
  módulo depende disso pra nunca emitir de verdade sem confirmação
  explícita. Confirmado.
- `POST /nfe/{id}/enviar` **não aceita corpo** (só o query param opcional
  `enviarEmail`, default `false`) e responde `{ data: { xml } }` — nunca
  devolve `situacao`. A versão anterior deste código lia
  `response.data.situacao` daí, que nunca existiu; corrigido para fazer
  um `GET /nfe/{id}` logo depois, tanto ao criar quanto ao enviar, e usar
  a resposta desse GET como fonte de verdade do status.
- `naturezaOperacao` é um **objeto** `{ id }`, referenciando um registro
  **já cadastrado na conta Bling** (`GET /naturezas-operacoes`) — nunca
  uma string livre, e não existe endpoint de NF-e pra criar uma nova.
  A versão anterior mandava uma string direto no payload, o que a API
  teria rejeitado. Corrigido: a usuária digita a descrição na tela (ex.:
  "Venda de mercadoria") e `app/api/notas-fiscais/pedido/[orderId]/criar`
  resolve pelo `GET /naturezas-operacoes?descricao=...`, dando erro claro
  se não achar nada com esse nome (nunca inventa um id).
- O item da nota (`NotasFiscaisItemDTO`) exige `codigo` (código/SKU do
  produto) — a versão anterior não enviava. NCM do item é
  `classificacaoFiscal`, não `ncm`. **Não existe campo de CFOP no item**
  — a versão anterior enviava um `cfop` por item que a API não tem onde
  colocar; o CFOP é resolvido pelo Bling a partir da natureza de operação
  escolhida, não por nós.
- `contato.contribuinte` (`1` Contribuinte do ICMS / `2` Isento / `9` Não
  contribuinte) é **obrigatório** e não existia na versão anterior. O
  cadastro de cliente do Precy+ não distingue isso hoje — o código grava
  sempre `9` (não contribuinte), a opção mais comum pra quem vende a
  consumidor final/varejo (ver comentário em `fieldMapping.ts`). Se o
  Bling rejeitar isso pra algum cliente PJ específico, o erro cru da API
  aponta exatamente o campo, e aí vale evoluir o cadastro de cliente.
- O endereço do contato (`NotasFiscaisContatoEnderecoDTO`) **não tem**
  campo de código IBGE/município — a versão anterior mandava
  `codigoMunicipio` ali, campo que não existe nesse schema. Removido.
  `endereco`, `bairro` e `município` são obrigatórios; `numero`, `uf` e
  `cep` não são obrigatórios no schema (mas continuam pedidos na tela,
  por prudência).
- `numero` e `dataOperacao` são obrigatórios no nível raiz da nota — a
  versão anterior não enviava nenhum dos dois. Corrigido: `numero` usa o
  número do pedido do Precy+, `dataOperacao` usa o timestamp da chamada
  (formato `yyyy-MM-dd HH:mm:ss`, confirmado no schema).
- **Não existe campo de dados do emitente** (`CNPJ`/IE/regime
  tributário/endereço da empresa) em `POST /nfe`. A nota é emitida em
  nome da própria conta Bling autenticada — esse cadastro vive
  inteiramente do lado do Bling (Cadastros → Empresas), fora do alcance
  desta API. Os campos `companies.inscricao_estadual`/`regime_tributario`
  continuam no cadastro do Precy+ só pra referência da usuária; **não
  bloqueiam mais** a criação da nota aqui (bloqueavam antes, sem
  necessidade real).
- `situacao` é um **código inteiro** (`1` Pendente, `2` Cancelada,
  `3` Aguardando recibo, `4` Rejeitada, `5` Autorizada, `6` Emitida
  DANFE, `7` Registrada, `8` Aguardando protocolo, `9` Denegada,
  `10` Consulta situação, `11` Bloqueada) — nunca uma string livre como a
  versão anterior presumia. `SITUACAO_NFE_LABELS` em `blingClient.ts`
  traduz pra exibição; `bling_status` grava `"<código> (<rótulo>)"`.
- **Não existe link pronto de DANFE/XML** em nenhuma resposta de
  criação/consulta/envio — a versão anterior lia `linkDanfe`/`linkXml`
  de forma defensiva, campos que não existem em nenhum schema oficial. O
  documento sai de um endpoint à parte,
  `GET /nfe/documento/{chaveAcesso}?formato=pdf|xml`, e vem em
  `data[0].conteudo`: **base64 de um GZIP** do PDF/XML real, não uma URL.
  `obterDocumentoNfe()` em `blingClient.ts` já chama esse endpoint
  corretamente, mas **o fluxo de baixar/descomprimir e oferecer o
  download pra usuária ainda não está implementado** — fora do escopo
  desta validação (o módulo hoje só cria rascunho e confirma envio,
  ainda não chega ao estado "autorizada" na tela). `fiscal_invoices.
  danfe_url`/`xml_url` seguem como colunas sem uso até esse fluxo existir.
- URLs de OAuth confirmadas: `authorize` em
  `https://www.bling.com.br/Api/v3/oauth/authorize` (a doc mostra
  exemplos com e sem `www.`, ambos válidos), `token` em
  `https://api.bling.com.br/Api/v3/oauth/token`. **`redirect_uri` e
  `scope` enviados na URL de autorização são ignorados pelo Bling** — ele
  sempre usa o que está cadastrado no próprio app em
  developer.bling.com.br/aplicativos. Ou seja: o "Link de redirecionamento"
  cadastrado no app PRECISA ser exatamente
  `<NEXT_PUBLIC_APP_URL>/api/bling/oauth/callback`, e não basta configurar
  isso só no `.env`.
- O Bling está **descontinuando tokens opacos em favor de JWT**. Pra
  continuar recebendo (e sendo aceito com) tokens JWT, o header
  `enable-jwt: 1` precisa ir em toda obtenção/renovação de token E em
  toda chamada de recurso autenticada — adicionado em `blingClient.ts`
  (chamadas de recurso) e `blingConnection.ts`/`callback/route.ts`
  (obtenção/renovação de token). Sem o header, o Bling ainda devolve
  token opaco (funciona por ora, mas a doc pede migração o quanto antes).
- Não existem **escopos nomeados** na API v3 — o `securitySchemes` do
  OpenAPI mostra um objeto `scopes: {}` vazio para o OAuth2. O cadastro
  de escopos do app (etapa "Lista de escopos" ao criar o app em
  developer.bling.com.br/aplicativos) é feito por **categoria/módulo** na
  tela do Bling (ex.: "Notas Fiscais Eletrônicas", "Naturezas de
  Operação"), não por string de escopo na URL de autorização.

### Ainda não confirmado (só resolve testando numa conta Bling real)

- Se o `numero` que mandamos (número do pedido do Precy+) é aceito pelo
  Bling como número da NF-e, ou se ele exige/prefere numeração própria
  sequencial — o schema só diz que o campo é obrigatório e uma string,
  não como ele se relaciona com a numeração fiscal real da conta.
- Se `contribuinte: 9` (não contribuinte) é sempre aceito, inclusive pra
  clientes pessoa jurídica sem Inscrição Estadual cadastrada no Precy+.
- Se a resolução de `naturezaOperacao` por descrição (match exato,
  case-insensitive) encontra sempre uma natureza já cadastrada na conta,
  ou se a conta da usuária precisa cadastrar uma chamada exatamente
  "Venda de mercadoria" antes do primeiro uso.
- Mensagens de erro reais de validação (`400 VALIDATION_ERROR`) da API
  pra casos como CPF/CNPJ inválido, cliente sem bairro, etc. — a doc
  mostra o formato do erro, não todos os textos possíveis.
- O OpenAPI oficial do Bling tem uma inconsistência aparente: tanto
  `NotasFiscaisDadosPostDTO` quanto `NotasFiscaisDadosGetDTO` declaram
  `required: ["data", "valor"]`, mas nenhum dos dois schemas tem
  propriedades chamadas `data`/`valor` — parece um erro de cópia no
  OpenAPI do próprio Bling (talvez copiado de outro recurso, como
  parcelas). Não implementado (não daria pra saber o que mandar ali
  mesmo se quiséssemos); se a API realmente exigir isso na prática, o
  erro cru da criação vai mostrar.

## Por que não foi criada uma nota de teste nesta sessão

O Bling **não oferece um ambiente de testes/sandbox** para a API v3 de
NF-e — confirmado na doc oficial ("Como testar": a única forma de testar
é autorizar o app contra a própria conta de produção, via Postman ou
direto, não existe uma conta ou um `tpAmb`/`ambiente` de homologação na
API). O painel web do Bling tem um aviso sobre "simular a NF-e com IBS e
CBS em ambiente de homologação" (reforma tributária 2026), mas isso é
uma configuração de conta inteira feita na própria tela do Bling, não
algo exposto por um parâmetro da API — mudar isso afetaria qualquer nota
emitida pela conta, não só pelo Precy+, e é uma decisão da conta Bling
da usuária, não do código.

Como qualquer `POST /nfe` bem-sucedido cria um registro real na conta de
produção da usuária (mesmo sendo só "rascunho", sem ir à SEFAZ), e o
pedido explícito foi não ligar isso a uma venda real nem criar
pedido/cliente/produto fictício na conta — a validação ponta a ponta
contra o Bling (conectar a conta, criar o rascunho, consultar o
resultado) **não foi executada**. O que foi feito: todo o código foi
revisado e corrigido campo a campo contra o schema oficial (seção
acima), e validado com `npx tsc --noEmit` (sem erros).

## O que falta pra eu continuar (decisão da usuária)

1. **Registrar o app no Bling** (developer.bling.com.br/aplicativos →
   Área do Integrador → Criar aplicativo), visibilidade **Privado**,
   com o "Link de redirecionamento" **exatamente**
   `<NEXT_PUBLIC_APP_URL>/api/bling/oauth/callback`, e selecionando os
   escopos/categorias: pelo menos **Notas Fiscais Eletrônicas** e
   **Naturezas de Operação**. Essa etapa exige decisões só da usuária
   (nome do app, categoria de negócio, quais escopos marcar) e cria um
   registro real na conta Bling de produção — não fiz isso sozinho.
   Se um app assim já existir, só preciso do Client ID/Secret dele.
2. Depois de criado, configurar em Vercel (produção e preview):
   `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET` (do app acima) e
   `NOTAS_FISCAIS_ENCRYPTION_KEY` (`openssl rand -hex 32`, chave própria
   — nenhuma das três existe hoje no projeto Vercel). Nenhum desses
   valores deve ser colado no chat — a usuária cola direto no painel da
   Vercel, ou me fala quando já estiverem lá.
3. Clicar em **"Conectar conta do Bling"** dentro do Precy+
   (`/notas-fiscais`) — isso leva à tela de autorização OAuth do próprio
   Bling, onde a usuária concede o acesso. Esse clique de consentimento
   também precisa ser da usuária, não automatizado por mim.
4. Só depois dos passos acima dá pra validar de fato: criar um rascunho
   real (ideal: contra um pedido de teste que a usuária já tenha, não um
   fictício) e consultar o resultado — o que fecha o pedido original
   desta tarefa.

## Configuração necessária (nenhum segredo no código)

1. Em [developer.bling.com.br/aplicativos](https://developer.bling.com.br/aplicativos),
   cadastre um aplicativo ligado à API v3, com a URL de callback:
   `<NEXT_PUBLIC_APP_URL>/api/bling/oauth/callback`
2. Variáveis de ambiente (ver `.env.example`):
   - `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET` — do app cadastrado acima.
   - `NOTAS_FISCAIS_ENCRYPTION_KEY` — `openssl rand -hex 32`, chave própria
     (nunca reaproveitar `PAYMENTS_ENCRYPTION_KEY`, do Mercado Pago).
3. Dentro do Precy+, a própria usuária do beta conecta a conta do Bling
   em `/notas-fiscais` → "Conectar conta do Bling".

## Como liberar para outras usuárias no futuro

Hoje a liberação é por um único ID fixo em
`lib/notasFiscais/betaAccess.ts` (`canAccessNotasFiscais`). Para abrir
para mais contas:

- **Lista curta/manual** (equivalente ao estágio atual): troque a
  constante `BETA_USER_ID` por uma lista (`BETA_USER_IDS: string[]`) e
  `includes`.
- **Baseado em plano**, quando o módulo for para todo mundo: troque
  `canAccessNotasFiscais` para checar o plano efetivo (mesmo padrão de
  `lib/catalog/betaAccess.ts` + `checkPlan` em `lib/subscription/check.ts`),
  e repita a mesma troca nos três pontos que chamam a função hoje:
  `middleware.ts`, `lib/notasFiscais/server-auth.ts` e
  `components/layout/Sidebar.tsx`.
- Em qualquer um dos dois casos, nenhuma migração de banco é necessária —
  a tabela `fiscal_invoices`/`bling_connections` já é isolada por
  `company_id` via RLS, igual a qualquer outra tabela do sistema; o beta
  é só uma trava de produto, não de dados.

## Campos novos no cadastro

- `companies`: `inscricao_estadual`, `regime_tributario` — mantidos no
  cadastro da empresa só para referência da usuária (ver "Confirmado na
  doc oficial" acima: não entram no payload da NF-e; o cadastro fiscal
  que de fato importa pra emissão é o da própria conta Bling).
- `products`: `ncm` — exigido por item da nota pela SEFAZ (campo
  `classificacaoFiscal` no payload). O campo `cfop`, adicionado na
  versão anterior, **não é mais usado** (não existe no schema de item da
  NF-e — ver acima); segue na tabela sem uso, pode ser removido num
  cleanup futuro. A tela de revisão em `/notas-fiscais/[orderId]` aponta
  quando algum produto do pedido ainda não tem NCM preenchido.

## O que foi validado nesta sessão

- Schema de request/response de `POST /nfe`, `POST /nfe/{id}/enviar`,
  `GET /nfe/{id}`, `GET /nfe/documento/{chaveAcesso}` e
  `GET /naturezas-operacoes`, lido direto da referência interativa e do
  OpenAPI oficiais (`developer.bling.com.br`).
- Código de `lib/notasFiscais/fieldMapping.ts`, `blingClient.ts`,
  `blingConnection.ts` e das rotas de API corrigido pra bater com esse
  schema (ver lista "Confirmado na doc oficial" acima).
- `npx tsc --noEmit` sem erros depois das mudanças.
- Nenhuma chamada real foi feita à API do Bling (sem app registrado/sem
  conexão OAuth ainda — ver "O que falta pra eu continuar" acima).

## O que ainda depende de configuração real (não pôde ser testado agora)

- Todo o fluxo OAuth de ponta a ponta (precisa de `BLING_CLIENT_ID`/
  `BLING_CLIENT_SECRET` reais, de um app cadastrado no Bling, e do
  clique de autorização da usuária).
- As chamadas reais a `POST /nfe`, `GET /nfe/{id}` e
  `POST /nfe/{id}/enviar` contra uma conta Bling de verdade — nada foi
  criado, emitido nem enviado à SEFAZ.
- O fluxo de baixar o DANFE/XML (`obterDocumentoNfe`, já implementado no
  cliente, mas sem UI nem descompressão GZIP do lado do Precy+ ainda).
