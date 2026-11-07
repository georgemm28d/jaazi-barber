-- 2026-11-06 - Duraciones de corte
-- "Corte personalizado" y "Corte + barba" pasan a 30 minutos.
-- create_booking y reschedule_booking leen la duración desde public.services,
-- así que las reservas nuevas toman el cambio automáticamente.
-- Las citas ya creadas conservan la duración con la que se registraron
-- (columna bookings.duration); no se reescribe el historial.

update public.services
   set duration = 30,
       meta = '30 min · tijera y máquina'
 where id = 'corte-personalizado';

update public.services
   set duration = 30,
       meta = '30 min · corte y barba'
 where id = 'corte-barba';
