create table if not exists public.order_art_approval_links (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 order_item_id uuid not null references public.order_items(id) on delete cascade,
 token_hash text not null unique,
 status text not null default 'aguardando_aprovacao' check(status in ('aguardando_aprovacao','aprovada','alteracao_solicitada','cancelada')),
 current_version integer not null default 1 check(current_version > 0),
 public_notes text, deadline timestamptz, created_by uuid references auth.users(id) on delete set null,
 revoked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists order_art_approval_links_item_idx on public.order_art_approval_links(company_id,order_item_id,created_at desc);
create table if not exists public.order_art_approval_versions (
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null references public.order_art_approval_links(id) on delete cascade,
 version_number integer not null check(version_number > 0),
 file_ids uuid[] not null default '{}',
 instructions_version text not null, instructions_text text not null, public_notes text,
 status text not null default 'aguardando_aprovacao' check(status in ('aguardando_aprovacao','aprovada','alteracao_solicitada','substituida')),
 created_at timestamptz not null default now(), unique(link_id,version_number)
);
create table if not exists public.order_art_approval_responses (
 id uuid primary key default gen_random_uuid(),
 version_id uuid not null references public.order_art_approval_versions(id) on delete cascade,
 response text not null check(response in ('aprovada','alteracao_solicitada')),
 customer_name text, customer_note text, consent_text text not null, consented_at timestamptz not null,
 ip_address inet, user_agent text, attachment_paths text[] not null default '{}',
 created_at timestamptz not null default now(), unique(version_id)
);
create index if not exists order_art_approval_versions_link_idx on public.order_art_approval_versions(link_id,version_number desc);
alter table public.order_art_approval_links enable row level security;
alter table public.order_art_approval_versions enable row level security;
alter table public.order_art_approval_responses enable row level security;
revoke all on public.order_art_approval_links from anon,authenticated;
revoke all on public.order_art_approval_versions from anon,authenticated;
revoke all on public.order_art_approval_responses from anon,authenticated;
grant all on public.order_art_approval_links to service_role;
grant all on public.order_art_approval_versions to service_role;
grant all on public.order_art_approval_responses to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('art-approvals','art-approvals',false,10485760,array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
