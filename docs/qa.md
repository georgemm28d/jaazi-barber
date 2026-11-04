# Evidencia de QA

Mediciones hechas el **4 de noviembre de 2026** sobre el sitio en vivo y una copia local, con Chromium, Playwright, axe-core y el validador W3C Nu. No se crearon citas reales: las pruebas de flujo usaron el modo local y entornos aislados.

## Resumen

| Área | Resultado |
|---|---|
| HTML (W3C Nu) | **0 errores** en las 6 páginas del repositorio |
| Accesibilidad (axe-core) | **0 violaciones** WCAG 2.0/2.1 A/AA en home, reserva, revisión y demo |
| Contraste | **5.76:1 / 6.48:1** y **5.25:1 / 6.94:1** |
| Objetivos táctiles | **44 px** en los controles medidos a 390 y 320 px |
| Desbordamiento horizontal | **0 px** a 320 y 390 px |
| Flujos de reserva | Reservar, consultar, cambiar fecha/hora, cancelar y reintentar disponibilidad |
| Consola | **0 errores** en las páginas probadas |
| Rendimiento | **300 KB, 16 peticiones, CLS 0.0009** en móvil |

## HTML

Validado con `validator.w3.org/nu` por POST del HTML fuente:

- `index.html`, `agendar.html`, `revisar.html`, `privacidad.html`: 0 errores.
- `panel.html` y `panel-demo.html`: 0 errores.

El HTML **servido por Netlify** añade 2 errores (`Stray start tag "script"` y `Cannot recover after last error`) porque el plan Free inyecta `/.netlify/scripts/hud` después de `</html>`. No viene del repositorio; la copia de GitHub Pages valida con 0 errores. Está documentado en [`operacion.md`](operacion.md).

## Accesibilidad

axe-core 4.10.3, reglas `wcag2a`, `wcag2aa`, `wcag21a` y `wcag21aa`, a 390×844:

| Página | Violaciones |
|---|---:|
| Home | 0 |
| Agendar (paso 1) | 0 |
| Revisar | 0 |
| Demo del panel | 0 |

Comprobaciones manuales:

- Skip link y landmarks en todas las páginas.
- Foco al abrir “Cambiar cita”, retorno con `Escape` y `aria-live="polite"` durante la carga.
- Diálogo de cancelación con foco en “Mantener” y cierre sin perder el contexto.
- Pestañas de la demo con `role="tab"`, `aria-selected` y flechas izquierda/derecha, `Home` y `End`.
- `prefers-reduced-motion` desactiva revelados, hover y transiciones.

**Contraste:** 5.76:1 (claro) y 6.48:1 (oscuro) en texto secundario; 5.25:1 y 6.94:1 en tarjetas de historial. Todos superan AA.

**Objetivos táctiles:** enlaces del footer, acciones de cita, botones de cancelación, “Volver”, `.link-btn`, pestañas y botones de la demo miden al menos 44 px de alto.

## Móvil y responsive

- 320×568 y 390×844: sin desbordamiento horizontal en home, revisar y demo.
- El editor de cambio de cita no desborda su panel a 320 px.
- La demo apila métricas, pestañas y tarjetas sin romper el layout.

## Flujos probados

- **Disponibilidad:** fallo simulado de `public_busy` → 0 fechas, aviso y botón “Reintentar”; al reintentar, 21 fechas reales.
- **Reserva:** servicio → día/hora → datos → confirmación con código `JZ-XXXXXX`.
- **Consulta:** código + teléfono; un dato suelto no devuelve la cita.
- **Cambio:** solo mueve fecha y hora; conserva servicio, duración, precio y datos del cliente.
- **Cancelación:** confirmación explícita y liberación del horario.
- **Demo del panel:** confirmar, completar, cancelar con confirmación, añadir y quitar bloqueos.
- **Código local:** 6 caracteres, igual que el backend.

## Rendimiento

Medición de la portada a 390×844, DPR 2, con red del entorno de pruebas:

| Métrica | Antes | Después |
|---|---:|---:|
| Transferencia móvil | 540 KB | **300 KB** |
| Peticiones móvil | 16 | **16** |
| Transferencia escritorio | — | **366 KB** |
| Fuentes | 193 KB | **183 KB** (Inter subset) |
| Imagen del héroe | 200 KB | **36.7 KB** (900w AVIF) |
| CLS | 0.0009 | **0.0009** |
| LCP | 6.0 s* | **2.2–6.3 s*** |

\* El LCP depende mucho de la latencia de la red en este entorno: la última pasada dio **2.24 s** en móvil; no es un dato de campo ni una medición Lighthouse. El CLS es el dato más estable.

**Optimización aplicada:** el héroe usa `<picture>` con AVIF, WebP y JPEG, `srcset` de 600/900/1200 y `sizes`; la galería y la foto del estudio tienen AVIF/WebP con fallback JPEG; Inter se sirvió subseteado. La imagen del héroe conserva `fetchpriority="high"` y dimensiones explícitas.

**Pendiente de optimización:** subset o instancing de Fraunces (las dos variantes siguen pesando 66 y 80 KB), medir con Lighthouse/PSI y validar en red 4G real. Objetivo: bajar de 300 KB y estabilizar el LCP por debajo de 2.5 s.

## Seguridad y datos

- `bookings` y `blocks` tienen RLS; el rol anónimo no puede leerlas.
- `public_busy` expone solo fecha, inicio y fin; nunca nombre, teléfono, correo o código.
- Consultar, cambiar y cancelar exigen **código + teléfono** mediante funciones `SECURITY DEFINER`.
- `create_booking` y `reschedule_booking` validan jornada, zona `America/Bogota`, bloqueos y solapamientos en una transacción.
- La `anon key` es pública por diseño; la `service_role` no aparece en el cliente ni en el repositorio.
- La API key de Resend vive en Vault y solo la lee una función `SECURITY DEFINER`; nunca llega al navegador.
- No hay credenciales en el código. El token de Netlify vive en los secretos de GitHub Actions.

## Cobertura y límites

- **Navegador:** Chromium (Playwright). Falta probar Safari/iOS y Firefox en dispositivos reales.
- **Lectores de pantalla:** no se hicieron pruebas con NVDA, VoiceOver ni TalkBack.
- **Rendimiento:** sin Lighthouse/PSI ni datos de campo; la cifra de LCP es orientativa.
- **Netlify:** el badge y el script inyectado son una limitación del plan Free.
- **Google Business Profile:** no hay perfil verificable enlazado todavía.
- **Correo:** el trigger de avisos está implementado; el envío real queda pendiente de crear la cuenta de Resend y guardar la API key en Vault.

## Cómo reproducir

```bash
python -m http.server 4173 --bind 127.0.0.1
```

- HTML: `https://validator.w3.org/nu/?doc=<url>` o POST del archivo.
- Accesibilidad: extensión axe DevTools o `axe-core` inyectado con Playwright.
- Flujos: reserva en `agendar.html`, consulta en `revisar.html`, panel en `panel-demo.html`.

Las pruebas de este informe se ejecutaron con scripts locales de Playwright; no se versionan porque dependen de datos y entornos efímeros. La evidencia prioriza resultados verificables sobre capturas.
