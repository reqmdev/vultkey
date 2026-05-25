with ranked_active_category_links as (
  select
    id,
    row_number() over (partition by category_id order by created_at desc) as rank
  from public.public_key_links
  where link_type = 'category'
    and status = 'active'
    and disabled_at is null
    and category_id is not null
)
update public.public_key_links l
set status = 'disabled',
    disabled_at = coalesce(l.disabled_at, now()),
    updated_at = now()
from ranked_active_category_links r
where l.id = r.id
  and r.rank > 1;

drop index if exists public.public_key_links_active_category_unique;

create unique index public_key_links_active_category_unique
on public.public_key_links (category_id)
where link_type = 'category'
  and status = 'active'
  and disabled_at is null
  and category_id is not null;

alter table public.public_key_links
  drop constraint if exists public_key_links_category_id_fkey;

alter table public.public_key_links
  add constraint public_key_links_category_id_fkey
  foreign key (category_id)
  references public.categories(id)
  on delete cascade;
