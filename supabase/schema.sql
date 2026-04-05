-- Items table
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  link text,
  price numeric,
  image_url text,
  category text,
  claimed boolean not null default false,
  claimed_at timestamptz,
  import_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists items_claimed_idx on public.items (claimed);

-- Enable Row Level Security
alter table public.items enable row level security;

-- Anon can read unclaimed items
drop policy if exists "anon read unclaimed" on public.items;
create policy "anon read unclaimed"
  on public.items
  for select
  to anon
  using (claimed = false);

-- Anon can update only to claim an unclaimed item
drop policy if exists "anon claim unclaimed" on public.items;
create policy "anon claim unclaimed"
  on public.items
  for update
  to anon
  using (claimed = false)
  with check (claimed = true);

-- Trigger prevents anon from modifying any column other than claimed/claimed_at
create or replace function public.guard_anon_item_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if (select auth.role()) = 'anon' then
    if new.name        is distinct from old.name
    or new.description is distinct from old.description
    or new.link        is distinct from old.link
    or new.price       is distinct from old.price
    or new.image_url   is distinct from old.image_url
    or new.category    is distinct from old.category
    or new.import_key  is distinct from old.import_key
    or new.id          is distinct from old.id
    or new.created_at  is distinct from old.created_at then
      raise exception 'anon can only set claimed/claimed_at';
    end if;
    if new.claimed <> true then
      raise exception 'anon can only set claimed=true';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_anon_item_update on public.items;
create trigger guard_anon_item_update
  before update on public.items
  for each row
  execute function public.guard_anon_item_update();
