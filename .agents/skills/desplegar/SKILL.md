---
name: desplegar
description: Publica Jaazi Barber en Cloudflare Pages y GitHub Pages con un push a main y verifica que el sitio en vivo sirva los archivos nuevos. Úsala cuando el usuario pida desplegar, publicar, subir cambios o comprobar que un cambio ya está en producción.
---

# Desplegar Jaazi Barber

## Antes de subir

1. `node --check` de cada JS modificado.
2. `git status` y `git diff`: sin secretos, sin datos de clientes, sin `dist/`.
3. Mensaje de commit en español, imperativo y específico (qué cambia y por qué).

## Pasos

1. `git add -A && git commit -m "<mensaje>" && git push origin main`
2. Cloudflare Pages reconstruye solo (`bash build.sh` → `dist/`). GitHub Pages publica `main` tal cual.
3. Verificar sin caché, buscando una cadena única del cambio (no solo el estado 200):
   - `https://jaazi-barber.pages.dev/assets/js/<archivo>.js?v=<timestamp>`
   - `https://georgemm28d.github.io/jaazi-barber/assets/js/<archivo>.js?v=<timestamp>`
4. Abrir `https://jaazi-barber.pages.dev/` y recorrer el flujo afectado.

## Si no aparece

- `gh run list --limit 3` para el workflow de GitHub Pages.
- Revisar el último deployment en el panel de Cloudflare Pages.
- Forzar recarga con `Ctrl+F5`; la caché de Cloudflare no se configura a medida.

## Notas

- `docs/`, `supabase/`, `qa/`, `AGENTS.md` y `.agents/` no se publican en Cloudflare.
- No edites `dist/`: se regenera en cada build.
