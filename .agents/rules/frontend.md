---
trigger: glob
globs: "*.html, assets/js/**/*.js, assets/css/**/*.css"
description: "Convenciones del frontend estático de Jaazi Barber: JS vanilla sin dependencias, accesibilidad AA, SEO y hora de Colombia."
---

# Frontend

## Estilo del código

- JS vanilla en IIFEs que exponen `window.Jaazi`, `window.JaaziApi` y `window.UI`. Sin módulos ES, sin frameworks, sin bundler.
- Mantén el estilo existente: `var`, funciones con nombre y comentarios de sección `/* ---------- X ---------- */`. No modernices a `let`, `const`, arrow functions o `class` por gusto.
- Los eventos y el DOM se manejan a mano. Si algo requiere una librería, probablemente esté mal planteado.

## Formato y datos

- Dinero con `Jaazi.formatPrice`; horas con `Jaazi.timeLabel`; fechas con `Jaazi.formatLong` / `Jaazi.formatMedium`. No formatees a mano.
- Hora del negocio con `Jaazi.shopNow()` y `Jaazi.todayKey()`. Nunca uses `new Date()` directo para decidir disponibilidad.
- Disponibilidad con `Jaazi.slotsFor(dateKey, duration, busy, excludeCode)`. Antelación con `Jaazi.isTooSoon` / `Jaazi.isLeadBlocked`.
- Los servicios y sus precios viven en `Jaazi.SERVICES`; no los dupliques en el HTML.

## Comportamiento de la agenda (estado actual)

- Un hueco **ocupado** se muestra desactivado.
- Un hueco de hoy que **no cumple la antelación de 1 hora** no se lista.
- Si un día no tiene huecos por la antelación, la tarjeta dice **«Sin margen»**; si está realmente lleno, dice **«Lleno»**.
- Si cambias cualquiera de estos comportamientos, actualiza el texto de `agendar.html` y `revisar.html` para que coincida con lo que ve el cliente.

## Contenido y accesibilidad

- Textos visibles en español de Colombia, con `tú`, claros y breves. Nada de inglés en la interfaz.
- `aria-label` en controles sin texto visible, foco visible, navegación por teclado y gestión de foco al abrir paneles.
- Objetivos táctiles de al menos 44 px, contraste AA y respeto a `prefers-reduced-motion`.
- Un estado nunca se comunica solo con color.

## Rendimiento

- Sin peticiones externas: fuentes autoalojadas en `woff2` e imágenes en AVIF/WebP con `srcset`.
- Si cambias un JS o CSS, sube su `?v=` en las páginas HTML que lo cargan.
