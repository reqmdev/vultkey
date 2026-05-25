create extension if not exists pgcrypto with schema extensions;

create type public.key_status as enum ('available', 'reserved', 'redeemed', 'archived');
create type public.category_color as enum ('slate', 'violet', 'blue', 'emerald', 'amber', 'rose', 'cyan');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color public.category_color not null default 'slate',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_user_name_unique on public.categories (user_id, lower(name));
create index categories_user_sort_idx on public.categories (user_id, sort_order, created_at);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tags_user_name_unique on public.tags (user_id, lower(name));
create index tags_user_created_idx on public.tags (user_id, created_at desc);

create table public.keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  platform text not null default 'Steam' check (char_length(platform) between 1 and 60),
  status public.key_status not null default 'available',
  encrypted_key text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  key_hash text not null check (char_length(key_hash) = 64),
  key_mask text not null check (char_length(key_mask) between 1 and 80),
  source text check (source is null or char_length(source) <= 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint keys_user_hash_unique unique (user_id, key_hash)
);

create index keys_user_status_idx on public.keys (user_id, status, updated_at desc);
create index keys_user_category_idx on public.keys (user_id, category_id);
create index keys_user_updated_idx on public.keys (user_id, updated_at desc);

create table public.key_tags (
  key_id uuid not null references public.keys(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (key_id, tag_id)
);

create index key_tags_user_idx on public.key_tags (user_id);
create index key_tags_tag_idx on public.key_tags (tag_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 3 and 80),
  entity_type text check (entity_type is null or char_length(entity_type) <= 60),
  entity_id uuid,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_user_created_idx on public.audit_logs (user_id, created_at desc);
create index audit_logs_user_event_idx on public.audit_logs (user_id, event_type, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger tags_set_updated_at before update on public.tags for each row execute function public.set_updated_at();
create trigger keys_set_updated_at before update on public.keys for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email, updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.keys enable row level security;
alter table public.key_tags enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "categories_select_own" on public.categories
  for select using (user_id = auth.uid());

create policy "categories_insert_own" on public.categories
  for insert with check (user_id = auth.uid());

create policy "categories_update_own" on public.categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories_delete_own" on public.categories
  for delete using (user_id = auth.uid());

create policy "tags_select_own" on public.tags
  for select using (user_id = auth.uid());

create policy "tags_insert_own" on public.tags
  for insert with check (user_id = auth.uid());

create policy "tags_update_own" on public.tags
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "tags_delete_own" on public.tags
  for delete using (user_id = auth.uid());

create policy "keys_select_own" on public.keys
  for select using (user_id = auth.uid());

create policy "keys_insert_own" on public.keys
  for insert with check (
    user_id = auth.uid()
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );

create policy "keys_update_own" on public.keys
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );

create policy "keys_delete_own" on public.keys
  for delete using (user_id = auth.uid());

create policy "key_tags_select_own" on public.key_tags
  for select using (user_id = auth.uid());

create policy "key_tags_insert_own" on public.key_tags
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.keys k where k.id = key_id and k.user_id = auth.uid())
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = auth.uid())
  );

create policy "key_tags_delete_own" on public.key_tags
  for delete using (user_id = auth.uid());

create policy "audit_logs_select_own" on public.audit_logs
  for select using (user_id = auth.uid());

create policy "audit_logs_insert_own" on public.audit_logs
  for insert with check (user_id = auth.uid());
