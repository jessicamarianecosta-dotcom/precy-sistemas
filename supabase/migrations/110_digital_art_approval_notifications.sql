-- Digital art approval: independent status, persistent notifications and attachment audit.
create table if not exists public.order_art_approval_notifications (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 link_id uuid not null references public.order_art_approval_links(id) on delete cascade,
 version_id uuid not null references public.order_art_approval_versions(id) on delete cascade,
 response_id uuid references public.order_art_approval_responses(id) on delete set null,
 notification_type text not null check(notification_type in ('aprovada','alteracao_solicitada')),
 title text not null,
 message text not null,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists order_art_approval_notifications_company_idx
 on public.order_art_approval_notifications(company_id, created_at desc);
alter table public.order_art_approval_notifications enable row level security;
revoke all on public.order_art_approval_notifications from anon, authenticated;
grant all on public.order_art_approval_notifications to service_role;
alter table public.order_art_approval_links
 add column if not exists cancelled_at timestamptz,
 add column if not exists cancelled_by uuid;
alter table public.order_art_approval_versions
 add column if not exists superseded_at timestamptz;
