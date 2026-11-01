# Jaazi Barber

Sitio web estático de **Jaazi Barber**, barbería de una sola silla en **Chía, Cundinamarca (Colombia)**.
Tres páginas en español, sin build ni dependencias: HTML, CSS y JavaScript vanilla.

> Publicado en GitHub Pages: **https://georgemm28d.github.io/jaazi-barber/**. El **dominio** propio queda pendiente.
> Incluye tema claro/oscuro (preferencia del sistema + toggle persistente en el navegador).

## Páginas

- `index.html` — home: hero, servicios, el estudio, trabajo reciente, FAQ y CTA.
- `agendar.html` — reserva en 3 pasos (servicio → día/hora → datos) con confirmación, código y `.ics`.
- `revisar.html` — consulta por código o teléfono, cancelación con Deshacer y añadir al calendario.

Las reservas se guardan en `localStorage` (`jaazi.bookings.v2`); no hay backend.
Disponibilidad: **todos los días, 9:00–19:00**, franjas de 30 min y 2 h de antelación para hoy.

## Estructura

```
assets/
  css/      site.css, booking.css
  js/       store.js, site.js, booking.js, review.js
  fonts/    Fraunces + Inter (woff2, self-hosted)
  img/      jaazi-retrato.jpg, trabajo-01…06.jpg, trabajo-estudio.jpg
```

## Ver en local

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:4173/`.

## Datos de la versión actual

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
