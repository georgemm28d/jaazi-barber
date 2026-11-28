# Jaazi Barber — contexto del proyecto

Sitio de reservas y agenda para una barbería de **una sola silla** en Chía, Cundinamarca (Colombia). Proyecto real de principio a fin: diseño, frontend, modelo de datos, SQL, despliegue y QA.

- Producción: <https://jaazi-barber.pages.dev/> · Respaldo: <https://georgemm28d.github.io/jaazi-barber/>
- Backend: Supabase (Postgres + RLS + RPC), proyecto `jaazi-barber` (`kavtsigejtugsyiisvsz`).
- Idioma del producto, de la documentación y de los commits: **español**.

## Cómo ejecutar

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Abre <http://127.0.0.1:4173/>. Sin Supabase configurado, la reserva funciona en modo local con `localStorage`; el panel privado necesita el backend real. No hay `npm install`, ni `node_modules`, ni paso de compilación para desarrollar.

## Mapa del repositorio

| Ruta | Qué es |
|---|---|
| `index.html` | Web pública: servicios, estudio, trabajo, FAQ, JSON-LD |
| `agendar.html` | Reserva en 3 pasos (servicio → día y hora → datos) |
| `revisar.html` | Consultar, cambiar o cancelar solo con teléfono |
| `privacidad.html` | Política de tratamiento (Ley 1581 de 2012) |
| `panel.html` | Panel privado con Supabase Auth (`noindex`) |
| `panel-demo.html` | Copia del panel con datos ficticios, sin backend |
| `assets/js/config.js` | URL y `anon key` de Supabase; vacío = modo local |
| `assets/js/api.js` | REST + RPC y traducción de errores a mensajes |
| `assets/js/store.js` | Servicios, horarios, zonas, `slotsFor`, reglas de agenda |
| `assets/js/booking.js` | Flujo de reserva |
| `assets/js/review.js` | Flujo de consulta y cambio de cita |
| `assets/js/panel.js` | Panel del barbero |
| `assets/js/site.js` | Navegación, tema y `window.UI` |
| `supabase/schema.sql` | Esquema completo: tablas, vista, RLS, funciones |
| `supabase/migrations/` | Migraciones incrementales `YYYY-MM-DD-slug.sql` |
| `build.sh` | Build de Cloudflare Pages: copia lo público a `dist/` |
| `docs/` | `operacion.md` (mantenimiento) y `qa.md` (evidencia) |

## Invariantes del negocio

1. **Una sola silla.** No hay recursos paralelos: dos citas activas no pueden solaparse.
2. **Hora de Colombia siempre.** `America/Bogota` (UTC-5), nunca la del visitante ni UTC. En el frontend, `Jaazi.shopNow()`; en SQL, `now() at time zone 'America/Bogota'`.
3. **Horario.** Lunes a sábado 9:00–19:00; domingo 12:00–17:00. La hora de cierre es el **último inicio permitido**, no el fin del servicio.
4. **Antelación mínima de 1 hora** para citas del mismo día: `LEAD = 60` en `store.js` y la misma regla en `create_booking`/`reschedule_booking`. Las dos partes se cambian juntas.
5. **Franjas de 30 minutos.** `STEP = 30`.
6. **Estados:** `confirmed`, `completed`, `cancelled`. Las reservas nuevas entran como `confirmed`.
7. **Solo teléfono** para gestionar una cita (`lookup_bookings(p_phone)` devuelve nombre completo y datos de la cita sin correo ni notas; `cancel_booking` y `reschedule_booking` usan el código interno + teléfono de la tarjeta elegida). No hay cuentas de cliente.
8. **Disponibilidad sin datos personales:** el cliente solo lee `public_busy` (fecha, inicio y fin).

## Reglas técnicas que no se negocian

- **La base de datos es la fuente de verdad.** El JS muestra lo que la base confirma; no implementes reglas de negocio solo en el cliente.
- **El frontend nunca consulta `bookings` ni `blocks`.** Solo `public_busy` y funciones RPC.
- **Nunca commitear** `service_role`, la API key de Resend, `.env` ni datos reales de clientes. La `anon key` es pública por diseño.
- **Sin dependencias nuevas.** Nada de frameworks, bundlers, CDNs ni `package.json`. JS vanilla con IIFEs (`window.Jaazi`, `window.JaaziApi`, `window.UI`).
- **No editar `dist/`**: se genera en el despliegue.
- **Al cambiar un asset**, actualiza su `?v=` en el HTML que lo referencia para romper caché.
- **Accesibilidad y SEO son requisitos:** foco gestionado, teclado, objetivos táctiles de 44 px, contraste AA, `prefers-reduced-motion`, HTML semántico, JSON-LD, `sitemap.xml` y `llms.txt`.

## Errores de la API

Los RPC lanzan códigos estables y `assets/js/api.js` los traduce a español: `service_not_found`, `invalid_name`, `invalid_phone`, `invalid_slot`, `outside_hours`, `slot_taken`, `too_soon`, `booking_not_found`. Si agregas uno, agrégalo al mapa de mensajes y a los reintentos de `booking.js`/`review.js`.

## Verificación antes de dar algo por terminado

1. `node --check` sobre cada JS que toques.
2. Servir con `python -m http.server 4173` y probar: reservar, consultar, cambiar fecha/hora, cancelar, reintento de disponibilidad.
3. Revisar 320 y 390 px sin desbordamiento horizontal.
4. Si tocaste SQL: la migración debe ser idempotente y `supabase/schema.sql` debe quedar sincronizado.

## Despliegue

`git push` a `main` dispara **Cloudflare Pages** (`bash build.sh` → `dist/`) y **GitHub Pages**. Cloudflare suele tardar menos de un minuto. `docs/`, `supabase/`, `.agents/` y este archivo no se publican en Cloudflare; en GitHub Pages sí quedan accesibles.

## Documentación de referencia

- `docs/operacion.md` — Supabase, migraciones, despliegue y respaldo.
- `docs/qa.md` — mediciones, método y pendientes.
- `supabase/schema.sql` — esquema, RLS y funciones.
