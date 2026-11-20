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

## Limitação importante desta implementação

Durante a implementação, **não foi possível alcançar `developer.bling.com.br`**
(nem seu spec OpenAPI) a partir do ambiente desta sessão — o host foi
liberado nas configurações de rede, mas a ferramenta de busca de páginas
usada não conseguiu resolver o domínio mesmo assim. Os nomes de endpoint e
de campo usados em `lib/notasFiscais/blingClient.ts` e
`lib/notasFiscais/fieldMapping.ts` vêm do changelog oficial do Bling e de
guias técnicos de parceiros (Koncili, Nango) encontrados por busca — **não**
da documentação de referência primária, que não pôde ser lida.

Confirmado com razoável confiança (changelog oficial do Bling):
- Base URL da API v3: `https://api.bling.com.br/Api/v3`.
- Criar a nota (`POST /nfe`) e enviá-la à SEFAZ (`POST /nfe/{id}/enviar`)
  são chamadas **separadas** — o módulo depende disso para nunca emitir
  de verdade sem confirmação explícita.

**Não confirmado / precisa ser validado com uma conta Bling de teste real
antes de emitir notas de produção:**
- Nome exato de cada campo do corpo de `POST /nfe` (natureza da operação,
  estrutura de `contato`/`endereco`, etc.) — `buildNfePayload` é uma
  tentativa razoável, não uma cópia da doc oficial.
- Enum exato de `situacao`/status retornado pela API (por isso o sistema
  nunca traduz silenciosamente: grava o texto cru do Bling em
  `bling_status` ao lado do status interno, e só reconhece algumas
  palavras-chave para decidir o status interno).
- Onde exatamente vêm o link do DANFE e o XML na resposta — o código lê
  `linkDanfe`/`linkXml` de forma defensiva (sem quebrar se não vierem).
- Nomes de escopo OAuth exatos para notas fiscais.
- Se/como a v3 trata NFC-e e NFS-e como recursos separados.

**Antes de emitir uma nota real em produção**: conecte uma conta Bling
(de teste, se o Bling oferecer ambiente de testes — isso também não foi
confirmado) e acompanhe o retorno de `POST /nfe` e `POST /nfe/{id}/enviar`
em `fiscal_invoices.last_response`/`error_message` para corrigir qualquer
nome de campo que a API realmente exigir. Nenhuma nota é enviada à SEFAZ
sem o clique explícito em "Confirmar e enviar à SEFAZ".

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

- `companies`: `inscricao_estadual`, `regime_tributario` — dados do
  emitente exigidos pela NF-e, ainda não existiam no cadastro da empresa.
- `products`: `ncm`, `cfop` — exigidos por item da nota pela SEFAZ. A
  tela de revisão em `/notas-fiscais/[orderId]` aponta quando algum
  produto do pedido ainda não tem esses dois campos preenchidos.

## O que foi validado nesta implementação

- Migração aplicada com sucesso no banco do projeto (tabelas, RLS,
  índices, trigger de `updated_at`).
- Fluxo de código segue os padrões já existentes no repositório
  (OAuth do Mercado Pago, autenticação de módulo do Catálogo Online,
  RLS por `company_id`, cifra AES-256-GCM).

## O que ainda depende de configuração real (não pôde ser testado agora)

- Todo o fluxo OAuth de ponta a ponta (precisa de `BLING_CLIENT_ID`/
  `BLING_CLIENT_SECRET` reais e de um app cadastrado no Bling).
- As chamadas reais a `POST /nfe` e `POST /nfe/{id}/enviar` contra uma
  conta Bling de verdade — nada foi emitido nem enviado à SEFAZ.
