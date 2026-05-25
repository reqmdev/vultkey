create or replace function public.public_link_recipient_status(
  p_token_hash text,
  p_ip_hash text default null,
  p_user_agent_hash text default null,
  p_recipient_device_hash text default null,
  p_recipient_browser_hash text default null,
  p_recipient_request_hash text default null,
  p_recipient_email text default null
)
returns table (
  blocked boolean,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.public_key_links%rowtype;
  v_permissions jsonb;
  v_max_per_recipient integer;
begin
  select * into v_link
  from public.public_key_links l
  where l.token_hash = p_token_hash;

  if not found then
    blocked := false;
    message := null;
    return next;
    return;
  end if;

  v_permissions := v_link.permission_config;
  v_max_per_recipient := coalesce((v_permissions ->> 'maxClaimsPerRecipient')::integer, 1);

  if v_max_per_recipient <= 0 then
    blocked := false;
    message := null;
    return next;
    return;
  end if;

  if exists (
    select 1
    from public.public_key_claims c
    where c.link_id = v_link.id
      and c.status in ('reserved', 'redeemed')
      and (
        (p_recipient_email is not null and c.recipient_email = lower(p_recipient_email))
        or (p_recipient_device_hash is not null and c.recipient_device_hash = p_recipient_device_hash)
        or (p_recipient_browser_hash is not null and c.recipient_browser_hash = p_recipient_browser_hash)
        or (p_recipient_request_hash is not null and c.recipient_request_hash = p_recipient_request_hash)
        or (p_ip_hash is not null and c.ip_hash = p_ip_hash)
        or (p_ip_hash is not null and p_user_agent_hash is not null and c.ip_hash = p_ip_hash and c.user_agent_hash = p_user_agent_hash)
      )
    limit 1
  ) then
    blocked := true;
    message := 'Bu bağlantıdan bu cihaz veya oturum için daha önce kod alınmış.';
    return next;
    return;
  end if;

  blocked := false;
  message := null;
  return next;
end;
$$;

grant execute on function public.public_link_recipient_status(text, text, text, text, text, text, text) to anon, authenticated;
