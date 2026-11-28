-- =========================================================
-- 2026-11-28 — Nuevos servicios VIP y actualización de precios
-- ---------------------------------------------------------
-- - Corte personalizado: $ 29.000 (30 min)
-- - Corte y barba (id corte-barba): $ 37.000 (30 min)
-- - Nuevos: Servicio VIP ($ 45.000, 30 min) y
--   Servicio VIP con barba ($ 55.000, 30 min)
-- - Se mantienen Barba y los 3 servicios de color.
-- - Las citas ya creadas conservan el precio/nombre con que se
--   registraron en bookings; no se reescribe el historial.
--
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- =========================================================

begin;

insert into public.services (id, name, price, duration, meta, description, active, sort) values
  ('corte-personalizado', 'Corte personalizado',   29000,  30, '30 min · tijera y máquina',      'Corte con máquina o tijera según tus gustos y necesidades; incluye bebida de cortesía y un relajante masaje al finalizar.', true, 1),
  ('corte-barba',         'Corte y barba',         37000,  30, '30 min · corte y barba',         'Corte con máquina o tijera según tus gustos y necesidades, más perfilado y arreglo de barba con vapor para un afeitado más suave; incluye bebida de cortesía y un relajante masaje al finalizar.', true, 2),
  ('barba',               'Barba',                 15000,  30, '30 min · perfilado y acabado',   'Perfilado, arreglo y acabado de barba.', true, 3),
  ('servicio-vip',        'Servicio VIP',          45000,  30, '30 min · corte y cuidado facial', 'Corte personalizado con ritual facial (vapor para abrir poros, exfoliación, mascarilla negra para puntos negros e hidratación), masaje relajante y bebida de cortesía.', true, 4),
  ('servicio-vip-barba',  'Servicio VIP con barba',55000,  30, '30 min · corte, barba y facial', 'Corte y arreglo de barba con ritual facial (vapor para abrir poros, exfoliación, mascarilla negra para puntos negros e hidratación), masaje relajante y bebida de cortesía.', true, 5),
  ('colores-fantasia',    'Colores fantasía',     120000, 120, '2 h · color a elección',         'Color a elección con preparación y acabado.', true, 6),
  ('mechas-platinadas',   'Mechas platinadas',    250000, 240, '4 h · incluye corte',            'Platinado por mechas, incluye corte.', true, 7),
  ('platinado-global',    'Platinado global',     250000, 240, '4 h · incluye corte',            'Platinado completo de raíz a puntas, incluye corte.', true, 8)
on conflict (id) do update set
  name        = excluded.name,
  price       = excluded.price,
  duration    = excluded.duration,
  meta        = excluded.meta,
  description = excluded.description,
  active      = excluded.active,
  sort        = excluded.sort;

notify pgrst, 'reload schema';

commit;

-- Verificación posterior en SQL Editor:
-- select id, name, price, duration, sort, active
--   from public.services
--  order by sort;
