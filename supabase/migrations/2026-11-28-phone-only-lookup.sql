-- =========================================================
-- 2026-11-28 — Consultar citas solo con teléfono (sin código)
-- ---------------------------------------------------------
-- - Reemplaza lookup_bookings(p_code, p_phone) por
--   lookup_bookings(p_phone).
-- - Exige entre 10 y 15 dígitos para evitar búsquedas por
--   fragmentos cortos.
-- - Devuelve el nombre completo y los datos de la cita
--   (sin correo ni notas privadas), limitado a citas futuras
--   y de los últimos 7 días (máx. 10).
-- - Mantiene code internamente en la respuesta para que
--   cancel_booking(p_code, p_phone) y reschedule_booking(...)
--   operen sobre la cita exacta cuando el cliente tiene más
--   de una cita.
-- - Añade índice funcional sobre los últimos 10 dígitos del
--   teléfono para evitar escaneo completo de bookings.
--
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- =========================================================

begin;

create index if not exists bookings_phone_lookup_idx
  on public.bookings ((right(phone, 10)));

drop function if exists public.lookup_bookings(text, text);
drop function if exists public.lookup_bookings(text);

create or replace function public.lookup_bookings(p_phone text)
returns table (
  code         text,
  service_id   text,
  service_name text,
  price        integer,
  duration     integer,
  date         date,
  "time"       time,
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
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_today date := (now() at time zone 'America/Bogota')::date;
begin
  if length(v_phone) < 10 or length(v_phone) > 15 then
    return;
  end if;

  return query
    select b.code,
           b.service_id,
           b.service_name,
           b.price,
           b.duration,
           b.date,
           b.time,
           b.name,
           b.phone,
           ''::text as email,
           ''::text as notes,
           b.status,
           b.created_at
      from public.bookings b
     where (b.phone = v_phone or (length(b.phone) >= 10 and right(b.phone, 10) = right(v_phone, 10)))
       and b.date >= v_today - 7
     order by (b.date >= v_today and b.status = 'confirmed') desc,
              b.date asc,
              b.time asc
     limit 10;
end;
$$;

revoke all on function public.lookup_bookings(text) from public;
grant execute on function public.lookup_bookings(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación posterior en SQL Editor:
-- select proname, pg_get_function_arguments(oid)
--   from pg_proc
--  where proname = 'lookup_bookings';
