/* =========================================================
   Jaazi Barber — flujo de reserva
   ========================================================= */

(function () {
  "use strict";

  var form = document.getElementById("booking-form");
  if (!form || !window.Jaazi) return;

  var DRAFT_KEY = "jaazi.draft.v2";
  var steps = Array.prototype.slice.call(form.querySelectorAll("[data-step]"));
  var indicators = Array.prototype.slice.call(form.querySelectorAll("[data-step-indicator]"));
  var panel = form;
  var summary = document.querySelector(".summary");
  var confirmation = document.getElementById("confirmation");
  var dateList = document.getElementById("date-list");
  var timeGroups = document.getElementById("time-groups");
  var timesWrap = document.getElementById("times-wrap");
  var availabilityNote = document.getElementById("availability-note");
  var submitBtn = document.getElementById("submit-btn");
  var formError = document.getElementById("form-error");
  var state = {
    step: 1,
    serviceId: null,
    date: null,
    time: null,
    booking: null,
    submitting: false,
    busy: null
  };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var api = window.JaaziApi && window.JaaziApi.enabled ? window.JaaziApi : null;

  /* ---------- Utilidades ---------- */

  function service() {
    return Jaazi.getService(state.serviceId);
  }

  function loadBusy() {
    if (!api) {
      state.busy = null;
      return Promise.resolve();
    }
    var from = Jaazi.keyOf(new Date());
    var to = Jaazi.keyOf(Jaazi.addDays(new Date(), 20));
    return api.busy(from, to).then(function (map) {
      state.busy = map;
    }, function () {
      state.busy = {};
    });
  }

  function scrollToPanel() {
    if (!panel) return;
    var header = document.querySelector(".site-header");
    var offset = (header ? header.offsetHeight : 72) + 14;
    var top = panel.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: reduceMotion.matches ? "auto" : "smooth"
    });
  }

  function setStepError(name, message) {
    var el = form.querySelector('[data-error="' + name + '"]');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }

  function clearStepErrors() {
    ["service", "date", "time"].forEach(function (name) {
      setStepError(name, "");
    });
  }

  function setFieldError(input, message) {
    var error = document.getElementById(input.id + "-error");
    if (error) {
      error.textContent = message || "";
      error.hidden = !message;
    }
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function clearFieldErrors() {
    ["name", "phone", "email"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) setFieldError(input, "");
    });
    var consent = document.getElementById("consent");
    var consentError = document.getElementById("consent-error");
    if (consent) consent.removeAttribute("aria-invalid");
    if (consentError) {
      consentError.hidden = true;
      consentError.textContent = "";
    }
    formError.hidden = true;
    formError.textContent = "";
  }

  function saveDraft() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        serviceId: state.serviceId,
        date: state.date,
        time: state.time,
        step: state.step
      }));
    } catch (err) { /* modo privado */ }
  }

  function clearDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (err) { /* noop */ }
  }

  function readDraft() {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  /* ---------- Resumen ---------- */

  function updateSummary() {
    var s = service();
    var map = {
      service: s ? s.name : "Por elegir",
      date: state.date ? Jaazi.formatMedium(state.date) : "Por elegir",
      time: state.time ? Jaazi.timeLabel(state.time) : "Por elegir",
      duration: s ? Jaazi.durationLabel(s.duration) : "—",
      price: s ? Jaazi.formatPrice(s.price) : "—"
    };

    Object.keys(map).forEach(function (key) {
      var el = document.querySelector('[data-summary="' + key + '"]');
      if (!el) return;
      el.textContent = map[key];
      el.classList.toggle("is-empty", key === "service" && !s || key === "date" && !state.date || key === "time" && !state.time || key === "duration" && !s);
    });

    var stepEl = document.querySelector("[data-summary-step]");
    if (stepEl) stepEl.textContent = String(state.step);
  }

  /* ---------- Navegación entre pasos ---------- */

  function goTo(step, options) {
    options = options || {};
    state.step = step;

    steps.forEach(function (el) {
      el.hidden = Number(el.dataset.step) !== step;
    });

    indicators.forEach(function (el) {
      var n = Number(el.dataset.stepIndicator);
      el.classList.toggle("is-done", n < step);
      if (n === step) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });

    if (step === 2) {
      if (api) {
        dateList.innerHTML = '<p class="slots-empty">Cargando disponibilidad…</p>';
        timesWrap.hidden = true;
        loadBusy().then(renderDates);
      } else {
        renderDates();
      }
    }
    updateSummary();
    saveDraft();

    var heading = form.querySelector('[data-step="' + step + '"] h2');
    if (heading) heading.focus({ preventScroll: true });
    if (!options.silent) scrollToPanel();
  }

  function validateStepOne() {
    if (!state.serviceId) {
      setStepError("service", "Elige un servicio para continuar.");
      var first = form.querySelector('input[name="service"]');
      if (first) first.focus();
      return false;
    }
    setStepError("service", "");
    return true;
  }

  function validateStepTwo() {
    var ok = true;
    if (!state.date) {
      setStepError("date", "Elige un día para ver los horarios.");
      ok = false;
    } else {
      setStepError("date", "");
    }
    if (!state.time) {
      setStepError("time", "Elige una hora disponible.");
      ok = false;
    } else {
      setStepError("time", "");
    }
    if (!ok) {
      var target = state.date
        ? form.querySelector('input[name="time"]:not(:disabled)')
        : form.querySelector('input[name="date"]:not(:disabled)');
      if (target) target.focus();
    }
    return ok;
  }

  /* ---------- Fechas ---------- */

  function renderDates() {
    var s = service() || Jaazi.SERVICES[0];
    dateList.innerHTML = "";
    var today = Jaazi.todayKey();
    var selectedStillValid = false;

    for (var i = 0; i < 21; i++) {
      var d = Jaazi.addDays(new Date(), i);
      var key = Jaazi.keyOf(d);
      var closed = Jaazi.isClosed(key);
      var count = closed ? 0 : Jaazi.slotsFor(key, s.duration, state.busy).filter(function (slot) {
        return slot.available;
      }).length;
      var disabled = closed || count === 0;

      if (key === state.date) {
        selectedStillValid = !disabled;
      }

      var label = document.createElement("label");
      label.className = "date" + (key === today ? " date--today" : "");
      var note = closed ? "Cerrado" : count === 0 ? "Lleno" : key === today ? "Hoy" : count + (count === 1 ? " hueco" : " huecos");
      var fullLabel = Jaazi.formatLong(key) + (closed ? ", cerrado" : count === 0 ? ", sin disponibilidad" : ", " + count + " horarios disponibles");

      label.innerHTML =
        '<input type="radio" name="date" value="' + key + '"' +
        (state.date === key ? " checked" : "") +
        (disabled ? " disabled" : "") +
        ' aria-label="' + fullLabel + '">' +
        '<span class="date__dow">' + Jaazi.dayName(key) + "</span>" +
        '<span class="date__num">' + Jaazi.dayNumber(key) + "</span>" +
        '<span class="date__mon">' + Jaazi.monthShort(key) + "</span>" +
        '<span class="date__note">' + note + "</span>";

      dateList.appendChild(label);
    }

    if (state.date && !selectedStillValid) {
      state.date = null;
      state.time = null;
      timesWrap.hidden = true;
    }

    if (state.date) {
      var checked = dateList.querySelector('input[value="' + state.date + '"]');
      var chosen = checked ? checked.closest(".date") : null;
      if (chosen) {
        requestAnimationFrame(function () {
          dateList.scrollTo({
            left: Math.max(0, chosen.offsetLeft - 12),
            behavior: reduceMotion.matches ? "auto" : "smooth"
          });
        });
      }
      renderTimes();
    }
  }

  /* ---------- Horarios ---------- */

  function renderTimes() {
    var s = service();
    if (!s || !state.date) {
      timesWrap.hidden = true;
      return;
    }

    var slots = Jaazi.slotsFor(state.date, s.duration, state.busy);
    var total = slots.filter(function (slot) { return slot.available; }).length;
    timeGroups.innerHTML = "";

    if (!total) {
      timeGroups.innerHTML = '<p class="slots-empty">No quedan huecos para este día con la duración de tu servicio. Prueba con otra fecha.</p>';
      availabilityNote.textContent = "Día completo para " + Jaazi.durationLabel(s.duration) + ".";
      timesWrap.hidden = false;
      return;
    }

    if (state.time) {
      var stillFree = slots.some(function (slot) {
        return slot.time === state.time && slot.available;
      });
      if (!stillFree) state.time = null;
    }

    var groups = [
      { label: "Mañana", from: 0, to: 12 * 60 - 1 },
      { label: "Tarde", from: 12 * 60, to: 24 * 60 }
    ];

    groups.forEach(function (group) {
      var groupSlots = slots.filter(function (slot) {
        var mins = parseInt(slot.time.split(":")[0], 10) * 60 + parseInt(slot.time.split(":")[1], 10);
        return mins >= group.from && mins <= group.to;
      });
      if (!groupSlots.length) return;

      var wrap = document.createElement("div");
      wrap.className = "time-group";
      var title = document.createElement("p");
      title.className = "time-group__label";
      title.textContent = group.label;
      wrap.appendChild(title);

      var grid = document.createElement("div");
      grid.className = "times";

      groupSlots.forEach(function (slot) {
        var label = document.createElement("label");
        label.className = "time";
        var hours = parseInt(slot.time.slice(0, 2), 10);
        label.innerHTML =
          '<input type="radio" name="time" value="' + slot.time + '"' +
          (state.time === slot.time ? " checked" : "") +
          (slot.available ? "" : " disabled") +
          ' aria-label="' + Jaazi.timeLabel(slot.time) + (slot.available ? "" : ", no disponible") + '">' +
          "<span>" + Jaazi.timeLabel(slot.time).replace(" a.m.", "").replace(" p.m.", "") + "</span>" +
          '<span class="time__tag">' + (hours >= 12 ? "pm" : "am") + "</span>";
        grid.appendChild(label);
      });

      wrap.appendChild(grid);
      timeGroups.appendChild(wrap);
    });

    availabilityNote.textContent = total + (total === 1 ? " hueco disponible" : " huecos disponibles") + " · duración " + Jaazi.durationLabel(s.duration);
    timesWrap.hidden = false;
  }

  /* ---------- Eventos ---------- */

  form.addEventListener("change", function (event) {
    var target = event.target;

    if (target.name === "service") {
      state.serviceId = target.value;
      state.time = null;
      setStepError("service", "");
      var s = service();
      if (state.date && s && !Jaazi.isDayAvailable(state.date, s.duration, state.busy)) {
        state.date = null;
      }
      updateSummary();
      saveDraft();
      return;
    }

    if (target.name === "date") {
      state.date = target.value;
      state.time = null;
      setStepError("date", "");
      setStepError("time", "");
      renderTimes();
      updateSummary();
      saveDraft();
      if (window.matchMedia("(max-width: 980px)").matches) {
        requestAnimationFrame(function () {
          var rect = timesWrap.getBoundingClientRect();
          if (rect.top > window.innerHeight - 120) {
            var header = document.querySelector(".site-header");
            var offset = (header ? header.offsetHeight : 64) + 16;
            window.scrollTo({
              top: window.scrollY + rect.top - offset,
              behavior: reduceMotion.matches ? "auto" : "smooth"
            });
          }
        });
      }
      return;
    }

    if (target.name === "time") {
      state.time = target.value;
      setStepError("time", "");
      updateSummary();
      saveDraft();
    }
  });

  form.querySelectorAll("[data-next]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = Number(button.dataset.next);
      clearStepErrors();
      if (state.step === 1 && !validateStepOne()) return;
      if (state.step === 2 && !validateStepTwo()) return;
      goTo(next);
    });
  });

  form.querySelectorAll("[data-back]").forEach(function (button) {
    button.addEventListener("click", function () {
      clearFieldErrors();
      goTo(Number(button.dataset.back));
    });
  });

  ["name", "phone", "email"].forEach(function (id) {
    var input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", function () {
      if (input.getAttribute("aria-invalid") === "true") setFieldError(input, "");
    });
  });

  var phoneInput = document.getElementById("phone");
  if (phoneInput) {
    phoneInput.addEventListener("blur", function () {
      var digits = phoneInput.value.replace(/\D/g, "");
      if (digits.length === 10) {
        phoneInput.value = digits.slice(0, 3) + " " + digits.slice(3, 6) + " " + digits.slice(6);
      }
    });
  }

  var consentInput = document.getElementById("consent");
  if (consentInput) {
    consentInput.addEventListener("change", function () {
      if (!consentInput.checked) return;
      consentInput.removeAttribute("aria-invalid");
      var err = document.getElementById("consent-error");
      if (err) { err.hidden = true; err.textContent = ""; }
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (state.submitting) return;
    clearFieldErrors();

    var name = document.getElementById("name");
    var phone = document.getElementById("phone");
    var email = document.getElementById("email");
    var consent = document.getElementById("consent");
    var firstInvalid = null;
    var messages = [];

    if (!name.value.trim() || name.value.trim().length < 2) {
      setFieldError(name, "Escribe tu nombre (mínimo 2 letras).");
      firstInvalid = firstInvalid || name;
      messages.push("Revisa tu nombre.");
    }

    var digits = phone.value.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      setFieldError(phone, "Escribe un teléfono de al menos 10 dígitos.");
      firstInvalid = firstInvalid || phone;
      messages.push("Revisa tu teléfono.");
    }

    if (email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
      setFieldError(email, "Ese correo no parece válido.");
      firstInvalid = firstInvalid || email;
      messages.push("Revisa tu correo.");
    }

    if (!consent.checked) {
      consent.setAttribute("aria-invalid", "true");
      var consentError = document.getElementById("consent-error");
      if (consentError) {
        consentError.textContent = "Acepta la política de cancelación para continuar.";
        consentError.hidden = false;
      }
      firstInvalid = firstInvalid || consent;
      messages.push("Falta aceptar la política de cancelación.");
    }

    if (firstInvalid) {
      formError.textContent = messages.join(" ");
      formError.hidden = false;
      firstInvalid.focus();
      return;
    }

    var s = service();
    if (!s || !state.date || !state.time) {
      formError.textContent = "Falta elegir servicio, día u hora. Vuelve atrás para completarlo.";
      formError.hidden = false;
      goTo(!s ? 1 : 2);
      return;
    }

    var slot = Jaazi.slotsFor(state.date, s.duration, state.busy).filter(function (item) {
      return item.time === state.time;
    })[0];

    if (!slot || !slot.available) {
      state.time = null;
      renderTimes();
      updateSummary();
      goTo(2);
      if (window.UI) UI.toast("Ese horario acaba de ocuparse. Elige otro, por favor.");
      return;
    }

    state.submitting = true;
    submitBtn.disabled = true;
    var label = submitBtn.querySelector("[data-submit-label]");
    if (label) label.textContent = "Confirmando…";

    var payload = {
      serviceId: s.id,
      serviceName: s.name,
      price: s.price,
      duration: s.duration,
      date: state.date,
      time: state.time,
      name: name.value.trim(),
      phone: phone.value.trim(),
      email: email.value.trim(),
      notes: document.getElementById("notes").value.trim()
    };

    function resetSubmit() {
      state.submitting = false;
      submitBtn.disabled = false;
      if (label) label.textContent = "Confirmar cita";
    }

    if (api) {
      api.create(payload).then(function (booking) {
        state.booking = booking;
        clearDraft();
        showConfirmation(booking);
      }, function (error) {
        resetSubmit();
        var retry = error.code === "slot_taken" || error.code === "invalid_slot";
        var message = api.friendly(error);
        formError.textContent = message;
        formError.hidden = false;
        if (retry) {
          if (window.UI) UI.toast(message);
          loadBusy().then(function () {
            goTo(2);
          });
        }
      });
      return;
    }

    var booking = Jaazi.addBooking(payload);

    var saved = Jaazi.read().some(function (item) { return item.code === booking.code; });

    if (!saved) {
      resetSubmit();
      formError.textContent = "No pudimos guardar la cita en este navegador. Revisa el almacenamiento o escríbenos a Jaazielbarber09@gmail.com.";
      formError.hidden = false;
      return;
    }

    state.booking = booking;
    clearDraft();
    showConfirmation(booking);
  });

  /* ---------- Confirmación ---------- */

  function showConfirmation(booking) {
    state.submitting = false;
    steps.forEach(function (el) { el.hidden = true; });
    panel.classList.add("is-confirmed");
    confirmation.hidden = false;
    if (summary) summary.hidden = true;

    document.getElementById("confirm-title").textContent = "Nos vemos el " + Jaazi.formatLong(booking.date) + ".";
    document.getElementById("confirm-copy").textContent =
      "Tu cita de " + booking.serviceName + (api ? " quedó confirmada." : " quedó guardada.") +
      " Llega cinco minutos antes; si necesitas cambiarla, usa tu código.";
    document.getElementById("confirm-code").textContent = booking.code;
    document.getElementById("confirm-code-inline").textContent = booking.code;

    var details = document.getElementById("confirm-details");
    details.innerHTML =
      "<div><dt>Fecha</dt><dd>" + Jaazi.formatLong(booking.date) + "</dd></div>" +
      "<div><dt>Hora</dt><dd>" + Jaazi.timeLabel(booking.time) + " · " + Jaazi.durationLabel(booking.duration) + "</dd></div>" +
      "<div><dt>Servicio</dt><dd>" + booking.serviceName + "</dd></div>" +
      "<div><dt>Estudio</dt><dd>Calle 4 # 1-39, Conjunto Serralta, Torre 12, Apto 205, Chía</dd></div>" +
      "<div><dt>Precio</dt><dd>" + (booking.priceLabel || "Consultar") + "</dd></div>";

    var heading = document.getElementById("confirm-title");
    heading.focus({ preventScroll: true });
    var header = document.querySelector(".site-header");
    var offset = (header ? header.offsetHeight : 72) + 14;
    window.scrollTo({
      top: Math.max(0, panel.getBoundingClientRect().top + window.scrollY - offset),
      behavior: reduceMotion.matches ? "auto" : "smooth"
    });
  }

  /* ---------- Copiar código / calendario ---------- */

  var copyBtn = form.querySelector("[data-copy]");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      if (!state.booking) return;
      var code = state.booking.code;
      function done() {
        if (window.UI) UI.toast("Código " + code + " copiado.");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var temp = document.createElement("textarea");
        temp.value = code;
        temp.setAttribute("readonly", "");
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        try { document.execCommand("copy"); done(); } catch (err) { /* noop */ }
        temp.remove();
      }
    });
  }

  var icsBtn = form.querySelector("[data-ics]");
  if (icsBtn) {
    icsBtn.addEventListener("click", function () {
      if (!state.booking) return;
      Jaazi.downloadICS(state.booking);
      if (window.UI) UI.toast("Calendario descargado. Ábrelo para añadir la cita.");
    });
  }

  /* ---------- Arranque ---------- */

  (function init() {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get("servicio");
    var draft = readDraft();
    var preset = null;

    if (fromQuery && Jaazi.getService(fromQuery)) {
      preset = { serviceId: fromQuery, date: null, time: null, step: 1 };
    } else if (draft && Jaazi.getService(draft.serviceId)) {
      preset = draft;
    }

    if (preset) {
      state.serviceId = preset.serviceId;
      var radio = form.querySelector('input[name="service"][value="' + preset.serviceId + '"]');
      if (radio) radio.checked = true;

      if (preset.date) {
        state.date = preset.date;
        state.time = preset.time || null;
        var s = service();
        if (s && !api && !Jaazi.isDayAvailable(state.date, s.duration)) {
          state.date = null;
          state.time = null;
        }
      }

      var targetStep = Number(preset.step) || 1;
      if (targetStep > 1 && !state.date) targetStep = 1;
      if (targetStep > 2 && !state.time) targetStep = 2;
      if (targetStep > 3) targetStep = 3;

      updateSummary();
      goTo(targetStep, { silent: true });
      if (targetStep > 1) {
        var chosen = dateList.querySelector('input[value="' + state.date + '"]');
        if (chosen) chosen.closest(".date").scrollIntoView({ block: "nearest", inline: "center" });
      }
    } else {
      updateSummary();
      goTo(1, { silent: true });
    }
  })();
})();
