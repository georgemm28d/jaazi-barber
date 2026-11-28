---
name: migracion-supabase
description: Aplica una migración SQL en el proyecto Supabase de Jaazi Barber desde el SQL Editor y verifica que las funciones RPC quedaron actualizadas. Úsala cuando haya que cambiar esquema, políticas o funciones en la base de datos de producción.
---

# Aplicar una migración en Supabase

## Contexto

- Proyecto `jaazi-barber`, ref `kavtsigejtugsyiisvsz`.
- SQL Editor: `https://supabase.com/dashboard/project/kavtsigejtugsyiisvsz/sql/new`
- No hay CLI ni cadena de conexión en el repo: se aplica desde el panel con la sesión del dueño.

## Pasos

1. La migración ya está en `supabase/migrations/` y reflejada en `supabase/schema.sql`.
2. Abrir el SQL Editor y pegar el archivo completo.
3. **Run** (o `Ctrl+Enter`) y esperar `Success. No rows returned`.
4. Verificar que la función cambió:

   ```sql
   select p.proname,
          (pg_get_functiondef(p.oid) like '%<cadena-del-cambio>%') as aplicado
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_booking', 'reschedule_booking');
   ```

5. Probar el camino de rechazo contra el RPC con la `anon key` pública de `assets/js/config.js`. Ejemplo para `too_soon`: reservar hoy una hora a menos de 60 minutos. Debe responder `400` con `"message":"too_soon"` y **no** crear cita.
6. No crear citas reales en producción para probar. Si creas una, bórrala al terminar.

## Si algo falla

- `function ... does not exist`: firma distinta; revisa el orden de parámetros y los `default`.
- `permission denied`: faltan `grant execute` a `anon`.
- PostgREST sigue con la versión vieja: confirma el `notify pgrst, 'reload schema';` final.
