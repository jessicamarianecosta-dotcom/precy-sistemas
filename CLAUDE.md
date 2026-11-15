# Precy+ — instruções para o Claude

## Preenchimento do modelo de "Criar combinações em massa"

Contexto: Produtos → Variações → "Criar combinações em massa" baixa um
`.xlsx` (botão "Baixar modelo", gerado por `buildCreateVariantsWorkbook` em
`lib/catalog/variantsExcel.ts`) com colunas livres por grupo de variação +
SKU/Estoque/Prazo (dias)/Peso (kg)/Preço-base, e o usuário sobe de volta
pelo botão "Escolher arquivo preenchido" (lido por `parseCreateVariantsWorkbook`
na mesma lib, via rota `.../criar-em-massa/analisar`).

Sempre que o usuário pedir para "preencher" essa planilha (em vez de digitar
linha por linha manualmente), siga este processo — NUNCA peça para o
ChatGPT ou outra ferramenta fora deste ambiente gerar/exportar o `.xlsx`
final, pois o gerador de planilhas delas produz um arquivo com estrutura
interna incompatível e a importação falha com "Arquivo inválido":

1. **Reúna os dados**: se o usuário ainda não passou a regra completa das
   combinações (grupos, opções, preços — fixos ou por fórmula), pergunte
   antes de gerar qualquer coisa. Não invente preços nem combinações.
2. **Use a estrutura real do produto quando houver `productId`**: busque os
   grupos/opções já cadastrados (tabelas `product_variation_groups` /
   `product_variation_options`) para que os cabeçalhos de coluna batam
   exatamente com os nomes dos grupos existentes — grupo já cadastrado tem
   que vir com o nome idêntico (comparação é case-insensitive, mas o nome
   precisa ser compatível); grupo novo pode ter qualquer nome de cabeçalho.
3. **Gere o `.xlsx` com ExcelJS**, no mesmo formato de `buildCreateVariantsWorkbook`
   (aba "Novas combinações", coluna "Nº", colunas de grupo, depois "SKU",
   "Estoque", "Prazo (dias)", "Peso (kg)", "Preço-base" — nomes exatos, ver
   constantes `CREATE_COL_*` em `lib/catalog/variantsExcel.ts`).
4. **Valide antes de entregar**: recarregue o arquivo gerado com a mesma
   lib (ExcelJS) e confirme que abre sem erro e que as colunas obrigatórias
   (`Preço-base` e pelo menos uma coluna de grupo) são encontradas — do
   jeito que `parseCreateVariantsWorkbook` espera — antes de enviar o
   arquivo ao usuário.
5. **Entregue o arquivo pronto** (anexo na conversa) para upload direto em
   "Escolher arquivo preenchido" — sem edição manual.

### Prompt padrão (uso do usuário)

O usuário pode colar algo assim para disparar esse fluxo:

> Preencha o modelo de combinações em massa do produto [nome ou productId],
> seguindo o processo do CLAUDE.md. Regras das combinações:
> - Grupo [nome]: opções [lista]
> - Grupo [nome]: opções [lista]
> - Preço-base: [valor fixo, ou fórmula/tabela de preços por combinação]
> - SKU/Estoque/Prazo/Peso (opcional): [regra, se houver]
> Gere o .xlsx já pronto para eu importar.
