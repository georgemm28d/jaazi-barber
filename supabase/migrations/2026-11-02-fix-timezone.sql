-- =========================================================
-- Jaazi Barber — arreglo de zona horaria
-- Fecha: 2026-11-02
-- ---------------------------------------------------------
-- Supabase/Postgres corre en UTC, pero la agenda es de Chía,
-- Colombia (America/Bogota, UTC-5). Las funciones comparaban
-- la fecha/hora del cliente contra current_date/localtime
-- (UTC), así que las citas del mismo día se rechazaban
-- durante la mañana.
--
-- Ejecutar en Supabase → SQL Editor. Es idempotente.
-- =========================================================

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
  v_today  date := (now() at time zone 'America/Bogota')::date;
  v_now    time := (now() at time zone 'America/Bogota')::time;
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
  if p_date is null or p_time is null or p_date < v_today then
    raise exception 'invalid_slot';
  end if;
  if p_date = v_today and p_time <= v_now then
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
     and b.date >= (now() at time zone 'America/Bogota')::date;

  return found;
end;
$$;

revoke all on function public.create_booking(text, date, time, text, text, text, text) from public;
revoke all on function public.cancel_booking(text, text) from public;
grant execute on function public.create_booking(text, date, time, text, text, text, text) to anon, authenticated;
grant execute on function public.cancel_booking(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Comprobación: debe mostrar la hora UTC y la hora de Colombia.
select now() as utc_now,
       (now() at time zone 'America/Bogota') as bogota_now;
