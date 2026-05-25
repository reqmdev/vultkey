alter table public.categories
  add column parent_id uuid references public.categories(id) on delete set null;

alter table public.categories
  add constraint categories_no_self_parent check (parent_id is null or parent_id <> id);

create index categories_user_parent_sort_idx on public.categories (user_id, parent_id, sort_order, created_at);

create or replace function public.validate_category_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'category cannot be its own parent';
  end if;

  if not exists (
    select 1
    from public.categories parent
    where parent.id = new.parent_id
      and parent.user_id = new.user_id
  ) then
    raise exception 'category parent must belong to the same user';
  end if;

  if exists (
    with recursive ancestors as (
      select category.id, category.parent_id
      from public.categories category
      where category.id = new.parent_id
        and category.user_id = new.user_id

      union all

      select parent.id, parent.parent_id
      from public.categories parent
      join ancestors on parent.id = ancestors.parent_id
      where parent.user_id = new.user_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'category parent cycle is not allowed';
  end if;

  return new;
end;
$$;

create trigger categories_validate_parent
  before insert or update of parent_id, user_id on public.categories
  for each row execute function public.validate_category_parent();
