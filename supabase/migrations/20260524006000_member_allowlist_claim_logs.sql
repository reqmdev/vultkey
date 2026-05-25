alter table public.public_key_links
  drop constraint if exists public_key_links_access_mode_check;

alter table public.public_key_links
  add constraint public_key_links_access_mode_check
  check (access_mode in ('anyone', 'email_allowlist', 'member_allowlist'));

alter table public.public_key_link_emails
  add column if not exists recipient_user_id uuid references public.profiles(id) on delete cascade;

create index if not exists public_key_link_emails_recipient_user_idx
on public.public_key_link_emails (recipient_user_id)
where recipient_user_id is not null;

alter table public.public_key_claims
  add column if not exists recipient_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists recipient_member_email text,
  add column if not exists country_code text,
  add column if not exists device_type text,
  add column if not exists os_name text,
  add column if not exists os_version text,
  add column if not exists browser_name text,
  add column if not exists browser_version text,
  add column if not exists client_platform text,
  add column if not exists timezone text,
  add column if not exists language text,
  add column if not exists key_title_snapshot text,
  add column if not exists platform_snapshot text,
  add column if not exists key_mask_snapshot text;

create index if not exists public_key_claims_link_recipient_user_idx
on public.public_key_claims (link_id, recipient_user_id)
where recipient_user_id is not null
  and status in ('reserved', 'redeemed');

create or replace function public.public_link_member_status(p_token_hash text)
returns table (
  requires_login boolean,
  allowed boolean,
  member_email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.public_key_links%rowtype;
  v_user_id uuid := auth.uid();
  v_email text;
begin
  select * into v_link
  from public.public_key_links l
  where l.token_hash = p_token_hash;

  if not found or v_link.access_mode <> 'member_allowlist' then
    if v_user_id is not null then
      select p.email into v_email from public.profiles p where p.id = v_user_id;
    end if;

    requires_login := false;
    allowed := true;
    member_email := v_email;
    return next;
    return;
  end if;

  if v_user_id is null then
    requires_login := true;
    allowed := false;
    member_email := null;
    return next;
    return;
  end if;

  select p.email into v_email
  from public.profiles p
  where p.id = v_user_id;

  requires_login := false;
  allowed := exists (
    select 1
    from public.public_key_link_emails e
    where e.link_id = v_link.id
      and (
        e.recipient_user_id = v_user_id
        or (v_email is not null and lower(e.email) = lower(v_email))
      )
  );
  member_email := v_email;
  return next;
end;
$$;

grant execute on function public.public_link_member_status(text) to anon, authenticated;

drop function if exists public.public_link_recipient_claim_count(uuid, uuid, text, text, text, text, text, text);

create or replace function public.public_link_recipient_claim_count(
  p_link_id uuid,
  p_user_id uuid,
  p_ip_hash text default null,
  p_user_agent_hash text default null,
  p_recipient_device_hash text default null,
  p_recipient_browser_hash text default null,
  p_recipient_request_hash text default null,
  p_recipient_email text default null,
  p_recipient_user_id uuid default null
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
        (p_recipient_user_id is not null and c.recipient_user_id = p_recipient_user_id)
        or (p_recipient_email is not null and c.recipient_email = lower(p_recipient_email))
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
        (p_recipient_user_id is not null and a.metadata ->> 'recipientUserId' = p_recipient_user_id::text)
        or (p_recipient_email is not null and lower(a.metadata ->> 'recipientEmail') = lower(p_recipient_email))
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
  v_recipient_user_id uuid := auth.uid();
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
    p_recipient_email,
    v_recipient_user_id
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

drop function if exists public.reserve_public_key(text, text, text, text, text, text, text, text, text, uuid);

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
  p_key_id uuid default null,
  p_country_code text default null,
  p_device_type text default null,
  p_os_name text default null,
  p_os_version text default null,
  p_browser_name text default null,
  p_browser_version text default null,
  p_client_platform text default null,
  p_timezone text default null,
  p_language text default null
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
  v_recipient_user_id uuid := auth.uid();
  v_recipient_member_email text;
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

  if v_recipient_user_id is not null then
    select p.email into v_recipient_member_email
    from public.profiles p
    where p.id = v_recipient_user_id;
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

  if v_link.access_mode = 'member_allowlist' then
    if v_recipient_user_id is null then
      ok := false;
      message := 'Bu bağlantı için Vultkey hesabıyla giriş yapmak gerekli.';
      return next;
      return;
    end if;

    if not exists (
      select 1 from public.public_key_link_emails e
      where e.link_id = v_link.id
        and (
          e.recipient_user_id = v_recipient_user_id
          or (v_recipient_member_email is not null and lower(e.email) = lower(v_recipient_member_email))
        )
    ) then
      ok := false;
      message := 'Bu Vultkey hesabının bu bağlantıya erişimi yok.';
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
    p_recipient_email,
    v_recipient_user_id
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
    recipient_request_hash,
    recipient_user_id,
    recipient_member_email,
    country_code,
    device_type,
    os_name,
    os_version,
    browser_name,
    browser_version,
    client_platform,
    timezone,
    language,
    key_title_snapshot,
    platform_snapshot,
    key_mask_snapshot
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
    p_recipient_request_hash,
    v_recipient_user_id,
    nullif(lower(coalesce(v_recipient_member_email, '')), ''),
    nullif(upper(left(coalesce(p_country_code, ''), 2)), ''),
    nullif(left(coalesce(p_device_type, ''), 20), ''),
    nullif(left(coalesce(p_os_name, ''), 60), ''),
    nullif(left(coalesce(p_os_version, ''), 40), ''),
    nullif(left(coalesce(p_browser_name, ''), 60), ''),
    nullif(left(coalesce(p_browser_version, ''), 40), ''),
    nullif(left(coalesce(p_client_platform, ''), 120), ''),
    nullif(left(coalesce(p_timezone, ''), 80), ''),
    nullif(left(coalesce(p_language, ''), 80), ''),
    v_key.title,
    v_key.platform,
    v_key.key_mask
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
    jsonb_build_object(
      'linkId', v_link.id,
      'claimId', v_claim_id,
      'recipientEmail', p_recipient_email,
      'recipientLabel', p_recipient_label,
      'recipientUserId', v_recipient_user_id,
      'recipientMemberEmail', v_recipient_member_email,
      'countryCode', p_country_code,
      'deviceType', p_device_type,
      'osName', p_os_name,
      'browserName', p_browser_name,
      'viewMode', v_link.view_mode
    )
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

grant execute on function public.reserve_public_key(text, text, text, text, text, text, text, text, text, uuid, text, text, text, text, text, text, text, text, text) to anon, authenticated;
