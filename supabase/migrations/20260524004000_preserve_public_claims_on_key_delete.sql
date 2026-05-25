alter table public.public_key_claims
  drop constraint if exists public_key_claims_key_id_fkey;

alter table public.public_key_claims
  alter column key_id drop not null;

alter table public.public_key_claims
  add constraint public_key_claims_key_id_fkey
  foreign key (key_id)
  references public.keys(id)
  on delete set null;
