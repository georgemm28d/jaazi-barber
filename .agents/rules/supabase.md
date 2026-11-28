---
trigger: glob
globs: "supabase/**/*.sql"
description: "Reglas para esquema, funciones RPC y migraciones de Jaazi Barber en Supabase/Postgres."
---

# Supabase / Postgres

## Migraciones

- Una migración por cambio, en `supabase/migrations/`, con nombre `YYYY-MM-DD-slug.sql`.
- Debe ser **idempotente**: `create or replace function`, `if not exists`, `drop policy if exists` antes de `create policy`.
- Actualiza también `supabase/schema.sql` para que un proyecto nuevo quede igual que producción.
- Cierra con `notify pgrst, 'reload schema';` para refrescar PostgREST.
- La migración no se aplica sola: se ejecuta a mano en el SQL Editor. No hay CLI ni cadena de conexión en el repo.

## Funciones

- `security definer` y `set search_path = public, pg_temp`.
- `revoke all ... from public` y `grant execute ... to anon, authenticated` según el caso.
- Toda decisión de agenda va dentro de la función y en una sola transacción: día, hora, zona, cierre, antelación, bloques y solapamientos.
- Antes de comprobar solapamientos: `perform pg_advisory_xact_lock(hashtext('jaazi:' || p_date::text));`
- Hora local con `(now() at time zone 'America/Bogota')::date` y `::time`. Nunca `current_date`, `now()::date` ni `now()::time`.
- Horario con `shop_open_minutes(p_date)` y `shop_close_minutes(p_date)`. El cierre es el último inicio permitido, no el fin del servicio.
- Antelación de 1 hora: `if p_date = v_today and v_start < now_minutes + 60 then raise exception 'too_soon'; end if;`

## Códigos de error

Estables, en inglés y snake_case: `service_not_found`, `invalid_name`, `invalid_phone`, `invalid_slot`, `outside_hours`, `slot_taken`, `too_soon`, `booking_not_found`. No cambies un código existente sin actualizar `assets/js/api.js`.

## Seguridad

- El rol anónimo **no** lee `bookings` ni `blocks`; solo `public_busy` (fecha, inicio y fin) y las funciones RPC.
- `lookup_bookings(p_phone)` exige 10–15 dígitos y nunca devuelve correo ni notas privadas. `cancel_booking` y `reschedule_booking` exigen código interno y teléfono.
- Secretos en Vault (`vault.create_secret`), nunca en tablas, en el repo ni en el cliente.
