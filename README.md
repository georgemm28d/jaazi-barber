# Jaazi Barber

Sitio web estático de **Jaazi Barber**, barbería independiente en Roma Norte, CDMX.
Tres páginas en español, sin build ni dependencias: HTML, CSS y JavaScript vanilla.

> ⚠️ Demo para feedback: los datos de contacto, dirección y reseñas son ficticios.
> El teléfono y el dominio definitivos están pendientes de sustituir.

## Páginas

- `index.html` — home: hero, servicios y precios, estudio, reseñas, FAQ y CTA.
- `agendar.html` — reserva en 3 pasos (servicio → día/hora → datos) con confirmación, código y `.ics`.
- `revisar.html` — consulta por código o teléfono, cancelación con Deshacer y añadir al calendario.

Las reservas se guardan en `localStorage` (`jaazi.bookings.v1`); no hay backend.
Disponibilidad: martes a sábado, 10:00–20:00, franjas de 30 min, 2 h de antelación.

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
`https://jaazibarber.mx/`; el preview de GitHub Pages es solo para revisión.
