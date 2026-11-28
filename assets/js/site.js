/* =========================================================
   Jaazi Barber — comportamiento global
   ========================================================= */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  /* ---------- Header ---------- */

  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Tema claro / oscuro ---------- */

  var themeToggle = document.querySelector("[data-theme-toggle]");
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var themeMedia = window.matchMedia("(prefers-color-scheme: dark)");

  function storedTheme() {
    try { return localStorage.getItem("jaazi.theme"); } catch (err) { return null; }
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme, persist) {
    var dark = theme === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    if (themeMeta) themeMeta.setAttribute("content", dark ? "#0b0c0e" : "#f4f5f7");
    if (themeToggle) {
      var label = dark ? "Desactivar modo oscuro" : "Activar modo oscuro";
      themeToggle.setAttribute("aria-pressed", dark ? "true" : "false");
      themeToggle.setAttribute("aria-label", label);
      themeToggle.setAttribute("title", label);
    }
    if (persist) {
      try { localStorage.setItem("jaazi.theme", dark ? "dark" : "light"); } catch (err) { /* noop */ }
    }
  }

  applyTheme(currentTheme(), false);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
    });
  }

  var onSchemeChange = function (event) {
    if (!storedTheme()) applyTheme(event.matches ? "dark" : "light", false);
  };
  if (themeMedia.addEventListener) themeMedia.addEventListener("change", onSchemeChange);
  else themeMedia.addListener(onSchemeChange);

  window.addEventListener("storage", function (event) {
    if (event.key !== "jaazi.theme" || !event.newValue) return;
    applyTheme(event.newValue === "dark" ? "dark" : "light", false);
  });

  /* ---------- Menú móvil ---------- */

  var toggle = document.querySelector(".menu-toggle");
  var toggleLabel = toggle ? toggle.querySelector(".menu-toggle__label") : null;
  var menu = document.getElementById("mobile-menu");
  var lastFocus = null;
  var closeTimer = null;

  function menuIsOpen() {
    return toggle && toggle.getAttribute("aria-expanded") === "true";
  }

  function openMenu() {
    if (!toggle || !menu) return;
    clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    toggle.setAttribute("aria-expanded", "true");
    if (toggleLabel) toggleLabel.textContent = "Cerrar";
    menu.hidden = false;
    void menu.offsetWidth;
    menu.classList.add("is-open");
    document.body.classList.add("menu-open");
    document.querySelectorAll("main, .site-footer").forEach(function (el) {
      el.setAttribute("inert", "");
    });
    var first = menu.querySelector("a, button");
    if (first) first.focus({ preventScroll: true });
  }

  function closeMenu(restoreFocus) {
    if (!toggle || !menu || !menuIsOpen()) return;
    toggle.setAttribute("aria-expanded", "false");
    if (toggleLabel) toggleLabel.textContent = "Menú";
    menu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    document.querySelectorAll("main, .site-footer").forEach(function (el) {
      el.removeAttribute("inert");
    });
    closeTimer = setTimeout(function () {
      menu.hidden = true;
    }, 210);
    if (restoreFocus) {
      toggle.focus({ preventScroll: true });
    } else if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      if (menuIsOpen()) closeMenu(true);
      else openMenu();
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menuIsOpen()) closeMenu(true);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Tab" || !menuIsOpen()) return;
      var items = [toggle].concat(
        Array.prototype.slice.call(menu.querySelectorAll("a[href], button"))
      ).filter(function (el) { return el.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    var desktop = window.matchMedia("(min-width: 901px)");
    var onDesktop = function (event) {
      if (event.matches) closeMenu(false);
    };
    if (desktop.addEventListener) desktop.addEventListener("change", onDesktop);
    else desktop.addListener(onDesktop);
  }

  /* ---------- Revelado al hacer scroll ---------- */

  var revealItems = document.querySelectorAll("[data-reveal]");
  if (revealItems.length) {
    if (!("IntersectionObserver" in window)) {
      revealItems.forEach(function (el) { el.classList.add("is-in"); });
    } else {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

      revealItems.forEach(function (el) {
        if (el.dataset.delay) {
          el.style.setProperty("--d", el.dataset.delay + "ms");
        }
        observer.observe(el);
      });
    }
  }

  /* ---------- Próximo hueco (home) ---------- */

  var nextSlot = document.querySelector("[data-next-slot]");
  if (nextSlot && window.Jaazi) {
    var nextApi = window.JaaziApi && window.JaaziApi.enabled ? window.JaaziApi : null;

    var paintNext = function (found) {
      if (found) {
        var today = Jaazi.todayKey();
        var tomorrow = Jaazi.keyOf(Jaazi.addDays(Jaazi.shopNow(), 1));
        var prefix = found.date === today ? "hoy" : found.date === tomorrow ? "mañana" : "el " + Jaazi.formatMedium(found.date);
        nextSlot.textContent = prefix + " · " + Jaazi.timeLabel(found.time).replace(" ", "\u00a0");
      } else {
        nextSlot.textContent = "consulta la agenda";
      }
    };

    if (nextApi) {
      nextApi.busy(Jaazi.todayKey(), Jaazi.keyOf(Jaazi.addDays(Jaazi.shopNow(), 20))).then(function (map) {
        paintNext(Jaazi.nextAvailable("corte-personalizado", 14, map));
      }, function () {
        paintNext(null);
      });
    } else {
      paintNext(Jaazi.nextAvailable("corte-personalizado", 14));
    }
  }

  /* ---------- Toasts ---------- */

  var region = null;

  function ensureRegion() {
    if (region) return region;
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "false");
    document.body.appendChild(region);
    return region;
  }

  function toast(message, options) {
    options = options || {};
    var host = ensureRegion();
    var el = document.createElement("div");
    el.className = "toast";

    var text = document.createElement("span");
    text.textContent = message;
    el.appendChild(text);

    var timer = null;

    function dismiss() {
      clearTimeout(timer);
      el.classList.add("is-leaving");
      el.classList.remove("is-in");
      setTimeout(function () { el.remove(); }, 240);
    }

    function startTimer() {
      if (!options.actionLabel) {
        timer = setTimeout(dismiss, options.duration || 5200);
      } else {
        timer = setTimeout(dismiss, options.duration || 8000);
      }
    }

    if (options.actionLabel) {
      var action = document.createElement("button");
      action.type = "button";
      action.textContent = options.actionLabel;
      action.addEventListener("click", function () {
        if (typeof options.onAction === "function") options.onAction();
        dismiss();
      });
      el.appendChild(action);
    }

    host.appendChild(el);
    void el.offsetWidth;
    el.classList.add("is-in");
    startTimer();

    el.addEventListener("mouseenter", function () { clearTimeout(timer); });
    el.addEventListener("mouseleave", startTimer);
    el.addEventListener("focusin", function () { clearTimeout(timer); });
    el.addEventListener("focusout", startTimer);

    return { dismiss: dismiss };
  }

  /* ---------- PWA: Service Worker e instalación ---------- */

  var isPanelApp = document.body && document.body.getAttribute("data-page") === "panel" &&
    window.location.pathname.indexOf("panel-demo") < 0;
  var INSTALL_KEY = isPanelApp ? "jaazi.pwa.installed.panel" : "jaazi.pwa.installed.client";
  var deferredInstall = null;
  var pwaModal = null;
  var pwaLastFocus = null;

  function isRunningStandalone() {
    try {
      if (window.navigator.standalone === true) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: minimal-ui)").matches) return true;
    } catch (err) { /* noop */ }
    return false;
  }

  function readInstalledFlag() {
    try { return localStorage.getItem(INSTALL_KEY) === "1"; } catch (err) { return false; }
  }

  function writeInstalledFlag(installed) {
    try {
      if (installed) localStorage.setItem(INSTALL_KEY, "1");
      else localStorage.removeItem(INSTALL_KEY);
    } catch (err) { /* noop */ }
  }

  function setInstallButtonsVisible(visible) {
    var buttons = document.querySelectorAll("[data-pwa-install]");
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.hidden = !visible;
      var parentLi = btn.parentElement && btn.parentElement.tagName === "LI" ? btn.parentElement : null;
      if (parentLi) parentLi.hidden = !visible;
    });
  }

  function syncInstallVisibility() {
    if (isRunningStandalone() || readInstalledFlag()) {
      setInstallButtonsVisible(false);
    } else {
      setInstallButtonsVisible(true);
    }
  }

  syncInstallVisibility();

  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then(function (apps) {
      var target = isPanelApp ? "panel.webmanifest" : "manifest.webmanifest";
      var found = (apps || []).some(function (app) {
        return app && app.url && app.url.indexOf(target) >= 0;
      });
      if (found) {
        writeInstalledFlag(true);
        setInstallButtonsVisible(false);
      }
    }).catch(function () { /* noop */ });
  }

  if (window.matchMedia) {
    var standaloneMedia = window.matchMedia("(display-mode: standalone)");
    var onStandaloneChange = function (e) {
      if (e.matches) setInstallButtonsVisible(false);
    };
    if (standaloneMedia.addEventListener) standaloneMedia.addEventListener("change", onStandaloneChange);
    else if (standaloneMedia.addListener) standaloneMedia.addListener(onStandaloneChange);
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredInstall = event;
    writeInstalledFlag(false);
    if (!isRunningStandalone()) setInstallButtonsVisible(true);
  });

  window.addEventListener("appinstalled", function () {
    deferredInstall = null;
    writeInstalledFlag(true);
    setInstallButtonsVisible(false);
    closePwaModal();
    toast(isPanelApp ? "Panel instalado como aplicación." : "Aplicación instalada en tu dispositivo.");
  });

  function detectInstallPlatform() {
    var ua = navigator.userAgent || "";
    var isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "desktop";
  }

  function closePwaModal() {
    if (!pwaModal) return;
    pwaModal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    var node = pwaModal;
    pwaModal = null;
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 200);
    if (pwaLastFocus && typeof pwaLastFocus.focus === "function") {
      pwaLastFocus.focus({ preventScroll: true });
    }
  }

  function openPwaModal(trigger) {
    if (pwaModal) return;
    pwaLastFocus = trigger || document.activeElement;
    var platform = detectInstallPlatform();
    var appTitle = isPanelApp ? "Panel Jaazi" : "Jaazi Barber";
    var stepsHtml = "";

    if (platform === "ios") {
      stepsHtml =
        "<li>Toca el botón <strong>Compartir</strong> (el cuadrado con flecha hacia arriba) en la barra de Safari.</li>" +
        "<li>Desliza las opciones y elige <strong>Agregar a inicio</strong>.</li>" +
        "<li>Toca <strong>Agregar</strong> arriba a la derecha para instalar <strong>" + appTitle + "</strong>.</li>";
    } else if (platform === "android") {
      stepsHtml =
        "<li>Abre el menú <strong>⋮</strong> en la esquina superior derecha de tu navegador.</li>" +
        "<li>Toca <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.</li>" +
        "<li>Confirma en <strong>Instalar</strong>.</li>";
    } else {
      stepsHtml =
        "<li>En Chrome o Edge, haz clic en el icono <strong>Instalar</strong> a la derecha de la barra de direcciones (o menú <strong>⋮ → Guardar y compartir → Instalar página como app</strong>).</li>" +
        "<li>En Safari para Mac, abre <strong>Archivo → Agregar al Dock</strong>.</li>";
    }

    var wrap = document.createElement("div");
    wrap.className = "location-modal pwa-modal";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "pwa-modal-title");
    wrap.innerHTML =
      '<div class="location-modal__dialog pwa-modal__dialog" tabindex="-1">' +
        '<button class="location-modal__close" type="button" data-pwa-close aria-label="Cerrar instrucciones">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
        "</button>" +
        '<div class="pwa-modal__content">' +
          '<span class="location-modal__eyebrow">Acceso directo</span>' +
          '<h2 class="location-modal__title" id="pwa-modal-title">Instalar ' + appTitle + "</h2>" +
          '<ol class="pwa-modal__steps">' + stepsHtml + "</ol>" +
          '<button class="btn btn--sm btn--block" type="button" data-pwa-close>Entendido</button>' +
        "</div>" +
      "</div>";

    document.body.appendChild(wrap);
    document.body.classList.add("modal-open");
    pwaModal = wrap;

    void wrap.offsetWidth;
    wrap.classList.add("is-open");

    var closeBtn = wrap.querySelector("[data-pwa-close]");
    if (closeBtn) closeBtn.focus({ preventScroll: true });

    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || e.target.closest("[data-pwa-close]")) {
        closePwaModal();
      }
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && pwaModal) {
      closePwaModal();
    }
  });

  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-pwa-install]");
    if (!btn) return;
    event.preventDefault();

    if (menuIsOpen()) closeMenu(false);

    if (deferredInstall) {
      var promptEvent = deferredInstall;
      deferredInstall = null;
      promptEvent.prompt();
      if (promptEvent.userChoice) {
        promptEvent.userChoice.then(function (choice) {
          if (choice && choice.outcome === "accepted") {
            writeInstalledFlag(true);
            setInstallButtonsVisible(false);
          }
        }).catch(function () { /* noop */ });
      }
      return;
    }

    openPwaModal(btn);
  });

  if ("serviceWorker" in navigator &&
      (window.location.protocol === "https:" ||
       window.location.hostname === "localhost" ||
       window.location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () { /* noop */ });
    });
  }

  window.UI = { toast: toast };
})();
