/* =========================================================
   Jaazi Barber — revisar y gestionar citas
   Dos modos: agenda compartida (Supabase) o local (navegador).
   ========================================================= */

(function () {
  "use strict";

  var form = document.getElementById("lookup-form");
  var input = document.getElementById("lookup");
  var phoneInput = document.getElementById("lookup-phone");
  var error = document.getElementById("lookup-error");
  var listEl = document.getElementById("appointments");
  var countEl = document.getElementById("appt-count");
  var statusEl = document.getElementById("lookup-status");
  var titleEl = document.getElementById("appts-title");
  if (!form || !input || !phoneInput || !listEl || !window.Jaazi) return;

  var api = window.JaaziApi && window.JaaziApi.enabled ? window.JaaziApi : null;
  var state = { code: "", phone: "", results: [], searched: false, loading: false };
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

  function matches(booking, code, phone) {
    var wantedCode = String(code || "").trim().toUpperCase();
    var digits = normalizePhone(phone);
    var storedCode = String(booking.code || "").trim().toUpperCase();
    var storedPhone = normalizePhone(booking.phone);
    if (!wantedCode || !digits || !storedCode || !storedPhone) return false;
    if (storedCode !== wantedCode) return false;
    return storedPhone === digits ||
      (storedPhone.length >= 10 && storedPhone.slice(-10) === digits.slice(-10));
  }

  function sortList(list) {
    var upcoming = list.filter(function (b) { return !Jaazi.isPast(b); });
    var past = list.filter(function (b) { return Jaazi.isPast(b); });
    upcoming.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
    past.sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
    return upcoming.concat(past);
  }

  /* ---------- Estado de cada cita ---------- */

  function statusOf(b) {
    if (b.status === "cancelled") return { key: "cancelled", label: "Cancelada" };
    if (b.status === "completed") return { key: "completed", label: "Completada" };
    if (Jaazi.isPast(b)) return { key: "past", label: "Finalizada" };
    if (b.date === Jaazi.todayKey()) return { key: "today", label: "Hoy" };
    return { key: "confirmed", label: "Confirmada" };
  }

  function canCancel(b) {
    var status = statusOf(b);
    return status.key === "confirmed" || status.key === "today";
  }

  function cardMarkup(b) {
    var status = statusOf(b);
    var past = status.key === "past" || status.key === "completed" || status.key === "cancelled";
    var statusClass = "status status--" + status.key;

    var actions;
    if (status.key === "cancelled") {
      actions = '<a class="appt__link" href="agendar.html?servicio=' + encodeURIComponent(b.serviceId) + '">' +
        "Agendar de nuevo" +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>';
    } else if (past) {
      actions = '<a class="appt__link" href="agendar.html?servicio=' + encodeURIComponent(b.serviceId) + '">' +
        "Repetir cita" +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>';
    } else {
      actions = '<button class="appt__link appt__link--danger" type="button" data-cancel>Cancelar cita</button>' +
        '<button class="appt__link" type="button" data-ics>' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 3v5M16 3v5M4 11h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
        "Calendario</button>" +
        '<a class="appt__link" href="' + mapsUrl + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.5"/></svg>' +
        "Cómo llegar</a>";
    }

    var classes = "appt" + (past ? " appt--past" : "") + (status.key === "cancelled" ? " appt--cancelled" : "");

    return '<article class="' + classes + '" data-code="' + esc(b.code) + '">' +
      '<div class="appt__date" aria-hidden="true">' +
        '<span class="appt__dow">' + esc(Jaazi.dayName(b.date)) + "</span>" +
        '<span class="appt__num">' + esc(Jaazi.dayNumber(b.date)) + "</span>" +
        '<span class="appt__mon">' + esc(Jaazi.monthShort(b.date)) + "</span>" +
      "</div>" +
      '<div class="appt__body">' +
        '<div class="appt__top">' +
          '<h3 class="appt__service">' + esc(b.serviceName) + "</h3>" +
          '<span class="' + statusClass + '">' + status.label + "</span>" +
        "</div>" +
        '<p class="appt__meta"><strong>' + cap(esc(Jaazi.formatLong(b.date))) + "</strong> · " + esc(Jaazi.timeLabel(b.time)) + "</p>" +
        '<p class="appt__meta">' + esc(Jaazi.durationLabel(b.duration)) + " · " + esc(b.priceLabel || "Consultar") + " · A nombre de " + esc(b.name) + "</p>" +
        (b.notes ? '<p class="appt__meta">Nota: ' + esc(b.notes) + "</p>" : "") +
        '<p class="appt__code">Código ' + esc(b.code) + "</p>" +
        '<div class="appt__actions">' + actions + "</div>" +
      "</div>" +
    "</article>";
  }

  function emptyMarkup(kind) {
    if (kind === "intro") {
      return '<div class="empty">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.4"/><path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        "<h3>Busca tu cita.</h3>" +
        "<p>Escribe el código que te dimos al reservar y el teléfono con el que agendaste.</p>" +
      "</div>";
    }
    if (kind === "search") {
      return '<div class="empty">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.4"/><path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        "<h3>No encontramos esa cita.</h3>" +
        "<p>Revisa el código (JZ-XXXXXX) y el teléfono con el que reservaste. Los dos datos deben coincidir.</p>" +
        '<button class="btn btn--ghost" type="button" data-clear>Limpiar búsqueda</button>' +
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

  function addClearButton() {
    var clear = document.createElement("button");
    clear.type = "button";
    clear.className = "link-btn";
    clear.textContent = "Limpiar búsqueda";
    clear.addEventListener("click", clearSearch);
    statusEl.appendChild(clear);
  }

  /* ---------- Modo compartido ---------- */

  function renderApi() {
    if (state.loading) {
      listEl.innerHTML = '<p class="slots-empty">Buscando tu cita…</p>';
      countEl.textContent = "";
      setStatus("");
      return;
    }

    var ordered = sortList(state.results);
    var upcoming = ordered.filter(function (b) { return canCancel(b); }).length;
    var rest = ordered.length - upcoming;

    if (!state.searched) {
      listEl.innerHTML = emptyMarkup("intro");
      countEl.textContent = "";
      setStatus("");
      return;
    }

    if (!ordered.length) {
      listEl.innerHTML = emptyMarkup("search");
      countEl.textContent = "0 citas";
      setStatus("Sin resultados para ese código y teléfono. ");
      addClearButton();
      return;
    }

    listEl.innerHTML = ordered.map(cardMarkup).join("");

    var parts = [];
    if (upcoming) parts.push(upcoming + (upcoming === 1 ? " próxima" : " próximas"));
    if (rest) parts.push(rest + (rest === 1 ? " pasada" : " pasadas"));
    countEl.textContent = parts.join(" · ");

    setStatus(ordered.length + (ordered.length === 1 ? " cita encontrada" : " citas encontradas") + ". ");
    addClearButton();
  }

  /* ---------- Modo local ---------- */

  function renderLocal() {
    var all = Jaazi.read();
    var hasQuery = Boolean(state.code.trim() || state.phone.trim());
    var visible = hasQuery ? all.filter(function (b) { return matches(b, state.code, state.phone); }) : all;
    var ordered = sortList(visible);
    var upcoming = ordered.filter(function (b) { return canCancel(b); }).length;
    var past = ordered.length - upcoming;

    if (!ordered.length) {
      listEl.innerHTML = all.length && hasQuery ? emptyMarkup("search") : emptyMarkup("all");
    } else {
      listEl.innerHTML = ordered.map(cardMarkup).join("");
    }

    var parts = [];
    if (upcoming) parts.push(upcoming + (upcoming === 1 ? " próxima" : " próximas"));
    if (past) parts.push(past + (past === 1 ? " pasada" : " pasadas"));
    countEl.textContent = parts.join(" · ");

    if (!hasQuery) {
      setStatus("");
      return;
    }

    if (ordered.length) {
      var label = ordered.length === 1 ? " cita encontrada" : " citas encontradas";
      setStatus(ordered.length + label + ". ");
    } else {
      setStatus("Sin resultados para ese código y teléfono. ");
    }
    addClearButton();
  }

  function render() {
    if (api) renderApi();
    else renderLocal();
  }

  function clearSearch() {
    state.code = "";
    state.phone = "";
    state.results = [];
    state.searched = false;
    input.value = "";
    phoneInput.value = "";
    error.hidden = true;
    input.removeAttribute("aria-invalid");
    phoneInput.removeAttribute("aria-invalid");
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

  function openCancel(card) {
    closeAllConfirms(card);
    var actions = card.querySelector(".appt__actions");
    if (!actions) return;
    actions.hidden = true;

    var confirmEl = document.createElement("div");
    confirmEl.className = "cancel-confirm";
    confirmEl.innerHTML =
      '<p>¿Cancelar esta cita?</p>' +
      '<button type="button" data-keep>Mantener</button>' +
      '<button type="button" class="danger" data-confirm-cancel>Sí, cancelar</button>';
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

  function findResult(code) {
    for (var i = 0; i < state.results.length; i++) {
      if (state.results[i].code === code) return state.results[i];
    }
    return null;
  }

  function cancelBooking(card, code) {
    if (api) {
      var booking = findResult(code);
      if (!booking) return;
      var confirmBtn = card.querySelector("[data-confirm-cancel]");
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Cancelando…";
      }
      api.cancel(code, booking.phone).then(function (ok) {
        if (!ok) {
          closeCancel(card);
          if (window.UI) UI.toast("No pudimos cancelar la cita. Escríbenos por WhatsApp.");
          return;
        }
        booking.status = "cancelled";
        render();
        if (titleEl) {
          titleEl.setAttribute("tabindex", "-1");
          titleEl.focus({ preventScroll: true });
        }
        if (window.UI) UI.toast("Cita cancelada. El hueco quedó libre.");
      }, function (err) {
        closeCancel(card);
        if (window.UI) UI.toast(api.friendly(err));
      });
      return;
    }

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
          state.code = "";
          state.phone = "";
          input.value = "";
          phoneInput.value = "";
          render();
          UI.toast("Cita restaurada.");
        }
      });
    }
  }

  /* ---------- Eventos ---------- */

  function showLookupError(message, field) {
    error.textContent = message;
    error.hidden = false;
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var code = input.value.trim();
    var phone = phoneInput.value.trim();

    if (!code) {
      showLookupError("Escribe el código de tu cita (JZ-XXXXXX).", input);
      return;
    }
    if (!phone) {
      showLookupError("Escribe el teléfono con el que reservaste.", phoneInput);
      return;
    }

    error.hidden = true;
    input.removeAttribute("aria-invalid");
    phoneInput.removeAttribute("aria-invalid");
    state.code = code;
    state.phone = phone;

    if (!api) {
      render();
      scrollToResults();
      return;
    }

    state.loading = true;
    state.searched = true;
    render();
    api.lookup(code, phone).then(function (rows) {
      state.loading = false;
      state.results = rows;
      render();
      scrollToResults();
    }, function (err) {
      state.loading = false;
      state.results = [];
      render();
      error.textContent = api.friendly(err);
      error.hidden = false;
      input.setAttribute("aria-invalid", "true");
    });
  });

  function resetLookupIfEmpty() {
    if (!input.value.trim() && !phoneInput.value.trim() && state.searched) {
      state.code = "";
      state.phone = "";
      state.results = [];
      state.searched = false;
      render();
    }
  }

  [input, phoneInput].forEach(function (field) {
    field.addEventListener("input", function () {
      if (field.getAttribute("aria-invalid") === "true") {
        error.hidden = true;
        field.removeAttribute("aria-invalid");
      }
      resetLookupIfEmpty();
    });
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
      openCancel(card);
      return;
    }
    if (event.target.closest("[data-ics]") && card) {
      var booking = api
        ? findResult(card.dataset.code)
        : Jaazi.read().filter(function (b) { return b.code === card.dataset.code; })[0];
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
    if (!api && event.key === "jaazi.bookings.v2") render();
  });

  render();
})();
