/* =========================================================
   Jaazi Barber — cliente de datos (Supabase REST)
   Sin dependencias: fetch + funciones RPC.
   ========================================================= */

window.JaaziApi = (function () {
  "use strict";

  var cfg = window.JAAZI_CONFIG || {};
  var base = String(cfg.supabaseUrl || "").replace(/\/+$/, "");
  var anonKey = String(cfg.supabaseAnonKey || "");
  var enabled = Boolean(base && anonKey);
  var SESSION_KEY = "jaazi.panel.session";

  function ApiError(code, message, status) {
    this.name = "ApiError";
    this.code = code || "error";
    this.message = message || "No pudimos completar la operación.";
    this.status = status || 0;
  }
  ApiError.prototype = Object.create(Error.prototype);

  /* ---------- Sesión del panel ---------- */

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  function writeSession(session) {
    try {
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (err) { /* modo privado */ }
  }

  function session() {
    return readSession();
  }

  function token() {
    var s = readSession();
    return s && s.access_token ? s.access_token : anonKey;
  }

  function isLoggedIn() {
    var s = readSession();
    return Boolean(s && s.access_token && s.expires_at > Date.now());
  }

  /* ---------- HTTP ---------- */

  function request(path, options) {
    options = options || {};
    var headers = {
      apikey: anonKey,
      Accept: "application/json"
    };
    if (options.auth !== false) {
      headers.Authorization = "Bearer " + token();
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    var init = {
      method: options.method || "GET",
      headers: headers,
      cache: "no-store"
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);

    return fetch(base + path, init).then(function (response) {
      var type = response.headers.get("content-type") || "";
      var parse = type.indexOf("json") >= 0 ? response.json() : response.text();
      return parse.then(function (payload) {
        if (!response.ok) {
          var message = "error";
          var details = "";
          if (payload && typeof payload === "object") {
            message = payload.message || payload.error_description || payload.error || "error";
            details = payload.details || payload.hint || "";
            if (message.indexOf("duplicate key") >= 0) message = "duplicate";
          }
          throw new ApiError(message, details || message, response.status);
        }
        return payload;
      });
    }, function () {
      throw new ApiError("offline", "No hay conexión con la agenda. Revisa tu internet e inténtalo de nuevo.");
    });
  }

  /* ---------- Traducción de errores ---------- */

  var MESSAGES = {
    slot_taken: "Ese horario acaba de ocuparse. Elige otro, por favor.",
    outside_hours: "La hora de inicio debe estar entre 9:00 am y 7:00 pm (domingos, entre 12:00 pm y 5:00 pm). Elige otra.",
    invalid_slot: "Ese horario ya no está disponible. Elige otro.",
    invalid_name: "Revisa tu nombre.",
    invalid_phone: "Revisa tu teléfono.",
    service_not_found: "Ese servicio ya no está disponible.",
    booking_not_found: "No encontramos una cita activa con ese código y teléfono.",
    duplicate: "Ya existe una cita en ese horario. Elige otro."
  };

  function friendly(error) {
    var code = error && error.code;
    return (MESSAGES[code] || (error && error.message) || "No pudimos completar la operación.");
  }

  /* ---------- Disponibilidad ---------- */

  function toMinutes(value) {
    var parts = String(value || "00:00").split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function shortTime(value) {
    return String(value || "").slice(0, 5);
  }

  function mapBusy(rows) {
    var map = {};
    (rows || []).forEach(function (row) {
      var key = String(row.date);
      if (!map[key]) map[key] = [];
      map[key].push([toMinutes(row.start_time), toMinutes(row.end_time)]);
    });
    return map;
  }

  function busy(fromKey, toKey) {
    if (!enabled) return Promise.resolve({});
    var path = "/rest/v1/public_busy?select=date,start_time,end_time" +
      "&date=gte." + encodeURIComponent(fromKey) +
      "&date=lte." + encodeURIComponent(toKey) +
      "&limit=5000";
    return request(path).then(mapBusy);
  }

  /* ---------- Reserva ---------- */

  function mapBooking(row) {
    var booking = {
      code: row.code,
      serviceId: row.serviceId || row.service_id,
      serviceName: row.serviceName || row.service_name,
      price: row.price,
      priceLabel: window.Jaazi ? Jaazi.formatPrice(row.price) : "$ " + row.price,
      duration: row.duration,
      date: String(row.date),
      time: shortTime(row.time),
      name: row.name,
      phone: row.phone,
      email: row.email || "",
      notes: row.notes || "",
      status: row.status || "confirmed",
      createdAt: row.created_at || row.createdAt || null
    };
    return booking;
  }

  function create(payload) {
    if (!enabled) return Promise.reject(new ApiError("disabled", "La agenda no está configurada."));
    return request("/rest/v1/rpc/create_booking", {
      method: "POST",
      body: {
        p_service_id: payload.serviceId,
        p_date: payload.date,
        p_time: payload.time,
        p_name: payload.name,
        p_phone: payload.phone,
        p_email: payload.email || null,
        p_notes: payload.notes || null
      }
    }).then(mapBooking);
  }

  function lookup(code, phone) {
    if (!enabled) return Promise.resolve([]);
    return request("/rest/v1/rpc/lookup_bookings", {
      method: "POST",
      body: { p_code: code, p_phone: phone }
    }).then(function (rows) {
      return (rows || []).map(mapBooking);
    });
  }

  function cancel(code, phone) {
    if (!enabled) return Promise.resolve(false);
    return request("/rest/v1/rpc/cancel_booking", {
      method: "POST",
      body: { p_code: code, p_phone: phone }
    });
  }

  function reschedule(code, phone, date, time) {
    if (!enabled) return Promise.resolve(null);
    return request("/rest/v1/rpc/reschedule_booking", {
      method: "POST",
      body: {
        p_code: code,
        p_phone: phone,
        p_date: date,
        p_time: time
      }
    }).then(mapBooking);
  }

  /* ---------- Panel: sesión ---------- */

  function me() {
    return request("/rest/v1/rpc/panel_whoami", {
      method: "POST",
      body: {}
    });
  }

  function login(email, password) {
    return request("/auth/v1/token?grant_type=password", {
      method: "POST",
      auth: false,
      body: { email: email, password: password }
    }).then(function (data) {
      var session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 30000,
        email: (data.user && data.user.email) || email
      };
      writeSession(session);
      return session;
    });
  }

  function refresh() {
    var s = readSession();
    if (!s || !s.refresh_token) return Promise.resolve(null);
    return request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      auth: false,
      body: { refresh_token: s.refresh_token }
    }).then(function (data) {
      var session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || s.refresh_token,
        expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 30000,
        email: (data.user && data.user.email) || s.email
      };
      writeSession(session);
      return session;
    }, function () {
      writeSession(null);
      return null;
    });
  }

  function logout() {
    var s = readSession();
    if (s && s.access_token) {
      request("/auth/v1/logout", { method: "POST" }).catch(function () { /* noop */ });
    }
    writeSession(null);
  }

  /* ---------- Panel: citas ---------- */

  function adminBookings(query) {
    return request("/rest/v1/bookings?select=*&" + (query || "order=date.asc,time.asc"))
      .then(function (rows) {
        return (rows || []).map(function (row) {
          return Object.assign(mapBooking(row), {
            id: row.id,
            serviceName: row.service_name,
            serviceId: row.service_id,
            status: row.status,
            createdAt: row.created_at
          });
        });
      });
  }

  function adminUpdateBooking(id, patch) {
    return request("/rest/v1/bookings?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      body: patch
    });
  }

  /* ---------- Panel: bloqueos ---------- */

  function adminBlocks(fromKey, toKey) {
    var query = "select=*&order=date.asc,start_time.asc";
    if (fromKey) query += "&date=gte." + encodeURIComponent(fromKey);
    if (toKey) query += "&date=lte." + encodeURIComponent(toKey);
    return request("/rest/v1/blocks?" + query).then(function (rows) {
      return (rows || []).map(function (row) {
        return {
          id: row.id,
          date: String(row.date),
          start: shortTime(row.start_time),
          end: shortTime(row.end_time),
          reason: row.reason || ""
        };
      });
    });
  }

  function adminAddBlock(block) {
    return request("/rest/v1/blocks", {
      method: "POST",
      body: {
        date: block.date,
        start_time: block.start,
        end_time: block.end,
        reason: block.reason || null
      }
    });
  }

  function adminDeleteBlock(id) {
    return request("/rest/v1/blocks?id=eq." + encodeURIComponent(id), { method: "DELETE" });
  }

  return {
    enabled: enabled,
    enabledFor: function () { return enabled; },
    busy: busy,
    create: create,
    lookup: lookup,
    cancel: cancel,
    reschedule: reschedule,
    friendly: friendly,
    login: login,
    refresh: refresh,
    logout: logout,
    isLoggedIn: isLoggedIn,
    me: me,
    session: session,
    adminBookings: adminBookings,
    adminUpdateBooking: adminUpdateBooking,
    adminBlocks: adminBlocks,
    adminAddBlock: adminAddBlock,
    adminDeleteBlock: adminDeleteBlock,
    ApiError: ApiError
  };
})();
