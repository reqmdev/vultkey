-- Production security hardening for public-link and audit flows.

update public.profiles p
set email = coalesce(u.email, ''),
    updated_at = now()
from auth.users u
where p.id = u.id
  and p.email is distinct from coalesce(u.email, '');

create or replace function public.prevent_profile_email_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'profile email is managed by auth';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_email_change on public.profiles;
create trigger profiles_prevent_email_change
  before update of email on public.profiles
  for each row execute function public.prevent_profile_email_change();

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_new_user();

drop policy if exists "public_key_links_update_own" on public.public_key_links;
create policy "public_key_links_update_own" on public.public_key_links
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (
      (
        link_type = 'single'
        and key_id is not null
        and category_id is null
        and exists (select 1 from public.keys k where k.id = key_id and k.user_id = auth.uid())
      )
      or (
        link_type = 'category'
        and key_id is null
        and category_id is not null
        and exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
      )
    )
  );

drop policy if exists "audit_logs_insert_own" on public.audit_logs;

alter table public.public_key_claims
  drop constraint if exists public_key_claims_link_id_fkey;

alter table public.public_key_claims
  alter column link_id drop not null;

alter table public.public_key_claims
  add constraint public_key_claims_link_id_fkey
  foreign key (link_id)
  references public.public_key_links(id)
  on delete set null;

drop function if exists public.reserve_public_key(text, text, text, text, text, text);
drop function if exists public.reserve_public_key(text, text, text, text, text, text, uuid);
drop function if exists public.reserve_public_key(text, text, text, text, text, text, text, text, text, uuid);

revoke execute on function public.public_link_recipient_claim_count(uuid, uuid, text, text, text, text, text, text, uuid) from public, anon, authenticated;

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

  if v_user_id is not null then
    select p.email into v_email from public.profiles p where p.id = v_user_id;
  end if;

  if not found then
    requires_login := false;
    allowed := false;
    member_email := v_email;
    return next;
    return;
  end if;

  if v_link.access_mode not in ('email_allowlist', 'member_allowlist') and not v_link.require_email_verification then
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

  requires_login := false;

  if v_link.access_mode = 'member_allowlist' then
    allowed := exists (
      select 1
      from public.public_key_link_emails e
      where e.link_id = v_link.id
        and e.recipient_user_id = v_user_id
    );
  elsif v_link.access_mode = 'email_allowlist' then
    allowed := v_email is not null and exists (
      select 1
      from public.public_key_link_emails e
      where e.link_id = v_link.id
        and lower(e.email) = lower(v_email)
    );
  else
    allowed := true;
  end if;

  member_email := v_email;
  return next;
end;
$$;

grant execute on function public.public_link_member_status(text) to anon, authenticated;

create or replace function public.public_link_preview(p_token_hash text)
returns table (
  state text,
  message text,
  link_type text,
  view_mode text,
  access_mode text,
  require_email_verification boolean,
  title text,
  link_message text,
  max_claims integer,
  claim_count integer,
  expires_at timestamptz,
  visibility_config jsonb,
  permission_config jsonb,
  preview_title text,
  preview_platform text,
  preview_key_mask text,
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.public_key_links%rowtype;
  v_visibility jsonb;
  v_permissions jsonb;
  v_show_unavailable boolean;
  v_can_view_list boolean;
  v_user_id uuid := auth.uid();
  v_email text;
  v_access_allowed boolean := false;
begin
  select * into v_link
  from public.public_key_links l
  where l.token_hash = p_token_hash;

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

  if v_user_id is not null then
    select p.email into v_email from public.profiles p where p.id = v_user_id;
  end if;

  if v_link.access_mode = 'member_allowlist' then
    v_access_allowed := exists (
      select 1
      from public.public_key_link_emails e
      where e.link_id = v_link.id
        and e.recipient_user_id = v_user_id
    );
  elsif v_link.access_mode = 'email_allowlist' then
    v_access_allowed := v_email is not null and exists (
      select 1
      from public.public_key_link_emails e
      where e.link_id = v_link.id
        and lower(e.email) = lower(v_email)
    );
  elsif v_link.require_email_verification then
    v_access_allowed := v_user_id is not null;
  else
    v_access_allowed := true;
  end if;

  v_visibility := v_link.visibility_config;
  v_permissions := v_link.permission_config;
  v_show_unavailable := coalesce((v_permissions ->> 'showUnavailable')::boolean, false);
  v_can_view_list := coalesce((v_permissions ->> 'canViewList')::boolean, true);

  with recursive category_scope(id) as (
    select v_link.category_id
    where v_link.link_type = 'category' and v_link.category_id is not null
    union all
    select c.id
    from public.categories c
    join category_scope s on c.parent_id = s.id
    where c.user_id = v_link.user_id and v_link.include_subcategories
  ), scoped_keys as (
    select k.*, c.name as category_name
    from public.keys k
    left join public.categories c on c.id = k.category_id and c.user_id = k.user_id
    where v_access_allowed
      and (v_link.view_mode <> 'list' or v_can_view_list)
      and k.user_id = v_link.user_id
      and (
        (v_link.link_type = 'single' and k.id = v_link.key_id)
        or (v_link.link_type = 'category' and k.category_id in (select s.id from category_scope s))
      )
      and (v_show_unavailable or k.status = 'available')
    order by k.status = 'available' desc, k.updated_at asc
    limit case when v_link.view_mode = 'list' and v_can_view_list then 200 else 1 end
  ), key_tags_json as (
    select kt.key_id, jsonb_agg(t.name order by t.name) as tags
    from public.key_tags kt
    join public.tags t on t.id = kt.tag_id and t.user_id = kt.user_id
    where kt.user_id = v_link.user_id
      and kt.key_id in (select id from scoped_keys)
    group by kt.key_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', k.id,
        'available', k.status = 'available',
        'title', case when coalesce((v_visibility ->> 'showTitle')::boolean, true) then k.title else null end,
        'platform', case when coalesce((v_visibility ->> 'showPlatform')::boolean, true) then k.platform else null end,
        'keyMask', case when coalesce((v_visibility ->> 'showMask')::boolean, true) then k.key_mask else null end,
        'category', case when coalesce((v_visibility ->> 'showCategory')::boolean, true) then k.category_name else null end,
        'tags', case when coalesce((v_visibility ->> 'showTags')::boolean, true) then coalesce(kt.tags, '[]'::jsonb) else '[]'::jsonb end,
        'status', case when coalesce((v_visibility ->> 'showStatus')::boolean, true) then k.status::text else null end,
        'expiresAt', case when coalesce((v_visibility ->> 'showExpiresAt')::boolean, true) then k.expires_at else null end,
        'notes', case when coalesce((v_visibility ->> 'showNotes')::boolean, false) then k.notes else null end,
        'source', case when coalesce((v_visibility ->> 'showSource')::boolean, false) then k.source else null end
      )
      order by k.status = 'available' desc, k.updated_at asc
    ),
    '[]'::jsonb
  ) into items
  from scoped_keys k
  left join key_tags_json kt on kt.key_id = k.id;

  select
    item ->> 'title',
    item ->> 'platform',
    item ->> 'keyMask'
  into preview_title, preview_platform, preview_key_mask
  from jsonb_array_elements(items) item
  limit 1;

  state := 'active';
  message := 'Bağlantı hazır.';
  link_type := v_link.link_type;
  view_mode := v_link.view_mode;
  access_mode := v_link.access_mode;
  require_email_verification := v_link.require_email_verification;
  title := case when v_access_allowed then v_link.title else null end;
  link_message := case when v_access_allowed then v_link.message else null end;
  max_claims := v_link.max_claims;
  claim_count := v_link.claim_count;
  expires_at := v_link.expires_at;
  visibility_config := v_visibility;
  permission_config := v_permissions;
  return next;
end;
$$;

grant execute on function public.public_link_preview(text) to anon, authenticated;

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
  v_effective_recipient_email text := nullif(lower(coalesce(p_recipient_email, '')), '');
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
    if v_recipient_user_id is null or v_recipient_member_email is null then
      ok := false;
      message := 'Bu bağlantı için allowlist e-postasıyla Vultkey hesabına giriş yapmak gerekli.';
      return next;
      return;
    end if;

    v_effective_recipient_email := lower(v_recipient_member_email);

    if not exists (
      select 1 from public.public_key_link_emails e
      where e.link_id = v_link.id and lower(e.email) = v_effective_recipient_email
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
        and e.recipient_user_id = v_recipient_user_id
    ) then
      ok := false;
      message := 'Bu Vultkey hesabının bu bağlantıya erişimi yok.';
      return next;
      return;
    end if;
  end if;

  if v_link.require_email_verification then
    if v_recipient_user_id is null or v_recipient_member_email is null then
      ok := false;
      message := 'Bu link için doğrulanmış Vultkey e-postası gerekli.';
      return next;
      return;
    end if;

    v_effective_recipient_email := lower(v_recipient_member_email);
  end if;

  if v_max_per_recipient > 0 and public.public_link_recipient_claim_count(
    v_link.id,
    v_link.user_id,
    p_ip_hash,
    p_user_agent_hash,
    p_recipient_device_hash,
    p_recipient_browser_hash,
    p_recipient_request_hash,
    v_effective_recipient_email,
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
    v_effective_recipient_email,
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
      'recipientEmail', v_effective_recipient_email,
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
  v_link public.public_key_links%rowtype;
  v_redeemed_at timestamptz := now();
  v_can_confirm boolean;
begin
  select * into v_claim
  from public.public_key_claims c
  where c.claim_token_hash = p_claim_token_hash
  for update of c;

  if not found or v_claim.status <> 'reserved' then
    ok := false;
    message := 'Aktif rezervasyon bulunamadı.';
    return next;
    return;
  end if;

  select * into v_link
  from public.public_key_links l
  where l.id = v_claim.link_id;

  if not found or v_link.status <> 'active' or v_link.disabled_at is not null or (v_link.expires_at is not null and v_link.expires_at <= now()) then
    ok := false;
    message := 'Bu bağlantıda kullanım onayı artık geçerli değil.';
    return next;
    return;
  end if;

  v_can_confirm := coalesce((v_link.permission_config ->> 'canConfirmRedeemed')::boolean, true);

  if not v_can_confirm then
    ok := false;
    message := 'Bu bağlantıda kullanım onayı kapalı.';
    return next;
    return;
  end if;

  update public.keys k
  set status = 'redeemed'::public.key_status,
      redeemed_at = v_redeemed_at,
      updated_at = now()
  where v_claim.key_id is not null
    and k.id = v_claim.key_id
    and k.user_id = v_claim.user_id;

  update public.public_key_claims c
  set status = 'redeemed',
      redeemed_at = v_redeemed_at,
      updated_at = now()
  where c.id = v_claim.id;

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

grant execute on function public.confirm_public_redeemed(text) to anon, authenticated;
