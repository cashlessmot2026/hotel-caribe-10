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

-- Datos del restaurante (fotos, teléfonos, dirección, horario… del lugar fuera del hotel)
alter table public.settings add column if not exists restaurant jsonb not null default '{}'::jsonb;

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

  insert into settings (id, hotel, restaurant_enabled, restaurant_title, restaurant, updated_at)
  values (
    1,
    coalesce(p_data->'hotel', '{}'::jsonb),
    coalesce((p_data->'restaurant'->>'enabled')::boolean, false),
    coalesce(p_data->'restaurant'->>'title', 'Restaurante'),
    coalesce(p_data->'restaurant', '{}'::jsonb) - 'items' - 'enabled' - 'title',
    now()
  )
  on conflict (id) do update set
    hotel = excluded.hotel,
    restaurant_enabled = excluded.restaurant_enabled,
    restaurant_title = excluded.restaurant_title,
    restaurant = excluded.restaurant,
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

-- =====================================================================
--  RESERVAS
--  - La web registra cada solicitud con create_booking() (sin clave).
--  - Nadie puede leer las reservas desde la web: solo el admin con su clave.
-- =====================================================================
create sequence if not exists public.booking_seq start 1001;

create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,                    -- CD-1001
  status         text not null default 'pendiente'
                 check (status in ('pendiente', 'confirmada', 'checkin', 'checkout', 'cancelada', 'no_show')),
  hidden         boolean not null default false,          -- ocultas / archivadas
  source         text not null default 'web',             -- web | admin
  room_id        text,
  room_name      text,
  check_in       date not null,
  check_out      date,
  guests         int not null default 1,
  guest_name     text,
  guest_phone    text,                                    -- solo dígitos, con indicativo (57…)
  guest_email    text,
  guest_doc      text,                                    -- cédula / pasaporte
  guest_origin   text,                                    -- ciudad / país
  price_night    numeric not null default 0,
  extras         jsonb not null default '[]'::jsonb,      -- [{id,name,price,unit:'noche'|'estadia',qty}]
  discount       numeric not null default 0,
  total          numeric not null default 0,
  paid           numeric not null default 0,              -- abonos recibidos
  payment_method text,
  note           text,                                    -- petición del cliente
  admin_note     text,                                    -- notas internas
  cancel_reason  text,
  history        jsonb not null default '[]'::jsonb,      -- [{at,text}]
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists bookings_check_in_idx on public.bookings (check_in);
create index if not exists bookings_status_idx on public.bookings (status);

alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
revoke all on sequence public.booking_seq from anon, authenticated;

-- Adicionales por defecto (solo si el admin aún no los ha creado)
update public.settings
set hotel = jsonb_set(hotel, '{extras}', '[
  {"id":"toallas","name":"Toallas adicionales","price":0,"unit":"estadia","active":true},
  {"id":"aire","name":"Aire acondicionado","price":0,"unit":"noche","active":true},
  {"id":"ventana","name":"Habitación con ventana","price":0,"unit":"estadia","active":true},
  {"id":"cama-extra","name":"Cama adicional","price":0,"unit":"noche","active":true},
  {"id":"late-checkout","name":"Salida tarde (late check-out)","price":0,"unit":"estadia","active":true}
]'::jsonb)
where id = 1 and not (hotel ? 'extras');

-- Total = noches × precio + adicionales − descuento
create or replace function public.booking_total(p_nights int, p_price numeric, p_extras jsonb, p_discount numeric)
returns numeric
language sql
immutable
as $$
  select greatest(0,
    coalesce(p_nights, 0) * coalesce(p_price, 0)
    + coalesce((
        select sum(
          coalesce(nullif(e->>'price', '')::numeric, 0)
          * coalesce(nullif(e->>'qty', '')::numeric, 1)
          * case when e->>'unit' = 'noche' then greatest(coalesce(p_nights, 0), 1) else 1 end)
        from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) e
      ), 0)
    - coalesce(p_discount, 0));
$$;

-- La web registra una solicitud de reserva. El precio se toma de la base, no del navegador.
create or replace function public.create_booking(p jsonb)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room   rooms%rowtype;
  v_in     date := nullif(p->>'check_in', '')::date;
  v_out    date := nullif(p->>'check_out', '')::date;
  v_phone  text := left(regexp_replace(coalesce(p->>'guest_phone', ''), '\D', '', 'g'), 20);
  v_nights int;
  v_extras jsonb;
  v_code   text;
begin
  if v_in is null then raise exception 'Falta la fecha de llegada'; end if;
  if v_in < current_date - 1 or v_in > current_date + 730 then raise exception 'Fecha de llegada inválida'; end if;
  if v_out is not null and (v_out <= v_in or v_out > v_in + 120) then raise exception 'Fecha de salida inválida'; end if;
  if length(trim(coalesce(p->>'guest_name', ''))) < 2 then raise exception 'Falta el nombre'; end if;
  if length(v_phone) < 7 then raise exception 'Falta el teléfono'; end if;
  -- Freno anti-abuso: máximo 5 solicitudes por teléfono en una hora
  if (select count(*) from bookings where guest_phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Demasiadas solicitudes seguidas, intenta más tarde';
  end if;

  select * into v_room from rooms where id = p->>'room_id';
  if not found then raise exception 'Habitación no encontrada'; end if;

  v_nights := coalesce(v_out - v_in, 0);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e->>'id',
           'name', e->>'name',
           'price', coalesce(nullif(e->>'price', '')::numeric, 0),
           'unit', coalesce(nullif(e->>'unit', ''), 'estadia'),
           'qty', 1)), '[]'::jsonb)
    into v_extras
    from settings s, jsonb_array_elements(coalesce(s.hotel->'extras', '[]'::jsonb)) e
   where s.id = 1
     and coalesce((e->>'active')::boolean, true)
     and (e->>'id') in (select jsonb_array_elements_text(coalesce(p->'extra_ids', '[]'::jsonb)));

  v_code := 'CD-' || nextval('booking_seq');

  insert into bookings (code, status, source, room_id, room_name, check_in, check_out, guests,
                        guest_name, guest_phone, price_night, extras, total, payment_method, note, history)
  values (
    v_code, 'pendiente', 'web', v_room.id, v_room.name, v_in, v_out,
    least(greatest(coalesce(nullif(p->>'guests', '')::int, 1), 1), 50),
    left(trim(p->>'guest_name'), 120), v_phone, v_room.price, v_extras,
    booking_total(v_nights, v_room.price, v_extras, 0),
    left(p->>'payment_method', 80), left(p->>'note', 1500),
    jsonb_build_array(jsonb_build_object('at', now(), 'text', 'Solicitud recibida desde la web'))
  );
  return v_code;
end;
$$;

-- Admin: listar todas las reservas
create or replace function public.admin_bookings(p_pin text)
returns setof public.bookings
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not admin_check(p_pin) then raise exception 'Clave incorrecta'; end if;
  return query select * from bookings order by check_in desc, created_at desc;
end;
$$;

-- Admin: crear o modificar una reserva (devuelve la fila guardada)
create or replace function public.admin_booking_save(p_pin text, p jsonb)
returns public.bookings
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r        bookings;
  v_id     uuid := nullif(p->>'id', '')::uuid;
  v_in     date := nullif(p->>'check_in', '')::date;
  v_out    date := nullif(p->>'check_out', '')::date;
  v_extras jsonb := coalesce(p->'extras', '[]'::jsonb);
  v_price  numeric := coalesce(nullif(p->>'price_night', '')::numeric, 0);
  v_disc   numeric := coalesce(nullif(p->>'discount', '')::numeric, 0);
  v_total  numeric;
begin
  if not admin_check(p_pin) then raise exception 'Clave incorrecta'; end if;
  if v_in is null then raise exception 'Falta la fecha de llegada'; end if;
  if v_out is not null and v_out <= v_in then raise exception 'La salida debe ser después de la llegada'; end if;
  v_total := booking_total(coalesce(v_out - v_in, 0), v_price, v_extras, v_disc);

  if v_id is not null and exists (select 1 from bookings where id = v_id) then
    update bookings set
      status         = coalesce(nullif(p->>'status', ''), status),
      hidden         = coalesce((p->>'hidden')::boolean, false),
      room_id        = p->>'room_id',
      room_name      = p->>'room_name',
      check_in       = v_in,
      check_out      = v_out,
      guests         = greatest(coalesce(nullif(p->>'guests', '')::int, 1), 1),
      guest_name     = p->>'guest_name',
      guest_phone    = regexp_replace(coalesce(p->>'guest_phone', ''), '\D', '', 'g'),
      guest_email    = p->>'guest_email',
      guest_doc      = p->>'guest_doc',
      guest_origin   = p->>'guest_origin',
      price_night    = v_price,
      extras         = v_extras,
      discount       = v_disc,
      total          = v_total,
      paid           = coalesce(nullif(p->>'paid', '')::numeric, 0),
      payment_method = p->>'payment_method',
      note           = p->>'note',
      admin_note     = p->>'admin_note',
      cancel_reason  = p->>'cancel_reason',
      history        = coalesce(p->'history', history),
      checked_in_at  = nullif(p->>'checked_in_at', '')::timestamptz,
      checked_out_at = nullif(p->>'checked_out_at', '')::timestamptz,
      updated_at     = now()
    where id = v_id
    returning * into r;
  else
    insert into bookings (id, code, status, hidden, source, room_id, room_name, check_in, check_out, guests,
                          guest_name, guest_phone, guest_email, guest_doc, guest_origin,
                          price_night, extras, discount, total, paid, payment_method,
                          note, admin_note, cancel_reason, history, checked_in_at, checked_out_at)
    values (
      coalesce(v_id, gen_random_uuid()), 'CD-' || nextval('booking_seq'),
      coalesce(nullif(p->>'status', ''), 'confirmada'), coalesce((p->>'hidden')::boolean, false), 'admin',
      p->>'room_id', p->>'room_name', v_in, v_out, greatest(coalesce(nullif(p->>'guests', '')::int, 1), 1),
      p->>'guest_name', regexp_replace(coalesce(p->>'guest_phone', ''), '\D', '', 'g'), p->>'guest_email', p->>'guest_doc', p->>'guest_origin',
      v_price, v_extras, v_disc, v_total, coalesce(nullif(p->>'paid', '')::numeric, 0), p->>'payment_method',
      p->>'note', p->>'admin_note', p->>'cancel_reason', coalesce(p->'history', '[]'::jsonb),
      nullif(p->>'checked_in_at', '')::timestamptz, nullif(p->>'checked_out_at', '')::timestamptz
    )
    returning * into r;
  end if;
  return r;
end;
$$;

-- Admin: eliminar una reserva definitivamente
create or replace function public.admin_booking_delete(p_pin text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not admin_check(p_pin) then raise exception 'Clave incorrecta'; end if;
  delete from bookings where id = p_id;
end;
$$;

revoke all on function public.create_booking(jsonb) from public;
revoke all on function public.admin_bookings(text) from public;
revoke all on function public.admin_booking_save(text, jsonb) from public;
revoke all on function public.admin_booking_delete(text, uuid) from public;
grant execute on function public.create_booking(jsonb) to anon, authenticated;
grant execute on function public.admin_bookings(text) to anon, authenticated;
grant execute on function public.admin_booking_save(text, jsonb) to anon, authenticated;
grant execute on function public.admin_booking_delete(text, uuid) to anon, authenticated;
