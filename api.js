(() => {
  const cfg = () => window.ALE_ATENCIO_CONFIG || {};

  const configured = () => {
    const u = String(cfg().API_URL || "").trim();
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/[A-Za-z0-9_-]+\/?$/i.test(u);
  };

  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  function makeError(message, status = 0, payload = null) {
    const err = new Error(String(message || "API_ERROR"));
    err.status = status;
    err.payload = payload;
    return err;
  }

  async function request(action, data = {}, token = "", options = {}) {
    if (!configured()) throw makeError("API_NO_CONFIGURADA");
    const timeoutMs = Number(options.timeoutMs || cfg().REQUEST_TIMEOUT_MS || 12000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = { "Content-Type": "application/json" };
    if (token) {
      // La API usa sesión propia de public.sesiones, NO JWT/Supabase Auth.
      headers["X-Ale-Session"] = String(token);
    }

    try {
      const response = await fetch(cfg().API_URL, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        headers,
        body: JSON.stringify({ action, data, token }),
        signal: controller.signal
      });

      const text = await response.text();
      let payload = {};
      try { payload = text ? JSON.parse(text) : {}; }
      catch (_) { throw makeError("RESPUESTA_API_INVALIDA", response.status, { raw:text.slice(0,500) }); }

      if (!response.ok || payload?.ok === false) {
        throw makeError(payload?.error || `HTTP_${response.status}`, response.status, payload);
      }
      return payload;
    } catch (err) {
      if (err?.name === "AbortError") throw makeError("API_TIMEOUT");
      if (err instanceof TypeError && /fetch/i.test(String(err.message || ""))) throw makeError("API_CONEXION_FALLIDA");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function pingReliable() {
    let lastErr = null;
    for (const timeoutMs of [8000, 15000]) {
      try {
        const out = await request("ping", {}, "", {timeoutMs});
        if (out?.ok) return out;
        lastErr = makeError(out?.error || "PING_ERROR");
      } catch (err) { lastErr = err; }
      await sleep(350);
    }
    throw lastErr || makeError("BACKEND_PUBLIC_CHECK_FAILED");
  }

  async function verifyRecord(type, id, attempts = 4) {
    let last = null;
    for (let i = 0; i < attempts; i++) {
      if (i) await sleep(300 + i * 150);
      try {
        last = await request("checkrecord", {type, id}, "", {timeoutMs:8000});
        if (last?.ok && last?.exists) return last;
      } catch (_) {}
    }
    return last || {ok:false, exists:false, id};
  }

  function isAmbiguousTransportError(err){
    const code=String(err?.message||err||"").toUpperCase();
    return ["API_TIMEOUT","API_CONEXION_FALLIDA","RESPUESTA_API_INVALIDA","REGISTRO_NO_CONFIRMADO"].some(x=>code.includes(x));
  }

  window.AleAPI = {
    configured,

    async get(action, params = {}) {
      return request(action, params, "");
    },

    async ping() {
      return pingReliable();
    },

    async post(action, data = {}, token = "") {
      return request(action, data, token);
    },

    async postPublic(action, data = {}) {
      return request(action, data, "", {timeoutMs:/^(createorder|createrequest)$/i.test(String(action||"")) ? 18000 : undefined});
    },

    async login(username, password) {
      const user = String(username || "admin").trim() || "admin";
      const pass = String(password || "");
      if (!pass) throw makeError("CREDENCIALES_REQUERIDAS");
      return request("login", {usuario:user, password:pass}, "", {timeoutMs:15000});
    },

    async publicBootstrap() {
      return request("bootstrap", {}, "", {timeoutMs:15000});
    },

    async adminBootstrap(token) {
      return request("adminbootstrap", {}, token, {timeoutMs:18000});
    },

    async notificationFeed(since, token) {
      return request("notificationfeed", {since:String(since || "")}, token, {timeoutMs:8000});
    },

    async savePriceVerified(data = {}, token = "") {
      const out = await request("saveprice", data, token, {timeoutMs:12000});
      return {...out, verified:true};
    },

    async saveProductVerified(data = {}, token = "") {
      const out = await request("saveproduct", data, token, {timeoutMs:15000});
      return {...out, verified:true};
    },

    async uploadQuotePdf(data = {}, token = "") {
      return request("uploadquotepdf", data, token, {timeoutMs:30000});
    },

    async backendStatus() {
      try {
        const out = await pingReliable();
        return {
          ok:true,
          version:String(out.version || "SUPABASE"),
          service:String(out.service || "ALE_ATENCIO_API"),
          raw:out
        };
      } catch (err) {
        return {ok:false, error:String(err?.message || err || "PING_ERROR")};
      }
    },

    verifyRecord,
    isAmbiguousTransportError,

    fileToDataUrl(file) {
      return new Promise((resolve,reject)=>{
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }
  };
})();
