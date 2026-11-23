/* ==========================================================================
   Jaazi Barber — Temporary location change notice modal
   Shows once per device (localStorage). Remove script tag & file when no
   longer needed.
   ========================================================================== */

(function () {
  "use strict";

  var STORAGE_KEY = "jaazi.locationNotice.dismissed.v1";
  var MAPS_URL =
    "https://www.google.com/maps/search/?api=1&query=Calle+12+%239-21+Parque+Principal+Centro+Comercial+Casa+Vieja+Barberia+Monarch+Chia+Cundinamarca+Colombia";
  var EXIT_DURATION_MS = 190;
  var SVG_NS = "http://www.w3.org/2000/svg";

  function isDismissed() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markDismissed() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch (_) {
      /* Ignore storage quota or private-mode restrictions */
    }
  }

  function isPanelPage() {
    return (
      document.documentElement.getAttribute("data-page") === "panel" ||
      (document.body && document.body.getAttribute("data-page") === "panel")
    );
  }

  function createSvgIcon(paths, size) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    for (var i = 0; i < paths.length; i++) {
      var def = paths[i];
      var el = document.createElementNS(SVG_NS, def.tag);
      for (var key in def.attrs) {
        if (Object.prototype.hasOwnProperty.call(def.attrs, key)) {
          el.setAttribute(key, def.attrs[key]);
        }
      }
      svg.appendChild(el);
    }
    return svg;
  }

  function buildModal() {
    var overlay = document.createElement("div");
    overlay.className = "location-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "location-modal-title");
    overlay.setAttribute("aria-describedby", "location-modal-desc");

    var dialog = document.createElement("div");
    dialog.className = "location-modal__dialog";
    dialog.setAttribute("tabindex", "-1");

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "location-modal__close";
    closeBtn.setAttribute("aria-label", "Cerrar aviso de cambio de ubicación");
    closeBtn.appendChild(
      createSvgIcon(
        [
          { tag: "line", attrs: { x1: "18", y1: "6", x2: "6", y2: "18" } },
          { tag: "line", attrs: { x1: "6", y1: "6", x2: "18", y2: "18" } }
        ],
        18
      )
    );

    var bodyLink = document.createElement("a");
    bodyLink.className = "location-modal__body";
    bodyLink.href = MAPS_URL;
    bodyLink.target = "_blank";
    bodyLink.rel = "noopener noreferrer";

    var eyebrow = document.createElement("span");
    eyebrow.className = "location-modal__eyebrow";
    eyebrow.appendChild(
      createSvgIcon(
        [
          {
            tag: "path",
            attrs: {
              d: "M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10z"
            }
          },
          { tag: "circle", attrs: { cx: "12", cy: "11", r: "2.2" } }
        ],
        15
      )
    );
    eyebrow.appendChild(document.createTextNode("Nueva ubicación"));

    var title = document.createElement("h2");
    title.id = "location-modal-title";
    title.className = "location-modal__title";
    title.textContent = "Nos cambiamos de sede";

    var address = document.createElement("p");
    address.id = "location-modal-desc";
    address.className = "location-modal__address";

    var addressLead = document.createElement("strong");
    addressLead.textContent = "Calle 12 #9-21 · Parque Principal de Chía";
    address.appendChild(addressLead);
    address.appendChild(
      document.createTextNode(
        "Centro Comercial Casa Vieja, Barbería Monarch — Chía, Cundinamarca"
      )
    );

    var cta = document.createElement("span");
    cta.className = "location-modal__cta";
    cta.appendChild(document.createTextNode("Abrir en Google Maps"));
    cta.appendChild(
      createSvgIcon(
        [
          { tag: "path", attrs: { d: "M7 17L17 7" } },
          { tag: "path", attrs: { d: "M8 7h9v9" } }
        ],
        16
      )
    );

    var hint = document.createElement("p");
    hint.className = "location-modal__hint";
    hint.textContent = "Toca en el centro para ver cómo llegar";

    bodyLink.appendChild(eyebrow);
    bodyLink.appendChild(title);
    bodyLink.appendChild(address);
    bodyLink.appendChild(cta);
    bodyLink.appendChild(hint);

    dialog.appendChild(closeBtn);
    dialog.appendChild(bodyLink);
    overlay.appendChild(dialog);

    return {
      overlay: overlay,
      dialog: dialog,
      closeBtn: closeBtn,
      bodyLink: bodyLink
    };
  }

  function initLocationNotice() {
    if (!document.body || isPanelPage() || isDismissed()) {
      return;
    }

    var previousFocus = document.activeElement;
    var modal = buildModal();
    var inertSiblings = [];
    var isClosing = false;

    var children = document.body.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var tag = child.tagName;
      if (tag !== "SCRIPT" && tag !== "STYLE" && !child.inert) {
        child.inert = true;
        inertSiblings.push(child);
      }
    }

    document.body.appendChild(modal.overlay);
    document.body.classList.add("modal-open");

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        modal.overlay.classList.add("is-open");
        modal.dialog.focus({ preventScroll: true });
      });
    });

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key === "Tab") {
        var focusables = [modal.closeBtn, modal.bodyLink];
        var currentIndex = focusables.indexOf(document.activeElement);
        event.preventDefault();
        if (event.shiftKey) {
          var prevIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
          focusables[prevIndex].focus();
        } else {
          var nextIndex = currentIndex === -1 || currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1;
          focusables[nextIndex].focus();
        }
      }
    }

    function finishClose() {
      if (modal.overlay.parentNode) {
        modal.overlay.parentNode.removeChild(modal.overlay);
      }
      document.body.classList.remove("modal-open");
      for (var j = 0; j < inertSiblings.length; j++) {
        inertSiblings[j].inert = false;
      }
      document.removeEventListener("keydown", onKeyDown);

      if (previousFocus && typeof previousFocus.focus === "function" && previousFocus.isConnected) {
        previousFocus.focus();
      }
    }

    function closeModal() {
      if (isClosing) return;
      isClosing = true;
      markDismissed();
      modal.overlay.classList.remove("is-open");

      var reducedMotion =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(finishClose, reducedMotion ? 20 : EXIT_DURATION_MS);
    }

    modal.closeBtn.addEventListener("click", closeModal);
    modal.overlay.addEventListener("click", function (event) {
      if (event.target === modal.overlay) {
        closeModal();
      }
    });
    modal.bodyLink.addEventListener("click", function () {
      closeModal();
    });
    document.addEventListener("keydown", onKeyDown);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLocationNotice);
  } else {
    initLocationNotice();
  }
})();
