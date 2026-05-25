create or replace function public.public_link_preview(p_token_hash text)
returns table (
  state text,
  message text,
  link_type text,
  access_mode text,
  title text,
  link_message text,
  max_claims integer,
  claim_count integer,
  expires_at timestamptz,
  preview_title text,
  preview_platform text,
  preview_key_mask text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.public_key_links%rowtype;
  v_preview_title text;
  v_preview_platform text;
  v_preview_key_mask text;
begin
  select * into v_link
  from public.public_key_links
  where token_hash = p_token_hash;

  if not found then
    state := 'invalid';
    message := 'Bağlantı bulunamadı.';
    return next;
    return;
  end if;

  if v_link.status <> 'active' or v_link.disabled_at is not null then
    state := 'disabled';
    message := 'Bu bağlantı kapatılmış.';
    return next;
    return;
  end if;

  if v_link.expires_at is not null and v_link.expires_at <= now() then
    state := 'expired';
    message := 'Bu bağlantının süresi dolmuş.';
    return next;
    return;
  end if;

  if v_link.claim_count >= v_link.max_claims then
    state := 'claimed';
    message := 'Bu bağlantıdaki kodlar alınmış.';
    return next;
    return;
  end if;

  if v_link.link_type = 'single' and v_link.key_id is not null then
    select k.title, k.platform, k.key_mask
    into v_preview_title, v_preview_platform, v_preview_key_mask
    from public.keys k
    where k.id = v_link.key_id and k.user_id = v_link.user_id;
  end if;

  state := 'active';
  message := 'Bağlantı hazır.';
  link_type := v_link.link_type;
  access_mode := v_link.access_mode;
  title := v_link.title;
  link_message := v_link.message;
  max_claims := v_link.max_claims;
  claim_count := v_link.claim_count;
  expires_at := v_link.expires_at;
  preview_title := v_preview_title;
  preview_platform := v_preview_platform;
  preview_key_mask := v_preview_key_mask;
  return next;
end;
$$;

create or replace function public.reserve_public_key(
  p_token_hash text,
  p_claim_token_hash text,
  p_recipient_email text,
  p_recipient_label text,
  p_ip_hash text,
  p_user_agent_hash text
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
  encryption_tag text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.public_key_links%rowtype;
  v_key public.keys%rowtype;
  v_claim_id uuid;
begin
  select * into v_link
  from public.public_key_links
  where token_hash = p_token_hash
  for update;

  if not found then
    ok := false;
    message := 'Bağlantı bulunamadı.';
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

  if v_link.link_type = 'single' then
    select * into v_key
    from public.keys k
    where k.id = v_link.key_id
      and k.user_id = v_link.user_id
      and k.status = 'available'
    for update skip locked;
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
      and k.category_id in (select id from category_scope)
    order by k.updated_at asc
    limit 1
    for update of k skip locked;
  else
    select * into v_key
    from public.keys k
    where k.user_id = v_link.user_id
      and k.status = 'available'
      and k.category_id = v_link.category_id
    order by k.updated_at asc
    limit 1
    for update skip locked;
  end if;

  if v_key.id is null then
    ok := false;
    message := 'Bu bağlantıda alınabilir kod kalmadı.';
    return next;
    return;
  end if;

  update public.keys
  set status = 'reserved'::public.key_status,
      redeemed_at = null,
      updated_at = now()
  where id = v_key.id and user_id = v_link.user_id;

  insert into public.public_key_claims (
    link_id,
    key_id,
    user_id,
    claim_token_hash,
    status,
    recipient_email,
    recipient_label,
    ip_hash,
    user_agent_hash
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
    p_user_agent_hash
  )
  returning id into v_claim_id;

  update public.public_key_links
  set claim_count = claim_count + 1,
      updated_at = now()
  where id = v_link.id;

  insert into public.audit_logs (user_id, event_type, entity_type, entity_id, ip_hash, user_agent_hash, metadata)
  values (
    v_link.user_id,
    'public_link.reserved',
    'key',
    v_key.id,
    p_ip_hash,
    p_user_agent_hash,
    jsonb_build_object('linkId', v_link.id, 'claimId', v_claim_id, 'recipientEmail', p_recipient_email, 'recipientLabel', p_recipient_label)
  );

  ok := true;
  message := 'Kod rezerve edildi.';
  link_id := v_link.id;
  claim_id := v_claim_id;
  key_id := v_key.id;
  user_id := v_link.user_id;
  key_title := v_key.title;
  platform := v_key.platform;
  encrypted_key := v_key.encrypted_key;
  encryption_iv := v_key.encryption_iv;
  encryption_tag := v_key.encryption_tag;
  return next;
end;
$$;

create or replace function public.confirm_public_redeemed(p_claim_token_hash text)
returns table (
  ok boolean,
  message text,
  link_id uuid,
  claim_id uuid,
  key_id uuid,
  user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.public_key_claims%rowtype;
  v_redeemed_at timestamptz := now();
begin
  select * into v_claim
  from public.public_key_claims
  where claim_token_hash = p_claim_token_hash
  for update;

  if not found or v_claim.status <> 'reserved' then
    ok := false;
    message := 'Aktif rezervasyon bulunamadı.';
    return next;
    return;
  end if;

  update public.keys
  set status = 'redeemed'::public.key_status,
      redeemed_at = v_redeemed_at,
      updated_at = now()
  where id = v_claim.key_id and user_id = v_claim.user_id;

  update public.public_key_claims
  set status = 'redeemed',
      redeemed_at = v_redeemed_at,
      updated_at = now()
  where id = v_claim.id;

  insert into public.audit_logs (user_id, event_type, entity_type, entity_id, ip_hash, user_agent_hash, metadata)
  values (
    v_claim.user_id,
    'public_link.redeemed',
    'key',
    v_claim.key_id,
    v_claim.ip_hash,
    v_claim.user_agent_hash,
    jsonb_build_object('linkId', v_claim.link_id, 'claimId', v_claim.id)
  );

  ok := true;
  message := 'Kod kullanıldı olarak işaretlendi.';
  link_id := v_claim.link_id;
  claim_id := v_claim.id;
  key_id := v_claim.key_id;
  user_id := v_claim.user_id;
  return next;
end;
$$;

grant execute on function public.public_link_preview(text) to anon, authenticated;
grant execute on function public.reserve_public_key(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.confirm_public_redeemed(text) to anon, authenticated;
