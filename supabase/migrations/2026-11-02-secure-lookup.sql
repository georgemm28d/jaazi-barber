-- =========================================================
-- Jaazi Barber — búsqueda de citas con dos factores
-- Fecha: 2026-11-02
-- ---------------------------------------------------------
-- Antes: lookup_bookings(text) permitía ver una cita con solo
-- el código o con solo el teléfono. Un teléfono es un dato
-- semipúblico, así que cualquiera podía leer nombre, correo,
-- notas y el historial de otra persona (Ley 1581 de 2012).
--
-- Ahora se exigen código + teléfono, y se elimina la versión
-- de un solo argumento para que no quede accesible.
--
-- Ejecutar en Supabase → SQL Editor. Es idempotente.
-- =========================================================

create or replace function public.lookup_bookings(p_code text, p_phone text)
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
  v_code  text := upper(btrim(coalesce(p_code, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if v_code !~ '^JZ-[A-Z0-9]{4,8}$' or length(v_phone) < 7 or length(v_phone) > 15 then
    return;
  end if;

  return query
    select b.code, b.service_id, b.service_name, b.price, b.duration, b.date, b.time,
           b.name, b.phone, b.email, b.notes, b.status, b.created_at
      from public.bookings b
     where upper(b.code) = v_code
       and (b.phone = v_phone or right(b.phone, 10) = right(v_phone, 10))
     order by b.date desc, b.time desc
     limit 5;
end;
$$;

-- Elimina la firma antigua (un solo argumento) y sus permisos.
drop function if exists public.lookup_bookings(text);

revoke all on function public.lookup_bookings(text, text) from public;
grant execute on function public.lookup_bookings(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Comprobación: debe aparecer una sola firma, con dos argumentos.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as argumentos
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'lookup_bookings';
