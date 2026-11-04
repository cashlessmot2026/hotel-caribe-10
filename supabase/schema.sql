-- =====================================================================
--  Apartahotel Caribe Diez — esquema Supabase
--  Ejecutar completo en: Supabase > SQL Editor > New query > Run
--  Es seguro ejecutarlo varias veces.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tablas ----------
create table if not exists public.settings (
  id                 int primary key default 1 check (id = 1),
  hotel              jsonb not null default '{}'::jsonb,
  restaurant_enabled boolean not null default false,
  restaurant_title   text not null default 'Restaurante',
  updated_at         timestamptz not null default now()
);

create table if not exists public.rooms (
  id          text primary key,
  position    int not null default 0,
  name        text not null,
  price       numeric not null default 0,
  capacity    int not null default 2,
  beds        text,
  size        text,
  rating      numeric,
  available   boolean not null default true,
  details     jsonb not null default '[]'::jsonb,   -- ["Aire acondicionado", ...]
  description text,
  images      jsonb not null default '[]'::jsonb,   -- ["https://...jpg", ...] sin límite
  updated_at  timestamptz not null default now()
);

-- Campos adicionales de la tarjeta (etiqueta, precio anterior, unidad, ubicación, texto del botón…)
alter table public.rooms add column if not exists extra jsonb not null default '{}'::jsonb;

create table if not exists public.payments (
  id       text primary key,
  position int not null default 0,
  name     text not null,
  details  text,
  enabled  boolean not null default true
);

create table if not exists public.menu_items (
  id       text primary key,
  position int not null default 0,
  name     text not null,
  price    numeric not null default 0,
  category text
);

-- Clave del admin (hash). Nadie puede leer esta tabla desde la web.
create table if not exists public.admin_secret (
  id       int primary key default 1 check (id = 1),
  pin_hash text not null
);
insert into public.admin_secret (id, pin_hash)
values (1, extensions.crypt('1234', extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- ---------- Seguridad (RLS) ----------
alter table public.settings     enable row level security;
alter table public.rooms        enable row level security;
alter table public.payments     enable row level security;
alter table public.menu_items   enable row level security;
alter table public.admin_secret enable row level security;

-- Lectura pública (la web la necesita). Escritura SOLO vía funciones con clave.
drop policy if exists "lectura publica" on public.settings;
drop policy if exists "lectura publica" on public.rooms;
drop policy if exists "lectura publica" on public.payments;
drop policy if exists "lectura publica" on public.menu_items;
create policy "lectura publica" on public.settings   for select using (true);
create policy "lectura publica" on public.rooms      for select using (true);
create policy "lectura publica" on public.payments   for select using (true);
create policy "lectura publica" on public.menu_items for select using (true);
revoke all on public.admin_secret from anon, authenticated;

-- ---------- Funciones del admin ----------
create or replace function public.admin_check(p_pin text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (select 1 from admin_secret where id = 1 and pin_hash = crypt(p_pin, pin_hash));
$$;

create or replace function public.admin_set_pin(p_old text, p_new text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not admin_check(p_old) then raise exception 'Clave incorrecta'; end if;
  if length(coalesce(p_new, '')) < 4 then raise exception 'La clave debe tener mínimo 4 caracteres'; end if;
  update admin_secret set pin_hash = crypt(p_new, gen_salt('bf')) where id = 1;
end;
$$;

-- Guarda TODO el contenido de la web de una vez (lo llama el dashboard)
create or replace function public.admin_save(p_pin text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not admin_check(p_pin) then raise exception 'Clave incorrecta'; end if;

  insert into settings (id, hotel, restaurant_enabled, restaurant_title, updated_at)
  values (
    1,
    coalesce(p_data->'hotel', '{}'::jsonb),
    coalesce((p_data->'restaurant'->>'enabled')::boolean, false),
    coalesce(p_data->'restaurant'->>'title', 'Restaurante'),
    now()
  )
  on conflict (id) do update set
    hotel = excluded.hotel,
    restaurant_enabled = excluded.restaurant_enabled,
    restaurant_title = excluded.restaurant_title,
    updated_at = now();

  delete from rooms where true;
  insert into rooms (id, position, name, price, capacity, beds, size, rating, available, details, description, images, extra)
  select
    coalesce(nullif(r->>'id', ''), gen_random_uuid()::text),
    (o - 1)::int,
    coalesce(r->>'name', 'Habitación'),
    coalesce(nullif(r->>'price', '')::numeric, 0),
    coalesce(nullif(r->>'capacity', '')::int, 1),
    r->>'beds',
    r->>'size',
    nullif(r->>'rating', '')::numeric,
    coalesce((r->>'available')::boolean, true),
    coalesce(r->'details', '[]'::jsonb),
    r->>'description',
    coalesce(r->'images', '[]'::jsonb),
    -- todo lo que no tiene columna propia se guarda aquí
    r - array['id', 'position', 'name', 'price', 'capacity', 'beds', 'size', 'rating', 'available', 'details', 'description', 'images', 'extra', 'updated_at']
  from jsonb_array_elements(coalesce(p_data->'rooms', '[]'::jsonb)) with ordinality as t(r, o);

  delete from payments where true;
  insert into payments (id, position, name, details, enabled)
  select
    coalesce(nullif(p->>'id', ''), gen_random_uuid()::text),
    (o - 1)::int,
    coalesce(p->>'name', ''),
    p->>'details',
    coalesce((p->>'enabled')::boolean, true)
  from jsonb_array_elements(coalesce(p_data->'payments', '[]'::jsonb)) with ordinality as t(p, o);

  delete from menu_items where true;
  insert into menu_items (id, position, name, price, category)
  select
    coalesce(nullif(m->>'id', ''), gen_random_uuid()::text),
    (o - 1)::int,
    coalesce(m->>'name', ''),
    coalesce(nullif(m->>'price', '')::numeric, 0),
    m->>'category'
  from jsonb_array_elements(coalesce(p_data->'restaurant'->'items', '[]'::jsonb)) with ordinality as t(m, o);
end;
$$;

revoke all on function public.admin_check(text) from public;
revoke all on function public.admin_set_pin(text, text) from public;
revoke all on function public.admin_save(text, jsonb) from public;
grant execute on function public.admin_check(text) to anon, authenticated;
grant execute on function public.admin_set_pin(text, text) to anon, authenticated;
grant execute on function public.admin_save(text, jsonb) to anon, authenticated;

-- ---------- Storage para las imágenes ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hotel', 'hotel', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "hotel lectura publica" on storage.objects;
drop policy if exists "hotel subir imagenes" on storage.objects;
create policy "hotel lectura publica" on storage.objects
  for select using (bucket_id = 'hotel');
create policy "hotel subir imagenes" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'hotel' and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp'));
