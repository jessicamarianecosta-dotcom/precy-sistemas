-- Ficha de Produção: modelo padrão de impressão da empresa + campo de responsável no pedido

alter table companies
  add column if not exists default_pdf_template text not null default 'cliente'
  check (default_pdf_template in ('cliente', 'producao'));

alter table orders
  add column if not exists responsavel text;
