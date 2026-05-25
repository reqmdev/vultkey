create table public.public_key_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_id uuid references public.keys(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  link_type text not null default 'single' check (link_type in ('single', 'category')),
  access_mode text not null default 'anyone' check (access_mode in ('anyone', 'email_allowlist')),
  token_hash text not null unique check (char_length(token_hash) = 64),
  token_ciphertext text not null,
  token_iv text not null,
  token_tag text not null,
  title text check (title is null or char_length(title) <= 120),
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'active' check (status in ('active', 'disabled')),
  expires_at timestamptz,
  max_claims integer not null default 1 check (max_claims between 1 and 1000),
  claim_count integer not null default 0 check (claim_count >= 0),
  include_subcategories boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_key_links_target_check check (
    (link_type = 'single' and key_id is not null and category_id is null and max_claims = 1)
    or (link_type = 'category' and key_id is null and category_id is not null)
  )
);

create index public_key_links_user_created_idx on public.public_key_links (user_id, created_at desc);
create index public_key_links_user_status_idx on public.public_key_links (user_id, status, created_at desc);
create index public_key_links_key_idx on public.public_key_links (key_id) where key_id is not null;
create index public_key_links_category_idx on public.public_key_links (category_id) where category_id is not null;
create unique index public_key_links_active_key_unique on public.public_key_links (key_id)
  where link_type = 'single' and status = 'active' and disabled_at is null;

create table public.public_key_link_emails (
  link_id uuid not null references public.public_key_links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  created_at timestamptz not null default now(),
  primary key (link_id, email)
);

create index public_key_link_emails_user_idx on public.public_key_link_emails (user_id);
create index public_key_link_emails_email_idx on public.public_key_link_emails (email);

create table public.public_key_claims (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.public_key_links(id) on delete cascade,
  key_id uuid not null references public.keys(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_token_hash text not null unique check (char_length(claim_token_hash) = 64),
  status text not null default 'reserved' check (status in ('reserved', 'redeemed', 'cancelled')),
  recipient_email text check (recipient_email is null or char_length(recipient_email) <= 254),
  recipient_label text check (recipient_label is null or char_length(recipient_label) <= 80),
  ip_hash text,
  user_agent_hash text,
  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index public_key_claims_user_created_idx on public.public_key_claims (user_id, created_at desc);
create index public_key_claims_link_idx on public.public_key_claims (link_id, created_at desc);
create index public_key_claims_key_idx on public.public_key_claims (key_id, created_at desc);

create trigger public_key_links_set_updated_at before update on public.public_key_links for each row execute function public.set_updated_at();
create trigger public_key_claims_set_updated_at before update on public.public_key_claims for each row execute function public.set_updated_at();

alter table public.public_key_links enable row level security;
alter table public.public_key_link_emails enable row level security;
alter table public.public_key_claims enable row level security;

create policy "public_key_links_select_own" on public.public_key_links
  for select using (user_id = auth.uid());

create policy "public_key_links_insert_own" on public.public_key_links
  for insert with check (
    user_id = auth.uid()
    and (
      (link_type = 'single' and exists (select 1 from public.keys k where k.id = key_id and k.user_id = auth.uid()))
      or (link_type = 'category' and exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid()))
    )
  );

create policy "public_key_links_update_own" on public.public_key_links
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "public_key_links_delete_own" on public.public_key_links
  for delete using (user_id = auth.uid());

create policy "public_key_link_emails_select_own" on public.public_key_link_emails
  for select using (user_id = auth.uid());

create policy "public_key_link_emails_insert_own" on public.public_key_link_emails
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.public_key_links l where l.id = link_id and l.user_id = auth.uid())
  );

create policy "public_key_link_emails_delete_own" on public.public_key_link_emails
  for delete using (user_id = auth.uid());

create policy "public_key_claims_select_own" on public.public_key_claims
  for select using (user_id = auth.uid());
