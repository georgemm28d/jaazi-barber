/* =========================================================
   Jaazi Barber — Service Worker (PWA Clientes + Panel)
   - Nunca cachea peticiones externas ni API de Supabase.
   - Documentos HTML: network-first con respaldo offline.
   - Estáticos propios: stale-while-revalidate.
   ========================================================= */

var CACHE_NAME = "jaazi-pwa-v1";
var PRECACHE_URLS = [
  "/",
  "/index.html",
  "/agendar.html",
  "/revisar.html",
  "/privacidad.html",
  "/manifest.webmanifest",
  "/assets/favicon.svg?v=2",
  "/assets/apple-touch-icon.png?v=2",
  "/assets/img/pwa/icon-192.png",
  "/assets/img/pwa/icon-512.png",
  "/assets/fonts/fonts.css",
  "/assets/fonts/fraunces-latin.woff2",
  "/assets/fonts/fraunces-latin-italic.woff2",
  "/assets/fonts/inter-latin.woff2",
  "/assets/css/site.css?v=3",
  "/assets/css/booking.css?v=2",
  "/assets/js/config.js",
  "/assets/js/api.js?v=3",
  "/assets/js/store.js",
  "/assets/js/site.js?v=3",
  "/assets/js/booking.js?v=2",
  "/assets/js/review.js?v=2"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function () {
        /* Si algún archivo puntual falla en local, no bloquear la instalación */
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) return caches.delete(key);
          return Promise.resolve();
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }

  /* Nunca interceptar orígenes externos (Supabase REST/Auth, etc.) ni el propio SW */
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  /* Navegación HTML: siempre intentar red primero para traer el último deploy */
  if (req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") >= 0) {
    event.respondWith(
      fetch(req).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match("/index.html");
        });
      })
    );
    return;
  }

  /* Recursos estáticos del mismo origen: caché rápida + refresco en segundo plano */
  event.respondWith(
    caches.match(req).then(function (cached) {
      var networkFetch = fetch(req).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });
      return cached || networkFetch;
    })
  );
});
