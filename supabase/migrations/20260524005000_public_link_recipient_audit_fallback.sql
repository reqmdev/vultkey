create or replace function public.public_link_recipient_claim_count(
  p_link_id uuid,
  p_user_id uuid,
  p_ip_hash text default null,
  p_user_agent_hash text default null,
  p_recipient_device_hash text default null,
  p_recipient_browser_hash text default null,
  p_recipient_request_hash text default null,
  p_recipient_email text default null
)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  with matching_claims as (
    select c.id::text as source_id
    from public.public_key_claims c
    where c.link_id = p_link_id
      and c.status in ('reserved', 'redeemed')
      and (
        (p_recipient_email is not null and c.recipient_email = lower(p_recipient_email))
        or (p_recipient_device_hash is not null and c.recipient_device_hash = p_recipient_device_hash)
        or (p_recipient_browser_hash is not null and c.recipient_browser_hash = p_recipient_browser_hash)
        or (p_recipient_request_hash is not null and c.recipient_request_hash = p_recipient_request_hash)
        or (p_ip_hash is not null and c.ip_hash = p_ip_hash)
        or (p_ip_hash is not null and p_user_agent_hash is not null and c.ip_hash = p_ip_hash and c.user_agent_hash = p_user_agent_hash)
      )
  ),
  matching_orphan_audits as (
    select a.id::text as source_id
    from public.audit_logs a
    where a.user_id = p_user_id
      and a.event_type = 'public_link.reserved'
      and a.metadata ->> 'linkId' = p_link_id::text
      and not exists (
        select 1
        from public.public_key_claims c
        where c.id::text = a.metadata ->> 'claimId'
      )
      and (
        (p_recipient_email is not null and lower(a.metadata ->> 'recipientEmail') = lower(p_recipient_email))
        or (p_ip_hash is not null and a.ip_hash = p_ip_hash)
        or (p_ip_hash is not null and p_user_agent_hash is not null and a.ip_hash = p_ip_hash and a.user_agent_hash = p_user_agent_hash)
      )
  )
  select count(*)::integer
  from (
    select source_id from matching_claims
    union all
    select source_id from matching_orphan_audits
  ) matches;
$$;

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
  v_claim_count integer;
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

  v_claim_count := public.public_link_recipient_claim_count(
    v_link.id,
    v_link.user_id,
    p_ip_hash,
    p_user_agent_hash,
    p_recipient_device_hash,
    p_recipient_browser_hash,
    p_recipient_request_hash,
    p_recipient_email
  );

  if v_claim_count >= v_max_per_recipient then
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

create or replace function public.reserve_public_key(
  p_token_hash text,
  p_claim_token_hash text,
  p_recipient_email text,
  p_recipient_label text,
  p_ip_hash text,
  p_user_agent_hash text,
  p_recipient_device_hash text default null,
  p_recipient_browser_hash text default null,
  p_recipient_request_hash text default null,
  p_key_id uuid default null
)
returns table (
  ok boolean,
  message text,
  link_id uuid,
  claim_id uuid,
  key_id uuid,
  user_id uuid,
  key_title text,
  platform text,
  encrypted_key text,
  encryption_iv text,
  encryption_tag text,
  can_reveal boolean,
  can_confirm_redeemed boolean,
  can_copy boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.public_key_links%rowtype;
  v_key public.keys%rowtype;
  v_claim_id uuid;
  v_permissions jsonb;
  v_can_reserve boolean;
  v_can_reveal boolean;
  v_can_confirm boolean;
  v_can_copy boolean;
  v_max_per_recipient integer;
begin
  select * into v_link
  from public.public_key_links l
  where l.token_hash = p_token_hash
  for update of l;

  if not found then
    ok := false;
    message := 'Bağlantı bulunamadı.';
    return next;
    return;
  end if;

  v_permissions := v_link.permission_config;
  v_can_reserve := coalesce((v_permissions ->> 'canReserve')::boolean, true);
  v_can_reveal := coalesce((v_permissions ->> 'canRevealAfterReserve')::boolean, true);
  v_can_confirm := coalesce((v_permissions ->> 'canConfirmRedeemed')::boolean, true);
  v_can_copy := coalesce((v_permissions ->> 'canCopy')::boolean, true);
  v_max_per_recipient := coalesce((v_permissions ->> 'maxClaimsPerRecipient')::integer, 1);

  if not v_can_reserve then
    ok := false;
    message := 'Bu linkte kod alma izni kapalı.';
    return next;
    return;
  end if;

  if v_link.status <> 'active' or v_link.disabled_at is not null then
    ok := false;
    message := 'Bu bağlantı artık geçerli değil.';
    return next;
    return;
  end if;

  if v_link.expires_at is not null and v_link.expires_at <= now() then
    ok := false;
    message := 'Bu bağlantının süresi dolmuş.';
    return next;
    return;
  end if;

  if v_link.claim_count >= v_link.max_claims then
    ok := false;
    message := 'Bu bağlantıdaki kodlar alınmış.';
    return next;
    return;
  end if;

  if v_link.access_mode = 'email_allowlist' then
    if p_recipient_email is null or not exists (
      select 1 from public.public_key_link_emails e
      where e.link_id = v_link.id and e.email = lower(p_recipient_email)
    ) then
      ok := false;
      message := 'Bu bağlantı için e-posta erişimi yok.';
      return next;
      return;
    end if;
  end if;

  if v_link.require_email_verification and p_recipient_email is null then
    ok := false;
    message := 'Bu link için e-posta gerekli.';
    return next;
    return;
  end if;

  if v_max_per_recipient > 0 and public.public_link_recipient_claim_count(
    v_link.id,
    v_link.user_id,
    p_ip_hash,
    p_user_agent_hash,
    p_recipient_device_hash,
    p_recipient_browser_hash,
    p_recipient_request_hash,
    p_recipient_email
  ) >= v_max_per_recipient then
    ok := false;
    message := 'Bu bağlantıdan bu cihaz veya oturum için daha önce kod alınmış.';
    return next;
    return;
  end if;

  if v_link.link_type = 'single' then
    select k.* into v_key
    from public.keys k
    where k.id = v_link.key_id
      and k.user_id = v_link.user_id
      and k.status = 'available'
    for update of k skip locked;
  elsif p_key_id is not null then
    with recursive category_scope(id) as (
      select v_link.category_id
      union all
      select c.id
      from public.categories c
      join category_scope s on c.parent_id = s.id
      where c.user_id = v_link.user_id and v_link.include_subcategories
    )
    select k.* into v_key
    from public.keys k
    where k.id = p_key_id
      and k.user_id = v_link.user_id
      and k.status = 'available'
      and k.category_id in (select s.id from category_scope s)
    for update of k skip locked;
  elsif v_link.include_subcategories then
    with recursive category_scope(id) as (
      select v_link.category_id
      union all
      select c.id
      from public.categories c
      join category_scope s on c.parent_id = s.id
      where c.user_id = v_link.user_id
    )
    select k.* into v_key
    from public.keys k
    where k.user_id = v_link.user_id
      and k.status = 'available'
      and k.category_id in (select s.id from category_scope s)
    order by k.updated_at asc
    limit 1
    for update of k skip locked;
  else
    select k.* into v_key
    from public.keys k
    where k.user_id = v_link.user_id
      and k.status = 'available'
      and k.category_id = v_link.category_id
    order by k.updated_at asc
    limit 1
    for update of k skip locked;
  end if;

  if v_key.id is null then
    ok := false;
    message := 'Bu bağlantıda alınabilir kod kalmadı.';
    return next;
    return;
  end if;

  update public.keys k
  set status = 'reserved'::public.key_status,
      redeemed_at = null,
      updated_at = now()
  where k.id = v_key.id and k.user_id = v_link.user_id;

  insert into public.public_key_claims (
    link_id,
    key_id,
    user_id,
    claim_token_hash,
    status,
    recipient_email,
    recipient_label,
    ip_hash,
    user_agent_hash,
    recipient_device_hash,
    recipient_browser_hash,
    recipient_request_hash
  )
  values (
    v_link.id,
    v_key.id,
    v_link.user_id,
    p_claim_token_hash,
    'reserved',
    nullif(lower(coalesce(p_recipient_email, '')), ''),
    nullif(p_recipient_label, ''),
    p_ip_hash,
    p_user_agent_hash,
    p_recipient_device_hash,
    p_recipient_browser_hash,
    p_recipient_request_hash
  )
  returning public_key_claims.id into v_claim_id;

  update public.public_key_links l
  set claim_count = l.claim_count + 1,
      updated_at = now()
  where l.id = v_link.id;

  insert into public.audit_logs (user_id, event_type, entity_type, entity_id, ip_hash, user_agent_hash, metadata)
  values (
    v_link.user_id,
    'public_link.reserved',
    'key',
    v_key.id,
    p_ip_hash,
    p_user_agent_hash,
    jsonb_build_object('linkId', v_link.id, 'claimId', v_claim_id, 'recipientEmail', p_recipient_email, 'recipientLabel', p_recipient_label, 'viewMode', v_link.view_mode)
  );

  ok := true;
  message := case when v_can_reveal then 'Kod alındı ve sana ayrıldı.' else 'Kod sana ayrıldı.' end;
  link_id := v_link.id;
  claim_id := v_claim_id;
  key_id := v_key.id;
  user_id := v_link.user_id;
  key_title := v_key.title;
  platform := v_key.platform;
  encrypted_key := case when v_can_reveal then v_key.encrypted_key else null end;
  encryption_iv := case when v_can_reveal then v_key.encryption_iv else null end;
  encryption_tag := case when v_can_reveal then v_key.encryption_tag else null end;
  can_reveal := v_can_reveal;
  can_confirm_redeemed := v_can_confirm;
  can_copy := v_can_copy;
  return next;
end;
$$;

grant execute on function public.reserve_public_key(text, text, text, text, text, text, text, text, text, uuid) to anon, authenticated;
