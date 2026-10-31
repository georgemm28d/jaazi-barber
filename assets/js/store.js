/* =========================================================
   Jaazi Barber — datos y utilidades compartidas
   Reservas locales (localStorage). Sin backend.
   ========================================================= */

window.Jaazi = (function () {
  "use strict";

  var KEY = "jaazi.bookings.v1";
  var OPEN = 10 * 60;        // 10:00
  var CLOSE = 20 * 60;       // 20:00
  var STEP = 30;             // cada 30 min
  var LEAD = 120;            // 2 h de antelación para hoy

  var SERVICES = [
    {
      id: "corte",
      name: "Corte clásico",
      price: 28,
      duration: 45,
      meta: "45 min · tijera y máquina",
      desc: "Tijera, máquina, lavado y peinado. El corte de siempre, bien hecho."
    },
    {
      id: "corte-barba",
      name: "Corte + barba",
      price: 40,
      duration: 75,
      meta: "75 min · corte y perfilado",
      desc: "El paquete completo: corte, perfilado de barba y toalla caliente."
    },
    {
      id: "barba",
      name: "Afeitado a navaja",
      price: 25,
      duration: 40,
      meta: "40 min · navaja y toalla caliente",
      desc: "Navaja, aceite pre-shave y bálsamo. El ritual de siempre."
    },
    {
      id: "perfilado",
      name: "Perfilado",
      price: 15,
      duration: 25,
      meta: "25 min · contornos y nuca",
      desc: "Contornos, nuca y patillas entre cortes. Rápido y preciso."
    },
    {
      id: "asesoria",
      name: "Asesoría de imagen",
      price: 35,
      duration: 60,
      meta: "60 min · diagnóstico y rutina",
      desc: "Forma de cara, rutina y producto. Te vas con un plan claro."
    }
  ];

  var DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var DAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function pad(n) { return String(n).padStart(2, "0"); }

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

  function todayKey() { return keyOf(new Date()); }

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
    var suffix = h >= 12 ? "p.m." : "a.m.";
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

  function isClosed(key) {
    var day = parseKey(key).getDay();
    return day === 0 || day === 1; // domingo y lunes
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
      for (var i = 0; i < 4; i++) {
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

  function overlaps(dateKey, start, duration) {
    var end = start + duration;
    var list = read();
    return list.some(function (b) {
      if (b.date !== dateKey) return false;
      var s = minutesOf(b.time);
      return start < s + (b.duration || 45) && s < end;
    });
  }

  function slotsFor(dateKey, duration) {
    if (!dateKey || isClosed(dateKey)) return [];
    var now = new Date();
    var isToday = dateKey === todayKey();
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    var result = [];
    for (var start = OPEN; start + duration <= CLOSE; start += STEP) {
      if (isToday && start < nowMinutes + LEAD) continue;
      var time = timeOf(start);
      var available = !pseudoTaken(dateKey, time) && !overlaps(dateKey, start, duration);
      result.push({ time: time, available: available });
    }
    return result;
  }

  function isDayAvailable(dateKey, duration) {
    return slotsFor(dateKey, duration).some(function (s) { return s.available; });
  }

  function nextAvailable(serviceId, maxDays) {
    var service = getService(serviceId) || SERVICES[0];
    var limit = maxDays || 14;
    for (var i = 0; i < limit; i++) {
      var key = keyOf(addDays(new Date(), i));
      if (isClosed(key)) continue;
      var slots = slotsFor(key, service.duration);
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
    return start.getTime() + (booking.duration || 45) * 60000 < Date.now();
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
    var description = "Cita " + booking.code + " con Jaazi. Cambios o cancelaciones: hola@jaazibarber.mx";
    var location = "Calle Colima 168, Roma Norte, Ciudad de México";
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Jaazi Barber//Citas//ES",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:" + booking.code + "@jaazibarber.mx",
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
    todayKey: todayKey,
    timeLabel: timeLabel,
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
    findBooking: findBooking,
    slotsFor: slotsFor,
    isDayAvailable: isDayAvailable,
    nextAvailable: nextAvailable,
    isPast: isPast,
    downloadICS: downloadICS
  };
})();
