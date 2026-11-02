/* =========================================================
   Jaazi Barber — panel privado
   Login con Supabase, citas, estados, bloqueos e ingresos.
   ========================================================= */

(function () {
  "use strict";

  var api = window.JaaziApi;
  var loginView = document.getElementById("login-view");
  var appView = document.getElementById("app-view");
  var alertEl = document.getElementById("panel-alert");
  var loginForm = document.getElementById("login-form");
  var loginError = document.getElementById("login-error");
  var loginSubmit = document.getElementById("login-submit");
  var refreshBtn = document.querySelector("[data-refresh]");
  var logoutBtn = document.querySelector("[data-logout]");
  var listEl = document.getElementById("booking-list");
  var listTitle = document.getElementById("list-title");
  var listCount = document.getElementById("list-count");
  var blockForm = document.getElementById("block-form");
  var blockDate = document.getElementById("block-date");
  var blockStart = document.getElementById("block-start");
  var blockEnd = document.getElementById("block-end");
  var blockReason = document.getElementById("block-reason");
  var blockError = document.getElementById("block-error");
  var blockListEl = document.getElementById("block-list");
  var refreshNote = document.getElementById("refresh-note");
  var todayLabel = document.getElementById("today-label");
  if (!loginView || !appView || !formReady()) return;

  function formReady() {
    return Boolean(loginForm && listEl && blockForm);
  }

  var STATUS_LABELS = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    completed: "Completada",
    cancelled: "Cancelada"
  };

  var TITLES = {
    upcoming: "Próximas citas",
    today: "Citas de hoy",
    history: "Historial"
  };

  var state = {
    filter: "upcoming",
    bookings: [],
    blocks: [],
    loaded: false,
    busy: false
  };

  /* ---------- Utilidades ---------- */

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

  function isActive(status) {
    return status === "pending" || status === "confirmed";
  }

  function tomorrowKey() {
    return Jaazi.keyOf(Jaazi.addDays(new Date(), 1));
  }

  function waNumber(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 10) return "57" + digits;
    return digits;
  }

  function money(value) {
    return Jaazi.formatPrice(value);
  }

  function endTime(time, duration) {
    var parts = String(time).split(":").map(Number);
    var total = parts[0] * 60 + parts[1] + (Number(duration) || 45);
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
  }

  function setAlert(message) {
    alertEl.textContent = message || "";
    alertEl.hidden = !message;
  }

  function showLogin() {
    appView.hidden = true;
    loginView.hidden = false;
    refreshBtn.hidden = true;
    logoutBtn.hidden = true;
    loginError.hidden = true;
    var password = document.getElementById("login-password");
    if (password) password.value = "";
    document.title = "Acceso — Jaazi Barber";
  }

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    refreshBtn.hidden = false;
    logoutBtn.hidden = false;
    document.title = "Agenda privada — Jaazi Barber";
    setAlert("");
    loadAll();
  }

  /* ---------- Sesión ---------- */

  function withAuth(task) {
    return task().catch(function (err) {
      if (err && err.status === 401) {
        return api.refresh().then(function (session) {
          if (!session) {
            showLogin();
            throw err;
          }
          return task();
        });
      }
      throw err;
    });
  }

  function loginFriendly(err) {
    var message = (err && err.message) || "";
    if (/invalid login|invalid credentials/i.test(message)) return "Correo o contraseña incorrectos.";
    if (/email not confirmed/i.test(message)) return "El correo aún no está confirmado. Confírmalo en Supabase.";
    if (/rate limit|too many/i.test(message)) return "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";
    if (err && err.code === "offline") return api.friendly(err);
    return "No pudimos entrar. Revisa tu correo, tu contraseña y la conexión.";
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;

    if (!email || !password) {
      loginError.textContent = "Escribe tu correo y tu contraseña.";
      loginError.hidden = false;
      return;
    }

    loginError.hidden = true;
    var label = loginSubmit.querySelector("[data-login-label]");
    loginSubmit.disabled = true;
    if (label) label.textContent = "Entrando…";

    api.login(email, password).then(function () {
      loginSubmit.disabled = false;
      if (label) label.textContent = "Entrar";
      showApp();
    }, function (err) {
      loginSubmit.disabled = false;
      if (label) label.textContent = "Entrar";
      loginError.textContent = loginFriendly(err);
      loginError.hidden = false;
    });
  });

  logoutBtn.addEventListener("click", function () {
    api.logout();
    state.bookings = [];
    state.blocks = [];
    state.loaded = false;
    showLogin();
  });

  /* ---------- Carga de datos ---------- */

  function loadAll(silent) {
    if (state.busy) return;
    state.busy = true;
    if (!silent && refreshBtn) refreshBtn.classList.add("is-spinning");

    var today = Jaazi.todayKey();
    var identity = api.me
      ? api.me().then(function (info) { return info; }, function () { return null; })
      : Promise.resolve(null);

    Promise.all([
      withAuth(function () {
        return api.adminBookings("select=*&order=date.desc,time.desc&limit=1000");
      }),
      withAuth(function () {
        return api.adminBlocks(today);
      }),
      identity
    ]).then(function (result) {
      state.bookings = result[0] || [];
      state.blocks = result[1] || [];
      state.loaded = true;
      var who = result[2];
      if (who && who.isAdmin === false) {
        setAlert("Este correo no está autorizado para ver la agenda. Añádelo a la tabla admins de Supabase.");
      } else {
        setAlert("");
      }
      render();
      var stamp = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      refreshNote.textContent = "Actualizado " + stamp;
    }, function (err) {
      if (err && err.status === 401) return;
      setAlert(api.friendly(err));
    }).then(function () {
      state.busy = false;
      if (refreshBtn) refreshBtn.classList.remove("is-spinning");
    });
  }

  /* ---------- Filtros y métricas ---------- */

  function weekRange() {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var offset = (today.getDay() + 6) % 7;
    var start = Jaazi.addDays(today, -offset);
    return { start: Jaazi.keyOf(start), end: Jaazi.keyOf(Jaazi.addDays(start, 6)) };
  }

  function metrics() {
    var today = Jaazi.todayKey();
    var week = weekRange();
    var out = {
      today: { total: 0, count: 0 },
      week: { total: 0, count: 0 },
      upcoming: 0
    };

    state.bookings.forEach(function (b) {
      if (b.status === "cancelled") return;
      var active = isActive(b.status);
      if (b.date === today) {
        out.today.total += Number(b.price) || 0;
        out.today.count += 1;
      }
      if (b.date >= week.start && b.date <= week.end) {
        out.week.total += Number(b.price) || 0;
        out.week.count += 1;
      }
      if (active && b.date >= today) out.upcoming += 1;
    });

    return out;
  }

  function filtered() {
    var today = Jaazi.todayKey();
    var list;

    if (state.filter === "today") {
      list = state.bookings.filter(function (b) { return b.date === today; });
      list.sort(function (a, b) { return a.time.localeCompare(b.time); });
      return list;
    }

    if (state.filter === "history") {
      list = state.bookings.filter(function (b) {
        return b.date < today || b.status === "cancelled" || b.status === "completed";
      });
      list.sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
      return list.slice(0, 80);
    }

    list = state.bookings.filter(function (b) {
      return isActive(b.status) && b.date >= today;
    });
    list.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
    return list;
  }

  /* ---------- Render de citas ---------- */

  function statusChip(status) {
    var key = STATUS_LABELS[status] ? status : "confirmed";
    return '<span class="bchip bchip--' + key + '">' + esc(STATUS_LABELS[key]) + "</span>";
  }

  function actionsMarkup(b) {
    if (!isActive(b.status)) return "";

    var buttons = "";
    if (b.status === "pending") {
      buttons += '<button class="mini-btn mini-btn--primary" type="button" data-action="confirmed" data-id="' + esc(b.id) + '">Confirmar</button>';
    } else {
      buttons += '<button class="mini-btn mini-btn--primary" type="button" data-action="completed" data-id="' + esc(b.id) + '">Completar</button>';
    }
    buttons += '<button class="mini-btn mini-btn--danger" type="button" data-action="cancel" data-id="' + esc(b.id) + '">Cancelar cita</button>';
    return '<div class="bcard__actions" data-actions>' + buttons + "</div>";
  }

  function cardMarkup(b) {
    var time = String(b.time).slice(0, 5);
    var hour = parseInt(time.slice(0, 2), 10);
    var suffix = hour >= 12 ? "p.m." : "a.m.";
    var phone = String(b.phone || "");
    var tel = phone.replace(/[^\d+]/g, "");
    var wa = waNumber(phone);

    return '<article class="bcard" data-id="' + esc(b.id) + '">' +
      '<div class="bcard__time">' +
        '<strong>' + esc(time) + "</strong>" +
        "<span>" + suffix + "</span>" +
      "</div>" +
      '<div class="bcard__main">' +
        '<div class="bcard__top">' +
          '<h3 class="bcard__service">' + esc(b.serviceName) + "</h3>" +
          statusChip(b.status) +
        "</div>" +
        '<p class="bcard__meta">' +
          esc(b.name) + " · " +
          '<a href="tel:' + esc(tel) + '">' + esc(phone) + "</a> · " +
          (wa ? '<a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : "sin WhatsApp") +
        "</p>" +
        '<p class="bcard__meta">' +
          esc(cap(Jaazi.formatLong(b.date))) + " · " +
          esc(Jaazi.durationLabel(b.duration)) + " · " +
          esc(money(b.price)) + " · Código " + esc(b.code) +
        "</p>" +
        (b.notes ? '<p class="bcard__notes">' + esc(b.notes) + "</p>" : "") +
        actionsMarkup(b) +
      "</div>" +
    "</article>";
  }

  function dayLabel(key) {
    var today = Jaazi.todayKey();
    if (key === today) return "<strong>Hoy</strong> · " + esc(cap(Jaazi.formatLong(key)));
    if (key === tomorrowKey()) return "<strong>Mañana</strong> · " + esc(cap(Jaazi.formatLong(key)));
    return "<strong>" + esc(cap(Jaazi.formatLong(key))) + "</strong>";
  }

  function renderBookings() {
    var list = filtered();
    listTitle.textContent = TITLES[state.filter];
    listCount.textContent = list.length ? list.length + (list.length === 1 ? " cita" : " citas") : "";

    if (!state.loaded) {
      listEl.innerHTML = '<p class="booking-empty">Cargando la agenda…</p>';
      return;
    }

    if (!list.length) {
      var empty = state.filter === "upcoming"
        ? "No hay citas próximas. Las reservas que lleguen desde la web aparecerán aquí."
        : state.filter === "today"
          ? "Hoy no hay citas agendadas."
          : "Todavía no hay citas pasadas ni canceladas.";
      listEl.innerHTML = '<p class="booking-empty">' + empty + "</p>";
      return;
    }

    var html = "";
    var lastDate = null;
    list.forEach(function (b) {
      if (b.date !== lastDate) {
        html += '<h3 class="day-sep">' + dayLabel(b.date) + "</h3>";
        lastDate = b.date;
      }
      html += cardMarkup(b);
    });
    listEl.innerHTML = html;
  }

  function renderMetrics() {
    var data = metrics();
    var bookingWord = function (n) { return n + (n === 1 ? " cita" : " citas"); };

    document.querySelector('[data-metric="today"]').textContent = money(data.today.total);
    document.querySelector('[data-metric-count="today"]').textContent = bookingWord(data.today.count);
    document.querySelector('[data-metric="week"]').textContent = money(data.week.total);
    document.querySelector('[data-metric-count="week"]').textContent = bookingWord(data.week.count);
    document.querySelector('[data-metric="upcoming"]').textContent = data.upcoming;
    document.querySelector('[data-metric-count="upcoming"]').textContent = bookingWord(data.upcoming);
  }

  /* ---------- Bloqueos ---------- */

  function renderBlocks() {
    if (!state.blocks.length) {
      blockListEl.innerHTML = '<p class="block-empty">No hay bloqueos próximos.</p>';
      return;
    }
    blockListEl.innerHTML = state.blocks.map(function (block) {
      return '<div class="block-item" data-block-id="' + esc(block.id) + '">' +
        '<div class="block-item__body">' +
          '<div class="block-item__when">' + esc(cap(Jaazi.formatLong(block.date))) + " · " + esc(block.start) + "–" + esc(block.end) + "</div>" +
          (block.reason ? '<div class="block-item__reason">' + esc(block.reason) + "</div>" : "") +
        "</div>" +
        '<button class="icon-btn" type="button" data-remove-block="' + esc(block.id) + '" aria-label="Quitar bloqueo" title="Quitar bloqueo">' +
          '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        "</button>" +
      "</div>";
    }).join("");
  }

  function render() {
    renderMetrics();
    renderBookings();
    renderBlocks();
  }

  /* ---------- Formulario de bloqueo ---------- */

  function options(from, to, step, selected) {
    var html = "";
    for (var m = from; m <= to; m += step) {
      var value = String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
      html += '<option value="' + value + '"' + (value === selected ? " selected" : "") + ">" + value + "</option>";
    }
    return html;
  }

  blockStart.innerHTML = options(Jaazi.OPEN, Jaazi.CLOSE - 30, 30, "12:00");
  blockEnd.innerHTML = options(Jaazi.OPEN + 30, Jaazi.CLOSE, 30, "13:00");
  blockDate.min = Jaazi.todayKey();
  blockDate.value = Jaazi.todayKey();

  function overlapsBooking(date, start, end) {
    return state.bookings.some(function (b) {
      if (b.date !== date || !isActive(b.status)) return false;
      return start < endTime(b.time, b.duration) && b.time < end;
    });
  }

  function overlapsBlock(date, start, end) {
    return state.blocks.some(function (b) {
      return b.date === date && start < b.end && b.start < end;
    });
  }

  function setBlockError(message) {
    blockError.textContent = message || "";
    blockError.hidden = !message;
  }

  blockForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var date = blockDate.value;
    var start = blockStart.value;
    var end = blockEnd.value;

    if (!date) {
      setBlockError("Elige un día para bloquear.");
      return;
    }
    if (date < Jaazi.todayKey()) {
      setBlockError("Ese día ya pasó. Elige hoy o una fecha futura.");
      return;
    }
    if (end <= start) {
      setBlockError("La hora final debe ser posterior a la inicial.");
      return;
    }
    if (overlapsBlock(date, start, end)) {
      setBlockError("Ya existe un bloqueo que se cruza con ese horario.");
      return;
    }
    if (overlapsBooking(date, start, end)) {
      setBlockError("Hay una cita en ese rango. Cancélala primero o elige otro horario.");
      return;
    }

    setBlockError("");
    var button = blockForm.querySelector('button[type="submit"]');
    button.disabled = true;

    withAuth(function () {
      return api.adminAddBlock({
        date: date,
        start: start,
        end: end,
        reason: blockReason.value.trim()
      });
    }).then(function () {
      blockReason.value = "";
      if (window.UI) UI.toast("Horario bloqueado.");
      loadAll(true);
    }, function (err) {
      setBlockError(api.friendly(err));
    }).then(function () {
      button.disabled = false;
    });
  });

  document.querySelector("[data-block-day]").addEventListener("click", function () {
    blockStart.value = "09:00";
    blockEnd.value = "19:00";
    if (!blockDate.value) blockDate.value = Jaazi.todayKey();
    blockStart.focus();
  });

  /* ---------- Acciones sobre citas ---------- */

  function updateStatus(id, status) {
    var patch = { status: status };
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();

    return withAuth(function () {
      return api.adminUpdateBooking(id, patch);
    }).then(function () {
      var booking = state.bookings.filter(function (b) { return b.id === id; })[0];
      if (booking) booking.status = status;
      if (booking && status === "cancelled") booking.cancelledAt = patch.cancelled_at;
      render();
      var messages = {
        confirmed: "Cita confirmada.",
        completed: "Cita marcada como completada.",
        cancelled: "Cita cancelada. El horario quedó libre."
      };
      if (window.UI) UI.toast(messages[status] || "Cita actualizada.");
    }, function (err) {
      setAlert(api.friendly(err));
      if (window.UI) UI.toast("No pudimos actualizar la cita.");
      loadAll(true);
    });
  }

  function openCancel(card, id) {
    var actions = card.querySelector("[data-actions]");
    if (!actions) return;
    actions.hidden = true;

    var confirm = document.createElement("div");
    confirm.className = "bconfirm";
    confirm.innerHTML =
      '<p>¿Cancelar esta cita? El cliente pierde el cupo.</p>' +
      '<button class="mini-btn" type="button" data-keep>Mantener</button>' +
      '<button class="mini-btn mini-btn--danger" type="button" data-do-cancel="' + esc(id) + '">Sí, cancelar</button>';
    actions.parentNode.insertBefore(confirm, actions.nextSibling);
    var keep = confirm.querySelector("[data-keep]");
    if (keep) keep.focus();
  }

  listEl.addEventListener("click", function (event) {
    var card = event.target.closest(".bcard");

    if (event.target.closest("[data-keep]") && card) {
      var confirm = card.querySelector(".bconfirm");
      var actions = card.querySelector("[data-actions]");
      if (confirm) confirm.remove();
      if (actions) actions.hidden = false;
      return;
    }

    var doCancel = event.target.closest("[data-do-cancel]");
    if (doCancel) {
      var cancelCard = doCancel.closest(".bcard");
      var confirmEl = cancelCard.querySelector(".bconfirm");
      if (confirmEl) confirmEl.remove();
      updateStatus(doCancel.dataset.doCancel, "cancelled");
      return;
    }

    var action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "cancel") {
      openCancel(card, action.dataset.id);
      return;
    }
    updateStatus(action.dataset.id, action.dataset.action);
  });

  /* ---------- Bloqueos: quitar ---------- */

  var pendingBlock = null;

  blockListEl.addEventListener("click", function (event) {
    var button = event.target.closest("[data-remove-block]");
    if (!button) return;
    var id = button.dataset.removeBlock;

    if (pendingBlock !== id) {
      pendingBlock = id;
      button.classList.add("is-confirming");
      button.setAttribute("title", "Pulsa otra vez para quitar");
      button.setAttribute("aria-label", "Pulsa otra vez para quitar el bloqueo");
      if (window.UI) UI.toast("Pulsa otra vez para quitar el bloqueo.");
      setTimeout(function () {
        if (pendingBlock === id) {
          pendingBlock = null;
          button.classList.remove("is-confirming");
          button.setAttribute("title", "Quitar bloqueo");
          button.setAttribute("aria-label", "Quitar bloqueo");
        }
      }, 4000);
      return;
    }

    pendingBlock = null;
    button.disabled = true;
    withAuth(function () {
      return api.adminDeleteBlock(id);
    }).then(function () {
      state.blocks = state.blocks.filter(function (b) { return b.id !== id; });
      renderBlocks();
      if (window.UI) UI.toast("Bloqueo eliminado.");
    }, function (err) {
      button.disabled = false;
      setAlert(api.friendly(err));
    });
  });

  /* ---------- Pestañas, refresco y arranque ---------- */

  document.querySelectorAll("[data-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      state.filter = tab.dataset.tab;
      document.querySelectorAll("[data-tab]").forEach(function (other) {
        other.setAttribute("aria-selected", other === tab ? "true" : "false");
      });
      document.getElementById("booking-panel").setAttribute("aria-labelledby", tab.id);
      renderBookings();
    });
  });

  refreshBtn.addEventListener("click", function () {
    loadAll();
  });

  setInterval(function () {
    if (!appView.hidden && document.visibilityState === "visible" && !state.busy) loadAll(true);
  }, 60000);

  document.addEventListener("visibilitychange", function () {
    if (!appView.hidden && document.visibilityState === "visible" && !state.busy) loadAll(true);
  });

  function init() {
    var today = Jaazi.todayKey();
    todayLabel.textContent = cap(Jaazi.formatLong(today)) + " · 9:00–19:00";

    if (!api) {
      showLogin();
      setAlert("Falta configurar la agenda: añade la URL y la anon key de Supabase en assets/js/config.js.");
      loginSubmit.disabled = true;
      return;
    }

    if (!api.enabled) {
      showLogin();
      setAlert("La agenda compartida aún no está configurada. Añade los datos de Supabase en assets/js/config.js.");
      loginSubmit.disabled = true;
      return;
    }

    if (api.isLoggedIn()) {
      showApp();
      return;
    }

    api.refresh().then(function (session) {
      if (session) showApp();
      else showLogin();
    });
  }

  init();
})();
