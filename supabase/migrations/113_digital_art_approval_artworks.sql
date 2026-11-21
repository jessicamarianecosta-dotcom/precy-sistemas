-- Digital art approval: introduz o conceito de "arte" (artwork) como a
-- unidade aprovável, independente do item do pedido e independente das
-- demais artes do mesmo link. Antes, um link tinha UMA versão cobrindo
-- todos os arquivos e UM status só — aprovar ou pedir alteração valia
-- para tudo junto. Agora cada arte tem seu próprio histórico de versões
-- e seu próprio status; aprovar a arte 1 não mexe na arte 2.
create table if not exists public.order_art_approval_artworks (
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null references public.order_art_approval_links(id) on delete cascade,
 order_item_id uuid references public.order_items(id) on delete cascade,
 label text,
 position integer not null default 0,
 current_version integer not null default 1 check(current_version > 0),
 status text not null default 'aguardando_aprovacao' check(status in ('aguardando_aprovacao','aprovada','alteracao_solicitada')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists order_art_approval_artworks_link_idx on public.order_art_approval_artworks(link_id,position);

-- order_item_id deixa de ser a âncora obrigatória do link: cada arte tem
-- a sua própria associação de item (ou nenhuma, para "arte geral do
-- pedido"), então o link não precisa mais de um item fixo.
alter table public.order_art_approval_links alter column order_item_id drop not null;

-- Versões passam a pertencer a uma arte, não direto ao link. link_id
-- fica redundante mas é mantido para evitar joins extras nas consultas
-- mais comuns (histórico por link).
alter table public.order_art_approval_versions add column if not exists artwork_id uuid references public.order_art_approval_artworks(id) on delete cascade;

-- Backfill: cada link existente (modelo antigo, 1 versão cobrindo tudo)
-- vira uma única arte, preservando o histórico de versões já gravado.
do $$
declare
 r record;
 v_artwork_id uuid;
begin
 for r in select * from public.order_art_approval_links loop
  if not exists (select 1 from public.order_art_approval_artworks where link_id = r.id) then
   insert into public.order_art_approval_artworks(link_id, order_item_id, current_version, status)
   values (r.id, r.order_item_id, r.current_version, case when r.status in ('aprovada','alteracao_solicitada') then r.status else 'aguardando_aprovacao' end)
   returning id into v_artwork_id;
   update public.order_art_approval_versions set artwork_id = v_artwork_id where link_id = r.id and artwork_id is null;
  end if;
 end loop;
end $$;

alter table public.order_art_approval_versions alter column artwork_id set not null;
alter table public.order_art_approval_versions drop constraint if exists order_art_approval_versions_link_id_version_number_key;
create unique index if not exists order_art_approval_versions_artwork_version_idx on public.order_art_approval_versions(artwork_id,version_number);
-- Índice antigo (link_id,version_number desc) da migration 108 fica
-- redundante mas inofensivo; não é removido aqui para evitar um DROP
-- INDEX desnecessário. Este índice novo cobre as consultas por link.
create index if not exists order_art_approval_versions_link_created_idx on public.order_art_approval_versions(link_id,created_at desc);

alter table public.order_art_approval_notifications add column if not exists artwork_id uuid references public.order_art_approval_artworks(id) on delete cascade;

alter table public.order_art_approval_artworks enable row level security;
revoke all on public.order_art_approval_artworks from anon,authenticated;
grant all on public.order_art_approval_artworks to service_role;
