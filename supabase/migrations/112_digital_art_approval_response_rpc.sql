-- Digital art approval: registra a resposta do cliente (aprovação ou
-- solicitação de alteração) de forma atômica — resposta, status da
-- versão, status do link, evento do pedido e notificação interna
-- precisam valer juntos ou nenhum valer, nunca ficar parcialmente
-- aplicados por uma falha no meio de várias chamadas independentes.
-- FOR UPDATE nas linhas de versão/link serializa respostas concorrentes
-- para a mesma versão; o UNIQUE(version_id) em order_art_approval_responses
-- é o cinto-de-segurança final contra corrida.
create or replace function public.register_art_approval_response(
  p_link_id uuid,
  p_version_id uuid,
  p_response text,
  p_customer_name text,
  p_customer_note text,
  p_consent_text text,
  p_ip_address inet,
  p_user_agent text,
  p_attachment_paths text[]
) returns table(response_id uuid, notification_id uuid, final_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response_id uuid;
  v_notification_id uuid;
  v_version_status text;
  v_link_status text;
  v_order_id uuid;
  v_company_id uuid;
begin
  if p_response not in ('aprovada', 'alteracao_solicitada') then
    raise exception 'invalid_response' using errcode = 'P0001';
  end if;

  select status into v_version_status
    from public.order_art_approval_versions
   where id = p_version_id and link_id = p_link_id
   for update;
  if v_version_status is null then
    raise exception 'version_not_found' using errcode = 'P0002';
  end if;
  if v_version_status <> 'aguardando_aprovacao' then
    raise exception 'already_responded' using errcode = 'P0003';
  end if;

  select order_id, company_id, status into v_order_id, v_company_id, v_link_status
    from public.order_art_approval_links
   where id = p_link_id
   for update;
  if v_order_id is null then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;
  if v_link_status <> 'aguardando_aprovacao' then
    raise exception 'already_responded' using errcode = 'P0003';
  end if;

  insert into public.order_art_approval_responses(
    version_id, response, customer_name, customer_note, consent_text,
    consented_at, ip_address, user_agent, attachment_paths
  ) values (
    p_version_id, p_response, p_customer_name, p_customer_note, p_consent_text,
    now(), p_ip_address, p_user_agent, coalesce(p_attachment_paths, '{}')
  )
  returning id into v_response_id;

  update public.order_art_approval_versions
     set status = p_response
   where id = p_version_id and status = 'aguardando_aprovacao';

  update public.order_art_approval_links
     set status = p_response, updated_at = now()
   where id = p_link_id and status = 'aguardando_aprovacao';

  insert into public.order_art_events(order_id, company_id, event_type, description)
  values (
    v_order_id, v_company_id,
    case when p_response = 'aprovada' then 'aprovacao_digital_aprovada' else 'aprovacao_digital_alteracao_solicitada' end,
    case when p_response = 'aprovada' then 'Cliente aprovou a arte pelo link público.'
         else 'Cliente solicitou alteração: ' || coalesce(p_customer_note, '') end
  );

  insert into public.order_art_approval_notifications(
    company_id, link_id, version_id, response_id, notification_type, title, message
  ) values (
    v_company_id, p_link_id, p_version_id, v_response_id, p_response,
    case when p_response = 'aprovada' then 'Arte aprovada pelo cliente' else 'Alteração solicitada pelo cliente' end,
    case when p_response = 'aprovada' then 'O cliente aprovou a versão enviada.'
         else 'O cliente solicitou alteração: ' || coalesce(p_customer_note, '') end
  )
  returning id into v_notification_id;

  return query select v_response_id, v_notification_id, p_response;
end;
$$;

revoke all on function public.register_art_approval_response(uuid, uuid, text, text, text, text, inet, text, text[]) from public, anon, authenticated;
grant execute on function public.register_art_approval_response(uuid, uuid, text, text, text, text, inet, text, text[]) to service_role;
