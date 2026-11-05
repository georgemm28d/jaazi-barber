-- 2026-11-04 - Ventana de reserva
-- 19:00 es el ultimo inicio permitido, no el fin de la jornada.
-- Una cita puede terminar despues de las 19:00.
-- Aplica sobre create_booking y reschedule_booking.

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
  -- La agenda trabaja en hora de Colombia. Postgres/Supabase corre en UTC,
  -- así que comparar contra current_date/localtime rechazaba citas del
  -- mismo día durante la mañana (UTC va 5 horas adelante).
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
  -- 19:00 es el último inicio permitido, no el fin de la jornada:
  -- una cita puede terminar después de las 19:00.
  if v_start < 540 or v_start > 1140 then
    raise exception 'outside_hours';
  end if;

  perform pg_advisory_xact_lock(hashtext('jaazi:' || p_date::text));

  if exists (
    select 1 from public.bookings b
     where b.date = p_date
       and b.status = 'confirmed'
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

create or replace function public.reschedule_booking(
  p_code  text,
  p_phone text,
  p_date  date,
  p_time  time
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  b       public.bookings%rowtype;
  v_code  text := upper(btrim(coalesce(p_code, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_start integer;
  v_end   integer;
  -- La agenda trabaja en hora de Colombia.
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_now   time := (now() at time zone 'America/Bogota')::time;
begin
  if v_code !~ '^JZ-[A-Z0-9]{4,8}$' or length(v_phone) < 7 or length(v_phone) > 15 then
    raise exception 'booking_not_found';
  end if;

  select * into b
    from public.bookings
   where upper(code) = v_code
     and (phone = v_phone or right(phone, 10) = right(v_phone, 10))
     and status = 'confirmed'
   for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  -- Una cita que ya empezó no se puede mover.
  if b.date < v_today or (b.date = v_today and b.time <= v_now) then
    raise exception 'invalid_slot';
  end if;

  if p_date is null or p_time is null or p_date < v_today then
    raise exception 'invalid_slot';
  end if;
  if p_date = v_today and p_time <= v_now then
    raise exception 'invalid_slot';
  end if;

  v_start := extract(hour from p_time)::int * 60 + extract(minute from p_time)::int;
  v_end := v_start + b.duration;
  if v_start % 30 <> 0 then
    raise exception 'invalid_slot';
  end if;
  -- 19:00 es el último inicio permitido, no el fin de la jornada:
  -- una cita puede terminar después de las 19:00.
  if v_start < 540 or v_start > 1140 then
    raise exception 'outside_hours';
  end if;

  if p_date = b.date and p_time = b.time then
    return jsonb_build_object(
      'id', b.id,
      'code', b.code,
      'serviceId', b.service_id,
      'serviceName', b.service_name,
      'price', b.price,
      'duration', b.duration,
      'date', b.date,
      'time', to_char(b.time, 'HH24:MI'),
      'name', b.name,
      'phone', b.phone,
      'email', b.email,
      'notes', b.notes,
      'status', b.status,
      'created_at', b.created_at
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('jaazi:' || p_date::text));

  if exists (
    select 1 from public.bookings o
     where o.date = p_date
       and o.status = 'confirmed'
       and o.id <> b.id
       and v_start < (extract(hour from o.time)::int * 60 + extract(minute from o.time)::int + o.duration)
       and (extract(hour from o.time)::int * 60 + extract(minute from o.time)::int) < v_end
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

  update public.bookings
     set date = p_date,
         time = p_time,
         updated_at = now()
   where id = b.id;

  return jsonb_build_object(
    'id', b.id,
    'code', b.code,
    'serviceId', b.service_id,
    'serviceName', b.service_name,
    'price', b.price,
    'duration', b.duration,
    'date', p_date,
    'time', to_char(p_time, 'HH24:MI'),
    'name', b.name,
    'phone', b.phone,
    'email', b.email,
    'notes', b.notes,
    'status', b.status,
    'created_at', b.created_at
  );
end;
$$;
