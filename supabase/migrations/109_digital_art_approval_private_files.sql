-- Digital art approval: private storage copy of each version's files.
-- (Estas colunas já estavam aplicadas diretamente no projeto Supabase —
-- este arquivo documenta e versiona o que já é real, para que uma
-- aplicação limpa das migrations reproduza o schema em produção.)
alter table public.order_art_approval_versions
  add column if not exists private_file_paths text[] not null default '{}';
