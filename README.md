# Jaazi Barber

Sitio web estático de **Jaazi Barber**, barbería en Colombia.
Tres páginas en español, sin build ni dependencias: HTML, CSS y JavaScript vanilla.

> ⚠️ Sitio en actualización: se están incorporando los datos reales del negocio
> (ciudad, precios y servicios). La publicación en GitHub Pages está pausada.

## Páginas

- `index.html` — home: hero, servicios y precios, estudio, reseñas, FAQ y CTA.
- `agendar.html` — reserva en 3 pasos (servicio → día/hora → datos) con confirmación, código y `.ics`.
- `revisar.html` — consulta por código o teléfono, cancelación con Deshacer y añadir al calendario.

Las reservas se guardan en `localStorage` (`jaazi.bookings.v1`); no hay backend.
Disponibilidad actual del código: martes a sábado, 10:00–20:00, franjas de 30 min,
2 h de antelación (pendiente de actualizar a todos los días, 9:00–19:00).

## Estructura

```
assets/
  css/      site.css, booking.css
  js/       store.js, site.js, booking.js, review.js
  fonts/    Fraunces + Inter (woff2, self-hosted)
  img/      hero.jpg, estudio.jpg
```

## Ver en local

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:4173/`.

## SEO / GEO

Incluye JSON-LD (`BarberShop` + `FAQPage`), canonical/OG/Twitter, `robots.txt`,
`sitemap.xml` y `llms.txt`. Las URLs canónicas apuntan al dominio final
`https://jaazibarber.mx/`. La publicación permanece pausada hasta completar los
datos reales del negocio.
