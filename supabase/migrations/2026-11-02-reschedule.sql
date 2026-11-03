-- =========================================================
-- Jaazi Barber — cambiar la fecha y hora de una cita
-- Fecha: 2026-11-02
-- ---------------------------------------------------------
-- Permite mover una cita activa conservando servicio, duración,
-- precio y datos del cliente. Se exige código + teléfono, igual
-- que para consultar y cancelar.
--
-- Ejecutar en Supabase → SQL Editor. Es idempotente.
-- =========================================================

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
     and status in ('pending', 'confirmed')
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
  if v_start < 540 or v_end > 1140 then
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
       and o.status in ('pending', 'confirmed')
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

revoke all on function public.reschedule_booking(text, text, date, time) from public;
grant execute on function public.reschedule_booking(text, text, date, time) to anon, authenticated;

notify pgrst, 'reload schema';

-- Comprobación: la función debe existir y tener cuatro argumentos.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as argumentos
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'reschedule_booking';
