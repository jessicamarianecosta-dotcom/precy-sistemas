-- Digital art approval: encrypted token, stored so the team can recover
-- the public link after a page refresh without re-deriving it from the
-- one-way hash (token_hash remains the lookup key used by the public
-- routes; token_ciphertext is only decrypted for the authenticated team
-- view, never exposed to anon/authenticated roles directly).
-- (Coluna já estava aplicada diretamente no projeto Supabase — este
-- arquivo documenta e versiona o que já é real.)
alter table public.order_art_approval_links
  add column if not exists token_ciphertext text;
