# Jaazi Barber

Sitio web de **Jaazi Barber**, barbería de una sola silla en **Chía, Cundinamarca (Colombia)**.
Páginas en español, sin build: HTML, CSS y JavaScript vanilla. La agenda compartida vive en **Supabase** (Postgres + API REST + Auth); el sitio se publica como archivos estáticos en GitHub Pages.

> Publicado en **https://jaazibarber.netlify.app/** (Netlify, cuenta del cliente `jaazielbarber09@gmail.com`).
> La copia en GitHub Pages sigue activa como respaldo: https://georgemm28d.github.io/jaazi-barber/.
> Incluye tema claro/oscuro (preferencia del sistema + toggle persistente en el navegador).

## Páginas

- `index.html` — home: hero, servicios, el estudio, trabajo reciente, FAQ y CTA.
- `agendar.html` — reserva en 3 pasos (servicio → día/hora → datos) con confirmación, código y `.ics`.
- `revisar.html` — consulta por código o teléfono, cancelación y añadir al calendario.
- `panel.html` — **panel privado** (login con correo y contraseña): citas próximas, del día e historial; confirmar, completar y cancelar; bloqueos de horas; ingresos estimados. No está enlazado desde la web pública, lleva `noindex` y `robots.txt` lo excluye.

Horario: **todos los días, 9:00–19:00**, franjas de 30 min y 2 h de antelación para hoy.

## Modos de funcionamiento

La agenda tiene dos modos, decididos por `assets/js/config.js`:

1. **Compartido (Supabase)** — si `supabaseUrl` y `supabaseAnonKey` están rellenos. Las citas se guardan en la base de datos y se ven desde cualquier dispositivo. Es el modo de producción.
2. **Local (respaldo)** — si la configuración está vacía, todo funciona con `localStorage` (`jaazi.bookings.v2`) como antes. Sirve para abrir el sitio sin backend; las citas no salen del navegador.

Los textos de privacidad y las notas de “revisar cita” se adaptan solos al modo activo.

## Backend (Supabase)

### Estado actual

Ya está creado, configurado y conectado:

- Proyecto **jaazi-barber** en Supabase, región `sa-east-1` (São Paulo), plan gratuito. Ref. `kavtsigejtugsyiisvsz`; URL `https://kavtsigejtugsyiisvsz.supabase.co`.
- Esquema `supabase/schema.sql` aplicado: tablas, vista `public_busy`, funciones y RLS.
- Panel: **https://jaazibarber.netlify.app/panel.html** con la cuenta **jaazielbarber09@gmail.com**. Es la única cuenta autorizada en `admins` y la única propietaria de la organización de Supabase.
- El registro público de cuentas está desactivado: nadie puede crearse un usuario nuevo.
- `assets/js/config.js` apunta al proyecto con la clave publicable (`sb_publishable_…`), pública por diseño.

Si el proyecto ya estaba creado antes del **2 de noviembre de 2026**, ejecuta una vez
`supabase/migrations/2026-11-02-fix-timezone.sql` en el SQL Editor. Corrige el cálculo de
fechas para que las citas del mismo día se validen en hora de Colombia y no en UTC.

La contraseña del panel se entrega por un canal privado y **no se guarda en el repositorio**. Se cambia en Supabase → **Authentication → Users** → usuario → **Send password recovery** (llega al correo del cliente) o asignando un hash bcrypt nuevo en `auth.users.encrypted_password`. Es independiente de la contraseña de supabase.com, aunque las dos usen el mismo correo.

### Si hay que rehacerlo desde cero

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Abrir **SQL Editor** y ejecutar `supabase/schema.sql`. Crea:
   - `services` (precio y duración autoritativos), `bookings`, `blocks` y `admins`.
   - La vista `public_busy`, que expone solo fecha, hora y duración de lo ocupado.
   - Las funciones `create_booking`, `lookup_bookings` y `cancel_booking` (`SECURITY DEFINER`).
   - RLS: nadie anónimo puede leer `bookings`; solo se llega a los datos por las funciones, con código o teléfono.
3. En **Authentication → Users**, crear el usuario del panel con el correo **jaazielbarber09@gmail.com** y una contraseña, y añadirlo a `admins` si no lo sembró el esquema. No crear cuentas extra: cada fila de `admins` puede ver todas las citas.
   - El panel solo lee datos si el correo autenticado está en esa tabla.
   - En **Authentication → Providers → Email**, desactiva *Enable signups* para que nadie pueda crearse una cuenta.
4. Copiar **Project URL** y la clave publicable (Settings → API Keys) en `assets/js/config.js`.
5. Publicar: `git push` a `main`. GitHub Pages sirve los archivos tal cual.

### Seguridad

- `bookings` y `blocks` tienen RLS y no se pueden leer con la `anon key`.
- Los clientes solo llegan a sus citas por `create_booking`, `lookup_bookings` y `cancel_booking` (código o teléfono).
- El panel exige sesión y que el correo esté en la tabla `admins`; el resto de cuentas autenticadas no ve nada.
- La clave publicable (`sb_publishable_…`) es pública por diseño: las reglas de la base de datos son las que protegen los datos personales. La `service_role` nunca se incluye en el sitio.
- Cancelar exige código + teléfono; quien conozca ambos puede gestionar la cita.

### Entrega al cliente

- **Supabase:** organización «Jaazi Barber», con un solo propietario: `jaazielbarber09@gmail.com`. Proyecto `jaazi-barber` (`kavtsigejtugsyiisvsz`), plan gratuito.
- **Panel:** `https://jaazibarber.netlify.app/panel.html`, cuenta `jaazielbarber09@gmail.com`, única fila de `admins`. La contraseña se entrega aparte.
- **Netlify:** cuenta `jaazielbarber09@gmail.com`, sitio `jaazibarber.netlify.app`.
- **Recuperación del panel:** Supabase → Authentication → Users → usuario → *Send password recovery*. El enlace llega al correo del cliente.
- **Registro público desactivado:** las cuentas solo se crean desde el dashboard.
- Las cuentas de GitHub y Netlify del desarrollador no son necesarias para operar el día a día; solo para desplegar cambios de código.

### Reglas de negocio

- Toda la agenda trabaja en **hora de Colombia** (`America/Bogota`, UTC-5), no en la hora del servidor (UTC) ni en la del visitante. Las funciones de Supabase calculan `v_today`/`v_now` con `now() at time zone 'America/Bogota'`.
- Jornada 9:00–19:00; el servicio debe terminar antes de las 19:00.
- Sin solapamientos entre citas activas (`pending`/`confirmed`) ni con bloqueos.
- Estados: `pending`, `confirmed`, `completed`, `cancelled`. Las reservas nuevas entran como `confirmed`.
- Cancelación permitida en cualquier momento y sin costo.

## Estructura

```
assets/
  css/      site.css, booking.css, panel.css
  js/       config.js, api.js, store.js, site.js, booking.js, review.js, panel.js
  fonts/    Fraunces + Inter (woff2, self-hosted)
  img/      jaazi-retrato.jpg, trabajo-01…06.jpg, trabajo-estudio.jpg
supabase/
  schema.sql
```

## Ver en local

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:4173/`. El panel está en `http://127.0.0.1:4173/panel.html`.

## Datos del negocio

- Dirección: Calle 4 # 1-39, conjunto Serralta, torre 12, apartamento 205, Chía, Cundinamarca.
- Teléfono / WhatsApp: +57 313 538 1239 · Email: Jaazielbarber09@gmail.com
- Instagram: [@jaazii.barber](https://www.instagram.com/jaazii.barber)
- Servicios: corte personalizado, corte + barba, barba, colores fantasía, mechas platinadas y platinado global.
- Precios en COP: corte personalizado $ 27.000 (45 min), corte + barba $ 35.000 (60 min), barba $ 15.000 (30 min), colores fantasía $ 120.000 (2 h), mechas platinadas $ 250.000 (4 h, incluye corte), platinado global $ 250.000 (4 h, incluye corte).
- Pago: efectivo o transferencia, en el estudio.

## SEO / GEO

Incluye JSON-LD (`BarberShop` + `FAQPage`), Open Graph/Twitter, `canonical`, `og:url`, `sitemap.xml` y `robots.txt`.
Todas las URLs absolutas apuntan a `https://jaazibarber.netlify.app/`; si algún día se compra un dominio propio,
hay que cambiarlas en `index.html`, `agendar.html`, `revisar.html`, `sitemap.xml` y `robots.txt`.
`llms.txt` contiene los datos reales del negocio.

## Despliegue

El sitio se publica en **Netlify** (cuenta del cliente) y se actualiza solo: cada `git push` a `main` dispara
`.github/workflows/deploy.yml`, que empaqueta los archivos públicos y los sube por la API de Netlify.

- Cuenta Netlify: `jaazielbarber09@gmail.com`. Token de despliegue guardado como secreto del repo
  (`NETLIFY_AUTH_TOKEN` y `NETLIFY_SITE_ID`). Se revoca desde *User settings → Applications → Personal access tokens*.
- GitHub Pages sigue sirviendo la misma copia desde `main`, pero la dirección oficial y el `canonical` son los de Netlify.
