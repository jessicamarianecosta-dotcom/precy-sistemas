-- Digital art approval: a resposta do cliente passa a valer para UMA
-- arte (artwork), não para o link inteiro. Aprovar a arte 1 não mexe no
-- status das demais. O link só fica "aprovada" quando TODAS as artes
-- ativas estiverem aprovadas; aprovações já dadas nunca são desfeitas
-- quando outra arte recebe uma nova versão ou um pedido de alteração.
create or replace function public.register_art_approval_response(
  p_link_id uuid,
  p_artwork_id uuid,
  p_response text,
  p_customer_name text,
  p_customer_note text,
  p_consent_text text,
  p_ip_address inet,
  p_user_agent text,
  p_attachment_paths text[]
) returns table(response_id uuid, notification_id uuid, artwork_status text, link_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response_id uuid;
  v_notification_id uuid;
  v_version_id uuid;
  v_version_status text;
  v_artwork_status text;
  v_order_id uuid;
  v_company_id uuid;
  v_link_status text;
  v_label text;
  v_pending_count integer;
  v_total_count integer;
  v_next_link_status text;
begin
  if p_response not in ('aprovada', 'alteracao_solicitada') then
    raise exception 'invalid_response' using errcode = 'P0001';
  end if;

  select order_id, company_id, status into v_order_id, v_company_id, v_link_status
    from public.order_art_approval_links
   where id = p_link_id
   for update;
  if v_order_id is null then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;
  if v_link_status = 'cancelada' then
    raise exception 'already_responded' using errcode = 'P0003';
  end if;

  select status into v_artwork_status
    from public.order_art_approval_artworks
   where id = p_artwork_id and link_id = p_link_id
   for update;
  if v_artwork_status is null then
    raise exception 'artwork_not_found' using errcode = 'P0002';
  end if;
  if v_artwork_status <> 'aguardando_aprovacao' then
    raise exception 'already_responded' using errcode = 'P0003';
  end if;

  select v.id, v.status into v_version_id, v_version_status
    from public.order_art_approval_versions v
    join public.order_art_approval_artworks a on a.id = v.artwork_id and a.current_version = v.version_number
   where v.artwork_id = p_artwork_id
   for update;
  if v_version_id is null then
    raise exception 'version_not_found' using errcode = 'P0002';
  end if;
  if v_version_status <> 'aguardando_aprovacao' then
    raise exception 'already_responded' using errcode = 'P0003';
  end if;

  select coalesce(oi.name, 'arte do pedido') into v_label
    from public.order_art_approval_artworks a
    left join public.order_items oi on oi.id = a.order_item_id
   where a.id = p_artwork_id;

  insert into public.order_art_approval_responses(
    version_id, response, customer_name, customer_note, consent_text,
    consented_at, ip_address, user_agent, attachment_paths
  ) values (
    v_version_id, p_response, p_customer_name, p_customer_note, p_consent_text,
    now(), p_ip_address, p_user_agent, coalesce(p_attachment_paths, '{}')
  )
  returning id into v_response_id;

  update public.order_art_approval_versions
     set status = p_response
   where id = v_version_id and status = 'aguardando_aprovacao';

  update public.order_art_approval_artworks
     set status = p_response, updated_at = now()
   where id = p_artwork_id and status = 'aguardando_aprovacao';

  -- Status agregado do link: só fica "aprovada" quando não sobrar
  -- nenhuma arte pendente ou com alteração solicitada; nunca regride
  -- uma arte já aprovada por causa de outra.
  select count(*) filter (where status in ('aguardando_aprovacao','alteracao_solicitada')), count(*)
    into v_pending_count, v_total_count
    from public.order_art_approval_artworks
   where link_id = p_link_id;
  v_next_link_status := case when v_pending_count = 0 and v_total_count > 0 then 'aprovada' else 'aguardando_aprovacao' end;
  update public.order_art_approval_links
     set status = v_next_link_status, updated_at = now()
   where id = p_link_id;

  insert into public.order_art_events(order_id, company_id, event_type, description)
  values (
    v_order_id, v_company_id,
    case when p_response = 'aprovada' then 'aprovacao_digital_aprovada' else 'aprovacao_digital_alteracao_solicitada' end,
    case when p_response = 'aprovada' then 'Cliente aprovou a arte "' || v_label || '" pelo link público.'
         else 'Cliente solicitou alteração na arte "' || v_label || '": ' || coalesce(p_customer_note, '') end
  );

  insert into public.order_art_approval_notifications(
    company_id, link_id, artwork_id, version_id, response_id, notification_type, title, message
  ) values (
    v_company_id, p_link_id, p_artwork_id, v_version_id, v_response_id, p_response,
    case when p_response = 'aprovada' then 'Arte aprovada pelo cliente' else 'Alteração solicitada pelo cliente' end,
    case when p_response = 'aprovada' then 'O cliente aprovou a arte "' || v_label || '".'
         else 'O cliente solicitou alteração na arte "' || v_label || '": ' || coalesce(p_customer_note, '') end
  )
  returning id into v_notification_id;

  return query select v_response_id, v_notification_id, p_response, v_next_link_status;
end;
$$;

revoke all on function public.register_art_approval_response(uuid, uuid, text, text, text, text, inet, text, text[]) from public, anon, authenticated;
grant execute on function public.register_art_approval_response(uuid, uuid, text, text, text, text, inet, text, text[]) to service_role;
