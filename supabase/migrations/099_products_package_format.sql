-- ============================================================
-- PRECY+ — Migration 099: Formato da embalagem do produto
-- ============================================================
-- A API da SuperFrete (conferida contra a documentação oficial antes desta
-- migração) só aceita peso e dimensões (comprimento/largura/altura) por
-- produto — não existe um parâmetro de "formato" que a Precy+ possa enviar
-- pra pedir uma tarifa de envelope/tubo diferenciada, e quem decide como
-- empacotar fisicamente (inclusive se vários produtos cabem juntos num
-- envelope só) é o algoritmo da própria transportadora a partir das
-- dimensões recebidas — fora do nosso controle.
--
-- `package_format` existe então como um auxílio de CADASTRO: ajuda a pessoa
-- a registrar peso/dimensões mais realistas pra cada tipo físico de
-- embalagem (uma caixa, um tubo ou um envelope têm formas bem diferentes),
-- o que já reduz o frete calculado sozinho — um envelope fino declarado com
-- as medidas certas custa menos que a mesma embalagem cadastrada com
-- medidas de caixa. Não é usado nas chamadas à SuperFrete (que continuam
-- recebendo só weight/length/width/height, como já acontecia).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS package_format TEXT NOT NULL DEFAULT 'box'
    CHECK (package_format IN ('box', 'tube', 'envelope'));

COMMENT ON COLUMN public.products.package_format IS
  'Formato físico da embalagem (box/tube/envelope) — só orienta o cadastro de peso/dimensões (lib/catalog/shipping não lê esta coluna); a SuperFrete não tem parâmetro de formato.';
