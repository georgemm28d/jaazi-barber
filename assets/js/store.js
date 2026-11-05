/* =========================================================
   Jaazi Barber — datos y utilidades compartidas
   Reservas locales (localStorage). Sin backend.
   ========================================================= */

window.Jaazi = (function () {
  "use strict";

  var KEY = "jaazi.bookings.v2";
  var SHOP_TZ = "America/Bogota";
  var OPEN = 9 * 60;         // 9:00
  var CLOSE = 19 * 60;       // 19:00
  var STEP = 30;             // cada 30 min
  var LEAD = 120;            // 2 h de antelación para hoy

  var SERVICES = [
    {
      id: "corte-personalizado",
      name: "Corte personalizado",
      price: 27000,
      duration: 45,
      meta: "45 min · tijera y máquina",
      desc: "Tijera y máquina, adaptado a tu rostro y a tu rutina."
    },
    {
      id: "corte-barba",
      name: "Corte + barba",
      price: 35000,
      duration: 60,
      meta: "60 min · corte y barba",
      desc: "Corte completo más perfilado y arreglo de barba."
    },
    {
      id: "barba",
      name: "Barba",
      price: 15000,
      duration: 30,
      meta: "30 min · perfilado y acabado",
      desc: "Perfilado, arreglo y acabado de barba."
    },
    {
      id: "colores-fantasia",
      name: "Colores fantasía",
      price: 120000,
      duration: 120,
      meta: "2 h · color a elección",
      desc: "Color a elección con preparación y acabado."
    },
    {
      id: "mechas-platinadas",
      name: "Mechas platinadas",
      price: 250000,
      duration: 240,
      meta: "4 h · incluye corte",
      desc: "Platinado por mechas, incluye corte."
    },
    {
      id: "platinado-global",
      name: "Platinado global",
      price: 250000,
      duration: 240,
      meta: "4 h · incluye corte",
      desc: "Platinado completo de raíz a puntas, incluye corte."
    }
  ];

  var DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var DAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function pad(n) { return String(n).padStart(2, "0"); }

  /* La agenda trabaja en hora de Colombia, no en la del visitante.
     Devuelve un Date cuyos componentes locales son la hora de Bogotá. */
  var shopFormatter = null;
  function shopNow() {
    var now = new Date();
    if (!shopFormatter) {
      try {
        shopFormatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: SHOP_TZ,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false
        });
      } catch (err) {
        shopFormatter = null;
      }
    }
    if (!shopFormatter || !shopFormatter.formatToParts) return now;

    var parts = {};
    shopFormatter.formatToParts(now).forEach(function (part) {
      parts[part.type] = part.value;
    });
    return new Date(
      parseInt(parts.year, 10),
      parseInt(parts.month, 10) - 1,
      parseInt(parts.day, 10),
      parseInt(parts.hour, 10) % 24,
      parseInt(parts.minute, 10),
      parseInt(parts.second, 10)
    );
  }

  function keyOf(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function parseKey(key) {
    var p = String(key).split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function addDays(date, days) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + days);
    return d;
  }

  function todayKey() { return keyOf(shopNow()); }

  function minutesOf(time) {
    var p = String(time).split(":").map(Number);
    return p[0] * 60 + p[1];
  }

  function timeOf(minutes) {
    return pad(Math.floor(minutes / 60)) + ":" + pad(minutes % 60);
  }

  function timeLabel(time) {
    var p = String(time).split(":").map(Number);
    var h = p[0];
    var suffix = h >= 12 ? "pm" : "am";
    var h12 = h % 12 || 12;
    return h12 + ":" + pad(p[1]) + " " + suffix;
  }

  function formatLong(key) {
    var d = parseKey(key);
    return DAY_NAMES[d.getDay()] + " " + d.getDate() + " de " + MONTHS[d.getMonth()];
  }

  function formatMedium(key) {
    var d = parseKey(key);
    return DAY_SHORT[d.getDay()] + " " + d.getDate() + " " + MONTHS_SHORT[d.getMonth()];
  }

  function formatPrice(value) {
    if (value === null || value === undefined || value === "") return "Consultar";
    var digits = String(Math.round(Number(value)));
    var out = "";
    for (var i = 0; i < digits.length; i++) {
      var left = digits.length - i;
      out += digits.charAt(i);
      if (left > 1 && left % 3 === 1) out += ".";
    }
    return "$ " + out;
  }

  function durationLabel(minutes) {
    var m = Number(minutes) || 0;
    if (m >= 120 && m % 60 === 0) return m / 60 + " h";
    return m + " min";
  }

  function isClosed(key) {
    return false; // abre todos los días
  }

  function getService(id) {
    for (var i = 0; i < SERVICES.length; i++) {
      if (SERVICES[i].id === id) return SERVICES[i];
    }
    return null;
  }

  /* ---------- Almacenamiento ---------- */

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      return false;
    }
  }

  function addBooking(data) {
    var list = read();
    var booking = {
      code: makeCode(list),
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      price: data.price,
      priceLabel: formatPrice(data.price),
      duration: data.duration,
      date: data.date,
      time: data.time,
      name: data.name,
      phone: data.phone,
      email: data.email || "",
      notes: data.notes || "",
      createdAt: new Date().toISOString()
    };
    list.push(booking);
    write(list);
    return booking;
  }

  function makeCode(list) {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var code = "";
    do {
      code = "JZ-";
      for (var i = 0; i < 6; i++) {
        code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
      }
    } while (list.some(function (b) { return b.code === code; }));
    return code;
  }

  function removeBooking(code) {
    var list = read();
    var index = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) { index = i; break; }
    }
    if (index === -1) return null;
    var removed = list.splice(index, 1)[0];
    write(list);
    return removed;
  }

  function restoreBooking(booking) {
    var list = read();
    list.push(booking);
    write(list);
  }

  function updateBooking(code, patch) {
    var list = read();
    var updated = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].code !== code) continue;
      updated = Object.assign({}, list[i], patch);
      list[i] = updated;
      break;
    }
    if (!updated) return null;
    return write(list) ? updated : null;
  }

  function findBooking(query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return null;
    var digits = q.replace(/\D/g, "");
    var list = read();
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.code.toLowerCase() === q) return b;
      var phone = String(b.phone || "").replace(/\D/g, "");
      if (digits.length >= 7 && phone && (phone === digits || phone.slice(-10) === digits.slice(-10))) {
        return b;
      }
    }
    return null;
  }

  /* ---------- Disponibilidad ---------- */

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pseudoTaken(dateKey, time) {
    return hash(dateKey + "|" + time) % 100 < 26;
  }

  function overlaps(dateKey, start, duration, excludeCode) {
    var end = start + duration;
    var list = read();
    return list.some(function (b) {
      if (excludeCode && b.code === excludeCode) return false;
      if (b.date !== dateKey) return false;
      var s = minutesOf(b.time);
      return start < s + (b.duration || 45) && s < end;
    });
  }

  function busyOverlaps(busy, dateKey, start, duration) {
    var ranges = busy && busy[dateKey];
    if (!ranges || !ranges.length) return false;
    var end = start + duration;
    return ranges.some(function (range) {
      return start < range[1] && range[0] < end;
    });
  }

  function slotsFor(dateKey, duration, busy, excludeCode) {
    if (!dateKey || isClosed(dateKey)) return [];
    var now = shopNow();
    var isToday = dateKey === todayKey();
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    var result = [];
    // CLOSE es el último inicio permitido, no el fin de la jornada:
    // una cita puede terminar después de las 19:00.
    for (var start = OPEN; start <= CLOSE; start += STEP) {
      if (isToday && start < nowMinutes + LEAD) continue;
      var time = timeOf(start);
      var available = busy
        ? !busyOverlaps(busy, dateKey, start, duration)
        : !pseudoTaken(dateKey, time) && !overlaps(dateKey, start, duration, excludeCode);
      result.push({ time: time, available: available });
    }
    return result;
  }

  function isDayAvailable(dateKey, duration, busy) {
    return slotsFor(dateKey, duration, busy).some(function (s) { return s.available; });
  }

  function nextAvailable(serviceId, maxDays, busy) {
    var service = getService(serviceId) || SERVICES[0];
    var limit = maxDays || 14;
    var base = shopNow();
    for (var i = 0; i < limit; i++) {
      var key = keyOf(addDays(base, i));
      if (isClosed(key)) continue;
      var slots = slotsFor(key, service.duration, busy);
      for (var j = 0; j < slots.length; j++) {
        if (slots[j].available) {
          return { date: key, time: slots[j].time, service: service };
        }
      }
    }
    return null;
  }

  function isPast(booking) {
    var d = parseKey(booking.date);
    var start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutesOf(booking.time) / 60), minutesOf(booking.time) % 60);
    return start.getTime() + (booking.duration || 45) * 60000 < shopNow().getTime();
  }

  /* ---------- Calendario (.ics) ---------- */

  function icsDate(dateKey, time, duration) {
    var d = parseKey(dateKey);
    var start = minutesOf(time);
    var end = start + (duration || 45);
    function stamp(mins) {
      var dayOffset = Math.floor(mins / 1440);
      var m = mins % 1440;
      var dt = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset);
      return dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate()) + "T" +
        pad(Math.floor(m / 60)) + pad(m % 60) + "00";
    }
    return { start: stamp(start), end: stamp(end) };
  }

  function ics(booking) {
    var dates = icsDate(booking.date, booking.time, booking.duration);
    var summary = booking.serviceName + " — Jaazi Barber";
    var description = "Cita " + booking.code + " con Jaazi Barber. Cambios o cancelaciones: Jaazielbarber09@gmail.com";
    var location = "Calle 4 # 1-39, Conjunto Serralta, Torre 12, Apto 205, Chía, Cundinamarca";
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Jaazi Barber//Citas//ES",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:" + booking.code + "@jaazi-barber",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      "DTSTART:" + dates.start,
      "DTEND:" + dates.end,
      "SUMMARY:" + summary.replace(/[,;]/g, "\\$&"),
      "DESCRIPTION:" + description.replace(/[,;]/g, "\\$&"),
      "LOCATION:" + location.replace(/[,;]/g, "\\$&"),
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    return lines.join("\r\n") + "\r\n";
  }

  function downloadICS(booking) {
    var blob = new Blob([ics(booking)], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "jaazi-cita-" + booking.code + ".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  return {
    SERVICES: SERVICES,
    OPEN: OPEN,
    CLOSE: CLOSE,
    keyOf: keyOf,
    parseKey: parseKey,
    addDays: addDays,
    shopNow: shopNow,
    todayKey: todayKey,
    timeLabel: timeLabel,
    formatPrice: formatPrice,
    durationLabel: durationLabel,
    formatLong: formatLong,
    formatMedium: formatMedium,
    dayName: function (key) { return DAY_SHORT[parseKey(key).getDay()]; },
    dayNumber: function (key) { return parseKey(key).getDate(); },
    monthShort: function (key) { return MONTHS_SHORT[parseKey(key).getMonth()]; },
    isClosed: isClosed,
    getService: getService,
    read: read,
    addBooking: addBooking,
    removeBooking: removeBooking,
    restoreBooking: restoreBooking,
    updateBooking: updateBooking,
    findBooking: findBooking,
    slotsFor: slotsFor,
    isDayAvailable: isDayAvailable,
    nextAvailable: nextAvailable,
    isPast: isPast,
    downloadICS: downloadICS
  };
})();
