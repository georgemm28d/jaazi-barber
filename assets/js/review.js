/* =========================================================
   Jaazi Barber — revisar y gestionar citas
   ========================================================= */

(function () {
  "use strict";

  var form = document.getElementById("lookup-form");
  var input = document.getElementById("lookup");
  var error = document.getElementById("lookup-error");
  var listEl = document.getElementById("appointments");
  var countEl = document.getElementById("appt-count");
  var statusEl = document.getElementById("lookup-status");
  var titleEl = document.getElementById("appts-title");
  if (!form || !listEl || !window.Jaazi) return;

  var state = { query: "" };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mapsUrl = "https://www.google.com/maps/search/?api=1&query=Calle+4+%231-39+Conjunto+Serralta+Chia+Cundinamarca+Colombia";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cap(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function matches(booking, query) {
    var q = query.trim().toLowerCase();
    if (!q) return true;
    if (booking.code.toLowerCase() === q) return true;
    var digits = normalizePhone(q);
    var phone = normalizePhone(booking.phone);
    if (digits.length >= 7 && phone) {
      return phone === digits || (phone.length >= 10 && phone.slice(-10) === digits.slice(-10));
    }
    return false;
  }

  function sortList(list) {
    var upcoming = list.filter(function (b) { return !Jaazi.isPast(b); });
    var past = list.filter(function (b) { return Jaazi.isPast(b); });
    upcoming.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
    past.sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
    return upcoming.concat(past);
  }

  function cardMarkup(b) {
    var past = Jaazi.isPast(b);
    var today = b.date === Jaazi.todayKey();
    var status = past ? "Completada" : today ? "Hoy" : "Confirmada";
    var actions = past
      ? '<a class="appt__link" href="agendar.html?servicio=' + encodeURIComponent(b.serviceId) + '">' +
        "Repetir cita" +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>'
      : '<button class="appt__link appt__link--danger" type="button" data-cancel>Cancelar cita</button>' +
        '<button class="appt__link" type="button" data-ics>' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 3v5M16 3v5M4 11h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
        "Calendario</button>" +
        '<a class="appt__link" href="' + mapsUrl + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.5"/></svg>' +
        "Cómo llegar</a>";

    return '<article class="appt' + (past ? " appt--past" : "") + '" data-code="' + esc(b.code) + '">' +
      '<div class="appt__date" aria-hidden="true">' +
        '<span class="appt__dow">' + esc(Jaazi.dayName(b.date)) + "</span>" +
        '<span class="appt__num">' + esc(Jaazi.dayNumber(b.date)) + "</span>" +
        '<span class="appt__mon">' + esc(Jaazi.monthShort(b.date)) + "</span>" +
      "</div>" +
      '<div class="appt__body">' +
        '<div class="appt__top">' +
          '<h3 class="appt__service">' + esc(b.serviceName) + "</h3>" +
          '<span class="status' + (past ? " status--past" : "") + '">' + status + "</span>" +
        "</div>" +
        '<p class="appt__meta"><strong>' + cap(esc(Jaazi.formatLong(b.date))) + "</strong> · " + esc(Jaazi.timeLabel(b.time)) + "</p>" +
        '<p class="appt__meta">' + esc(Jaazi.durationLabel(b.duration)) + " · " + esc(b.priceLabel || "Consultar") + " · A nombre de " + esc(b.name) + "</p>" +
        (b.notes ? '<p class="appt__meta">Nota: ' + esc(b.notes) + "</p>" : "") +
        '<p class="appt__code">Código ' + esc(b.code) + "</p>" +
        '<div class="appt__actions">' + actions + "</div>" +
      "</div>" +
    "</article>";
  }

  function emptyMarkup(kind, query) {
    if (kind === "search") {
      return '<div class="empty">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.4"/><path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        "<h3>No encontramos esa cita.</h3>" +
        "<p>Revisa el código (JZ-XXXX) o prueba con el teléfono completo con el que reservaste “" + esc(query) + "”.</p>" +
        '<button class="btn btn--ghost" type="button" data-clear>Ver todas mis citas</button>' +
      "</div>";
    }
    return '<div class="empty">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 3v5M16 3v5M4 11h16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
      "<h3>Todavía no hay citas.</h3>" +
      "<p>Agenda tu primera cita y aquí tendrás el código, la hora y el calendario a mano.</p>" +
      '<a class="btn" href="agendar.html">Agendar cita' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
    "</div>";
  }

  function setStatus(html) {
    statusEl.textContent = "";
    if (html) statusEl.innerHTML = html;
  }

  function render() {
    var all = Jaazi.read();
    var visible = state.query ? all.filter(function (b) { return matches(b, state.query); }) : all;
    var ordered = sortList(visible);
    var upcoming = ordered.filter(function (b) { return !Jaazi.isPast(b); }).length;
    var past = ordered.length - upcoming;

    if (!ordered.length) {
      listEl.innerHTML = all.length && state.query ? emptyMarkup("search", state.query) : emptyMarkup("all");
    } else {
      listEl.innerHTML = ordered.map(cardMarkup).join("");
    }

    var parts = [];
    if (upcoming) parts.push(upcoming + (upcoming === 1 ? " próxima" : " próximas"));
    if (past) parts.push(past + (past === 1 ? " completada" : " completadas"));
    countEl.textContent = parts.join(" · ");

    if (!state.query) {
      setStatus("");
      return;
    }

    if (ordered.length) {
      var label = ordered.length === 1 ? " cita encontrada" : " citas encontradas";
      statusEl.textContent = ordered.length + label + " para “" + state.query + "”. ";
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "link-btn";
      clear.textContent = "Ver todas";
      clear.addEventListener("click", clearSearch);
      statusEl.appendChild(clear);
    } else {
      statusEl.textContent = "Sin resultados para “" + state.query + "”. ";
      var clearEmpty = document.createElement("button");
      clearEmpty.type = "button";
      clearEmpty.className = "link-btn";
      clearEmpty.textContent = "Ver todas";
      clearEmpty.addEventListener("click", clearSearch);
      statusEl.appendChild(clearEmpty);
    }
  }

  function clearSearch() {
    state.query = "";
    input.value = "";
    error.hidden = true;
    input.removeAttribute("aria-invalid");
    render();
    input.focus();
  }

  function scrollToResults() {
    if (!titleEl) return;
    titleEl.scrollIntoView({
      behavior: reduceMotion.matches ? "auto" : "smooth",
      block: "start"
    });
  }

  /* ---------- Cancelación con confirmación en línea ---------- */

  function closeAllConfirms(except) {
    Array.prototype.forEach.call(listEl.querySelectorAll(".appt[data-confirming]"), function (card) {
      if (except && card === except) return;
      var confirmEl = card.querySelector(".cancel-confirm");
      var actions = card.querySelector(".appt__actions");
      if (confirmEl) confirmEl.remove();
      if (actions) actions.hidden = false;
      card.removeAttribute("data-confirming");
    });
  }

  function openCancel(card, code) {
    closeAllConfirms(card);
    var actions = card.querySelector(".appt__actions");
    if (!actions) return;
    actions.hidden = true;

    var confirmEl = document.createElement("div");
    confirmEl.className = "cancel-confirm";
    confirmEl.innerHTML =
      '<p>¿Cancelar esta cita?</p>' +
      '<button type="button" data-keep>Mantener</button>' +
      '<button type="button" class="danger" data-confirm-cancel> Sí, cancelar</button>';
    actions.parentNode.insertBefore(confirmEl, actions.nextSibling);
    card.setAttribute("data-confirming", "");
    var keep = confirmEl.querySelector("[data-keep]");
    if (keep) keep.focus();
  }

  function closeCancel(card) {
    var confirmEl = card.querySelector(".cancel-confirm");
    var actions = card.querySelector(".appt__actions");
    if (confirmEl) confirmEl.remove();
    if (actions) {
      actions.hidden = false;
      var trigger = actions.querySelector("[data-cancel]");
      if (trigger) trigger.focus();
    }
    card.removeAttribute("data-confirming");
  }

  function cancelBooking(card, code) {
    var removed = Jaazi.removeBooking(code);
    if (!removed) {
      if (window.UI) UI.toast("No pudimos cancelar la cita. Inténtalo de nuevo.");
      return;
    }
    card.classList.add("is-leaving");
    setTimeout(function () {
      render();
      if (titleEl) {
        titleEl.setAttribute("tabindex", "-1");
        titleEl.focus({ preventScroll: true });
      }
    }, reduceMotion.matches ? 0 : 200);

    if (window.UI) {
      UI.toast("Cita cancelada. El hueco quedó libre.", {
        actionLabel: "Deshacer",
        duration: 9000,
        onAction: function () {
          Jaazi.restoreBooking(removed);
          state.query = "";
          input.value = "";
          render();
          UI.toast("Cita restaurada.");
        }
      });
    }
  }

  /* ---------- Eventos ---------- */

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var query = input.value.trim();
    if (!query) {
      error.textContent = "Escribe tu código o teléfono para buscar.";
      error.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    error.hidden = true;
    input.removeAttribute("aria-invalid");
    state.query = query;
    render();
    scrollToResults();
  });

  input.addEventListener("input", function () {
    if (input.getAttribute("aria-invalid") === "true") {
      error.hidden = true;
      input.removeAttribute("aria-invalid");
    }
    if (!input.value.trim() && state.query) {
      state.query = "";
      render();
    }
  });

  listEl.addEventListener("click", function (event) {
    var card = event.target.closest(".appt");
    var clear = event.target.closest("[data-clear]");
    if (clear) {
      clearSearch();
      return;
    }
    if (event.target.closest("[data-keep]") && card) {
      closeCancel(card);
      return;
    }
    if (event.target.closest("[data-confirm-cancel]") && card) {
      cancelBooking(card, card.dataset.code);
      return;
    }
    if (event.target.closest("[data-cancel]") && card) {
      openCancel(card, card.dataset.code);
      return;
    }
    if (event.target.closest("[data-ics]") && card) {
      var booking = Jaazi.read().filter(function (b) { return b.code === card.dataset.code; })[0];
      if (booking) {
        Jaazi.downloadICS(booking);
        if (window.UI) UI.toast("Calendario descargado. Ábrelo para añadir la cita.");
      }
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var open = listEl.querySelector(".appt[data-confirming]");
    if (open) closeCancel(open);
  });

  window.addEventListener("storage", function (event) {
    if (event.key === "jaazi.bookings.v2") render();
  });

  render();
})();
