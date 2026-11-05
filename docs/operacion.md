# Operación

Documentación de mantenimiento del proyecto. No contiene contraseñas ni credenciales: la cuenta del panel se entrega por un canal privado.

## Modos de funcionamiento

La agenda decide su modo en `assets/js/config.js`:

1. **Compartido (Supabase)** — `supabaseUrl` y `supabaseAnonKey` configurados. Las citas viven en Postgres y se ven desde cualquier dispositivo. Es el modo de producción.
2. **Local (respaldo)** — configuración vacía. La reserva funciona con `localStorage` (`jaazi.bookings.v2`); las citas no salen del navegador. El panel privado no funciona en este modo.

La `anon key` es pública por diseño. Las políticas RLS y las funciones `SECURITY DEFINER` son las que protegen los datos. La `service_role` nunca se incluye en el cliente.

## Supabase

- Proyecto `jaazi-barber`, plan gratuito, región `sa-east-1`.
- Esquema: [`supabase/schema.sql`](../supabase/schema.sql).
- Tablas: `services`, `bookings`, `blocks`, `admins`.
- Vista pública: `public_busy` (solo fecha, inicio y fin).
- Funciones: `create_booking`, `lookup_bookings`, `cancel_booking`, `reschedule_booking`, `panel_whoami`.
- RLS activo en todas las tablas; el rol anónimo no lee `bookings` ni `blocks`.
- El registro público de cuentas está desactivado. Solo los correos de `admins` pueden leer la agenda.

### Migraciones

Si el proyecto se creó antes de las migraciones, ejecutar en orden desde el SQL Editor:

1. `supabase/migrations/2026-11-02-fix-timezone.sql` — cálculo de fechas en `America/Bogota`.
2. `supabase/migrations/2026-11-02-secure-lookup.sql` — `lookup_bookings` exige código + teléfono.
3. `supabase/migrations/2026-11-02-reschedule.sql` — `reschedule_booking`.
4. `supabase/migrations/2026-11-04-remove-pending.sql` — elimina el estado `pending` y deja solo `confirmed`, `completed` y `cancelled`.
5. `supabase/migrations/2026-11-04-booking-email.sql` — trigger de avisos por correo (requiere Resend).

Un proyecto nuevo creado con `schema.sql` ya incluye el estado sin `pending`. La migración de correo se aplica aparte porque necesita la API key.

### Notificaciones por correo

El trigger `booking_email_notify` envía un correo a **jaazielbarber09@gmail.com** en cada alta o cambio de cita: nueva, reprogramada, cancelada, completada o actualizada. Lo hace con [Resend](https://resend.com) y `pg_net`; la API key se guarda en Vault, nunca en el cliente ni en el repo.

1. Crear una cuenta de Resend con **jaazielbarber09@gmail.com** y generar una API key.
2. En el SQL Editor de Supabase, guardar la key:
   ```sql
   select vault.create_secret('re_xxxxxxxx', 'resend_api_key');
   ```
3. Opcional, para usar un remitente con dominio verificado:
   ```sql
   select vault.create_secret('Jaazi Barber <citas@tudominio.com>', 'resend_from');
   ```
   Sin `resend_from`, se usa `Jaazi Barber <onboarding@resend.dev>`, que en el plan de pruebas de Resend solo entrega al correo dueño de la cuenta.
4. Opcional, para cambiar el destinatario:
   ```sql
   select vault.create_secret('otro@correo.com', 'booking_notify_to');
   ```
5. Aplicar `supabase/migrations/2026-11-04-booking-email.sql`.
6. Probar con una cita de prueba y borrarla después. Revisar el log de Resend o `select * from net._http_response order by id desc limit 5;`.

Si falta `resend_api_key`, la cita se guarda igual y Postgres emite un warning; el correo no bloquea la reserva. La API key solo se lee dentro de una función `SECURITY DEFINER` y no se expone en `public_busy` ni en el panel.

**Estado actual:** configurado y probado el 4 de noviembre de 2026. El secreto `resend_api_key` está en Vault, el trigger `booking_email_notify` está activo y se verificaron los avisos de alta y reprogramación. El valor de la key no se documenta ni se versiona.

### Acceso del panel

- Crear el usuario en **Authentication → Users** con el correo del cliente y una contraseña.
- Añadirlo a la tabla `admins` si el esquema no lo sembró.
- Desactivar *Enable signups* en **Authentication → Providers → Email**.
- La contraseña se restablece desde **Authentication → Users → Send password recovery** o asignando un hash bcrypt nuevo en `auth.users.encrypted_password`. Es independiente de la contraseña de supabase.com.

## Reglas de negocio

- Toda la agenda trabaja en **hora de Colombia** (`America/Bogota`), no en UTC ni en la hora del visitante.
- Reservas de 9:00 a 19:00; las 19:00 son el **último inicio** permitido, no el fin de la jornada. Un servicio puede terminar después.
- Sin solapamientos entre citas activas (`confirmed`) ni con bloqueos.
- Estados: `confirmed`, `completed`, `cancelled`. Las reservas nuevas entran como `confirmed`.
- Cancelación en cualquier momento y sin costo; cambio de fecha y hora mientras la cita no haya empezado, sujeto a disponibilidad.

## Despliegue

Cada `git push` a `main` dispara `.github/workflows/deploy.yml`, que empaqueta los archivos públicos y los sube a Netlify por la API. GitHub Pages sirve la misma copia desde `main` como respaldo.

- Secretos del repo: `NETLIFY_AUTH_TOKEN` y `NETLIFY_SITE_ID`. Se rotan desde *User settings → Applications → Personal access tokens*.
- El flujo de Netlify copia `*.html`, `robots.txt`, `llms.txt`, `sitemap.xml`, `.nojekyll` y `assets/`. La carpeta `docs/` no se publica en el sitio.
- **Badge de Netlify:** el plan Free inyecta `/.netlify/scripts/hud` después de `</html>` y un badge fijo. No se puede desactivar sin plan de pago; se acepta. El HTML del repositorio es válido y GitHub Pages no inyecta nada.

## Entrega al cliente

- **Sitio:** `https://jaazibarber.netlify.app/`
- **Panel:** `https://jaazibarber.netlify.app/panel.html` (no enlazado desde la web pública, `noindex` y excluido en `robots.txt`).
- **Demo del panel:** `https://jaazibarber.netlify.app/panel-demo.html` (datos ficticios, sin Supabase).
- **Cuentas:** el correo del administrador vive en la tabla `admins`; la contraseña se entrega aparte.
- **Respaldo:** `https://georgemm28d.github.io/jaazi-barber/`

## Checklist antes de un cambio

1. `python -m http.server 4173` y probar reserva, consulta, cambio y cancelación.
2. Validar el HTML con W3C Nu y el flujo con axe-core.
3. Comprobar 320 y 390 px sin desbordamiento y con objetivos táctiles de 44 px.
4. Verificar que no se commitean credenciales ni datos reales de clientes.
5. `git push` a `main` y esperar los dos workflows en verde.
