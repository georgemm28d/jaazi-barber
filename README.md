# Jaazi Barber

Sitio web de **Jaazi Barber**, barbería de una sola silla en **Chía, Cundinamarca (Colombia)**.
Páginas en español, sin build: HTML, CSS y JavaScript vanilla. La agenda compartida vive en **Supabase** (Postgres + API REST + Auth); el sitio se publica como archivos estáticos en GitHub Pages.

> Publicado en GitHub Pages: **https://georgemm28d.github.io/jaazi-barber/**. El **dominio** propio queda pendiente.
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

### Puesta en marcha

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Abrir **SQL Editor** y ejecutar `supabase/schema.sql`. Crea:
   - `services` (precio y duración autoritativos), `bookings`, `blocks` y `admins`.
   - La vista `public_busy`, que expone solo fecha, hora y duración de lo ocupado.
   - Las funciones `create_booking`, `lookup_bookings` y `cancel_booking` (`SECURITY DEFINER`).
   - RLS: nadie anónimo puede leer `bookings`; solo se llega a los datos por las funciones, con código o teléfono.
3. En **Authentication → Users**, crear el usuario del panel con el correo **jaazielbarber09@gmail.com** y una contraseña. No hace falta registro público.
   - Si usas otro correo, actualízalo en la tabla `admins` (`update public.admins set email = 'nuevo@correo.com';`). El panel solo lee datos si el correo autenticado está en esa tabla.
   - En **Authentication → Providers → Email**, desactiva *Enable signups* para que nadie pueda crearse una cuenta.
4. Copiar **Project URL** y **anon public key** (Settings → API) en `assets/js/config.js`.
5. Publicar: `git push` a `main`. GitHub Pages sirve los archivos tal cual.

### Seguridad

- `bookings` y `blocks` tienen RLS y no se pueden leer con la `anon key`.
- Los clientes solo llegan a sus citas por `create_booking`, `lookup_bookings` y `cancel_booking` (código o teléfono).
- El panel exige sesión y que el correo esté en la tabla `admins`; el resto de cuentas autenticadas no ve nada.
- La `anon key` es pública por diseño: las reglas de la base de datos son las que protegen los datos personales.
- Cancelar exige código + teléfono; quien conozca ambos puede gestionar la cita.

### Reglas de negocio

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

Incluye JSON-LD (`BarberShop` + `FAQPage`), Open Graph/Twitter y `robots.txt`.
El `canonical`, `og:url` y `sitemap.xml` se añadirán cuando exista el dominio definitivo;
`llms.txt` ya contiene los datos reales del negocio.
