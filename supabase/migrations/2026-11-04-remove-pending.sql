-- Elimina el estado `pending`. Las reservas nacen confirmadas.
-- Ejecutar en el SQL Editor de Supabase antes de desplegar el panel nuevo.

begin;

-- 1. Cualquier cita pendiente pasa a confirmada.
update public.bookings
   set status = 'confirmed'
 where status = 'pending';

-- 2. Reemplaza el check de estado, aunque el nombre haya cambiado.
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.bookings'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%pending%'
  loop
    execute format('alter table public.bookings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('confirmed', 'cancelled', 'completed'));

-- 3. Solo una cita confirmada ocupa el horario.
drop index if exists public.bookings_active_slot_uidx;
create unique index bookings_active_slot_uidx
  on public.bookings (date, time)
  where status = 'confirmed';

-- 4. La disponibilidad pública solo cuenta confirmadas.
create or replace view public.public_busy as
  select b.date,
         b.time as start_time,
         (b.time + b.duration * interval '1 minute')::time as end_time
    from public.bookings b
   where b.status = 'confirmed'
  union all
  select k.date, k.start_time, k.end_time
    from public.blocks k;

revoke all on public.public_busy from anon, authenticated;
grant select on public.public_busy to anon, authenticated;

commit;
