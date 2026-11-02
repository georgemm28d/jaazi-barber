-- =========================================================
-- Jaazi Barber — esquema Supabase
-- Ejecutar en el SQL Editor del proyecto.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- Servicios (precio y duración autoritativos) ----------

create table if not exists public.services (
  id          text primary key,
  name        text not null,
  price       integer not null check (price >= 0),
  duration    integer not null check (duration between 15 and 480),
  meta        text,
  description text,
  active      boolean not null default true,
  sort        integer not null default 0
);

insert into public.services (id, name, price, duration, meta, description, sort) values
  ('corte-personalizado', 'Corte personalizado', 27000,  45, '45 min · tijera y máquina', 'Tijera y máquina, adaptado a tu rostro y a tu rutina.', 1),
  ('corte-barba',         'Corte + barba',        35000,  60, '60 min · corte y barba',     'Corte completo más perfilado y arreglo de barba.', 2),
  ('barba',               'Barba',                15000,  30, '30 min · perfilado y acabado','Perfilado, arreglo y acabado de barba.', 3),
  ('colores-fantasia',    'Colores fantasía',    120000, 120, '2 h · color a elección',      'Color a elección con preparación y acabado.', 4),
  ('mechas-platinadas',   'Mechas platinadas',   250000, 240, '4 h · incluye corte',         'Platinado por mechas, incluye corte.', 5),
  ('platinado-global',    'Platinado global',    250000, 240, '4 h · incluye corte',         'Platinado completo de raíz a puntas, incluye corte.', 6)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  duration = excluded.duration,
  meta = excluded.meta,
  description = excluded.description,
  sort = excluded.sort;

-- ---------- Citas ----------

create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  service_id   text not null references public.services (id),
  service_name text not null,
  price        integer not null,
  duration     integer not null,
  date         date not null,
  time         time not null,
  name         text not null,
  phone        text not null,
  email        text,
  notes        text,
  status       text not null default 'confirmed'
               check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists bookings_date_idx  on public.bookings (date, time);
create index if not exists bookings_phone_idx on public.bookings (phone);
create unique index if not exists bookings_active_slot_uidx
  on public.bookings (date, time)
  where status in ('pending', 'confirmed');

-- ---------- Bloqueos de agenda ----------

create table if not exists public.blocks (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  start_time time not null,
  end_time   time not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists blocks_date_idx on public.blocks (date);

-- ---------- Administradores ----------
-- El panel solo puede leer datos si el correo del usuario autenticado está aquí.
-- Cambia este correo por el que uses al crear el usuario en Authentication → Users.

create table if not exists public.admins (
  email text primary key
);

insert into public.admins (email)
values ('jaazielbarber09@gmail.com')
on conflict (email) do nothing;

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.admins a
     where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- Disponibilidad pública (sin datos personales) ----------

create or replace view public.public_busy as
  select b.date,
         b.time as start_time,
         (b.time + b.duration * interval '1 minute')::time as end_time
    from public.bookings b
   where b.status in ('pending', 'confirmed')
  union all
  select k.date, k.start_time, k.end_time
    from public.blocks k;

revoke all on public.public_busy from anon, authenticated;
grant select on public.public_busy to anon, authenticated;

-- ---------- Códigos legibles (sin 0/O/1/I) ----------

create or replace function public.generate_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result   text := '';
  i        integer;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return 'JZ-' || result;
end;
$$;

-- ---------- Crear cita ----------

create or replace function public.create_booking(
  p_service_id text,
  p_date       date,
  p_time       time,
  p_name       text,
  p_phone      text,
  p_email      text default null,
  p_notes      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s        public.services%rowtype;
  v_start  integer;
  v_end    integer;
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name   text := btrim(coalesce(p_name, ''));
  v_code   text;
  v_id     uuid;
begin
  select * into s from public.services where id = p_service_id and active;
  if not found then
    raise exception 'service_not_found';
  end if;

  if length(v_name) < 2 then
    raise exception 'invalid_name';
  end if;
  if length(v_phone) < 7 or length(v_phone) > 15 then
    raise exception 'invalid_phone';
  end if;
  if p_date is null or p_time is null or p_date < current_date then
    raise exception 'invalid_slot';
  end if;
  if p_date = current_date and p_time <= localtime then
    raise exception 'invalid_slot';
  end if;

  v_start := extract(hour from p_time)::int * 60 + extract(minute from p_time)::int;
  v_end := v_start + s.duration;
  if v_start % 30 <> 0 then
    raise exception 'invalid_slot';
  end if;
  if v_start < 540 or v_end > 1140 then
    raise exception 'outside_hours';
  end if;

  perform pg_advisory_xact_lock(hashtext('jaazi:' || p_date::text));

  if exists (
    select 1 from public.bookings b
     where b.date = p_date
       and b.status in ('pending', 'confirmed')
       and v_start < (extract(hour from b.time)::int * 60 + extract(minute from b.time)::int + b.duration)
       and (extract(hour from b.time)::int * 60 + extract(minute from b.time)::int) < v_end
  ) then
    raise exception 'slot_taken';
  end if;

  if exists (
    select 1 from public.blocks k
     where k.date = p_date
       and v_start < (extract(hour from k.end_time)::int * 60 + extract(minute from k.end_time)::int)
       and (extract(hour from k.start_time)::int * 60 + extract(minute from k.start_time)::int) < v_end
  ) then
    raise exception 'slot_taken';
  end if;

  loop
    v_code := public.generate_code();
    exit when not exists (select 1 from public.bookings where code = v_code);
  end loop;

  insert into public.bookings (
    code, service_id, service_name, price, duration, date, time, name, phone, email, notes, status
  ) values (
    v_code, s.id, s.name, s.price, s.duration, p_date, p_time, v_name, v_phone,
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    'confirmed'
  ) returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'code', v_code,
    'serviceId', s.id,
    'serviceName', s.name,
    'price', s.price,
    'duration', s.duration,
    'date', p_date,
    'time', to_char(p_time, 'HH24:MI'),
    'status', 'confirmed'
  );
end;
$$;

-- ---------- Buscar citas (código o teléfono) ----------

create or replace function public.lookup_bookings(p_query text)
returns table (
  code         text,
  service_id   text,
  service_name text,
  price        integer,
  duration     integer,
  date         date,
  time         time,
  name         text,
  phone        text,
  email        text,
  notes        text,
  status       text,
  created_at   timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  q      text := btrim(coalesce(p_query, ''));
  digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
begin
  if q ~* '^JZ-[A-Z0-9]{4,8}$' then
    return query
      select b.code, b.service_id, b.service_name, b.price, b.duration, b.date, b.time,
             b.name, b.phone, b.email, b.notes, b.status, b.created_at
        from public.bookings b
       where upper(b.code) = upper(q)
       order by b.date desc, b.time desc;
    return;
  end if;

  if length(digits) >= 7 then
    return query
      select b.code, b.service_id, b.service_name, b.price, b.duration, b.date, b.time,
             b.name, b.phone, b.email, b.notes, b.status, b.created_at
        from public.bookings b
       where b.phone = digits
          or right(b.phone, 10) = right(digits, 10)
       order by b.date desc, b.time desc
       limit 40;
    return;
  end if;

  return;
end;
$$;

-- ---------- Cancelar cita (código + teléfono) ----------

create or replace function public.cancel_booking(p_code text, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  update public.bookings b
     set status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   where upper(b.code) = upper(btrim(coalesce(p_code, '')))
     and (b.phone = digits or right(b.phone, 10) = right(digits, 10))
     and b.status in ('pending', 'confirmed')
     and b.date >= current_date;

  return found;
end;
$$;

-- ---------- Identidad del panel ----------

create or replace function public.panel_whoami()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'email', coalesce(auth.jwt() ->> 'email', ''),
    'isAdmin', public.is_admin()
  );
$$;

revoke all on function public.panel_whoami() from public, anon;
grant execute on function public.panel_whoami() to authenticated;

-- ---------- Permisos ----------
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.blocks   enable row level security;

drop policy if exists "services public read" on public.services;
create policy "services public read" on public.services
  for select to anon, authenticated using (true);

drop policy if exists "admin services" on public.services;
create policy "admin services" on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin bookings" on public.bookings;
create policy "admin bookings" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin blocks" on public.blocks;
create policy "admin blocks" on public.blocks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.bookings from anon, authenticated;
revoke all on public.blocks from anon, authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.blocks to authenticated;

revoke all on function public.generate_code() from public, anon, authenticated;
revoke all on function public.create_booking(text, date, time, text, text, text, text) from public;
revoke all on function public.lookup_bookings(text) from public;
revoke all on function public.cancel_booking(text, text) from public;

grant execute on function public.create_booking(text, date, time, text, text, text, text) to anon, authenticated;
grant execute on function public.lookup_bookings(text) to anon, authenticated;
grant execute on function public.cancel_booking(text, text) to anon, authenticated;

-- ---------- Actualizar updated_at ----------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch
  before update on public.bookings
  for each row execute function public.touch_updated_at();
