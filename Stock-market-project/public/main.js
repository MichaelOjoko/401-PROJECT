// services/auth.service.js
// Lightweight auth helper for MCM Stock App (Vue via CDN)
// - Same-origin by default (API_BASE = '')
// - Endpoints match Moleculer-Web aliases in api.service.js
// - Exposes `window.AuthAPI`

;(function () {
  // =================
  // CONFIG
  // =================
  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || ""; // e.g. "http://localhost:3000"

  const ENDPOINTS = {
    login:    "/api/users/login",     // POST -> core-logic.loginUser
    register: "/api/users/register",  // POST -> core-logic.registerUser
    me:       "/api/users/me"         // optional; keep if you implement it
  };

  // localStorage keys
  const LS_KEYS = {
    token:   "auth.token",
    tenant:  "auth.tenant",
    email:   "auth.email",
    name:    "auth.name"
  };

  // =================
  // INTERNAL UTILS
  // =================
  function toUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return API_BASE + path;
  }

  function jsonSafeParse(text) {
    try { return JSON.parse(text); } catch (_) { return {}; }
  }

  async function coreFetch(path, opts = {}) {
    const url = toUrl(path);
    const res = await fetch(url, opts);
    let data = {};
    try {
      const raw = await res.text();
      data = raw ? jsonSafeParse(raw) : {};
    } catch (_) { data = {}; }
    return { res, data };
  }

  // =================
  // STORAGE
  // =================
  function storeAuth({ token, tenant, email, name, user }) {
    if (token != null)  localStorage.setItem(LS_KEYS.token, token);
    if (tenant != null) localStorage.setItem(LS_KEYS.tenant, tenant);
    if (email != null)  localStorage.setItem(LS_KEYS.email, email);
    if (name != null)   localStorage.setItem(LS_KEYS.name, name);

    // Optional: broadcast change
    try { window.dispatchEvent(new CustomEvent("auth:changed", { detail: loadAuth() })); } catch (_) {}
  }

  function clearAuth() {
    localStorage.removeItem(LS_KEYS.token);
    localStorage.removeItem(LS_KEYS.tenant);
    localStorage.removeItem(LS_KEYS.email);
    localStorage.removeItem(LS_KEYS.name);
    try { window.dispatchEvent(new CustomEvent("auth:changed", { detail: loadAuth() })); } catch (_) {}
  }

  function loadAuth() {
    return {
      token:  localStorage.getItem(LS_KEYS.token)  || "",
      tenant: localStorage.getItem(LS_KEYS.tenant) || "",
      email:  localStorage.getItem(LS_KEYS.email)  || "",
      name:   localStorage.getItem(LS_KEYS.name)   || ""
    };
  }

  function isAuthenticated() {
    return !!localStorage.getItem(LS_KEYS.token);
  }

  // =================
  // REQUEST HELPERS
  // =================
  function authHeaders(extra = {}) {
    const { token, tenant } = loadAuth();
    const hdrs = { "Content-Type": "application/json", ...extra };
    if (token)  hdrs.Authorization = `Bearer ${token}`;
    if (tenant) hdrs["x-tenant"] = tenant; // keep if you use tenants
    return hdrs;
  }

  function shape(res, data) {
    // Token/tenant may come from body OR headers
    const headerToken  = (res.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const headerTenant = res.headers.get("x-tenant-id") || res.headers.get("x-tenant") || "";
    return {
      ok:     res.ok,
      status: res.status,
      data,
      token:  data.token  || headerToken || "",
      tenant: data.tenant || headerTenant || ""
    };
  }

  async function postJson(path, body, includeAuth = false) {
    const headers = includeAuth ? authHeaders() : { "Content-Type": "application/json" };
    const { res, data } = await coreFetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {})
    });
    return shape(res, data);
  }

  async function getJson(path, includeAuth = false) {
    const headers = includeAuth ? authHeaders() : {};
    const { res, data } = await coreFetch(path, { headers });
    return shape(res, data);
  }

  // =================
  // PUBLIC ACTIONS
  // =================

  /**
   * Register a new user.
   * payload: { fullName, email, password }
   * Returns: { ok, status, data }
   */
  async function register(payload) {
    // Expect backend to validate & return 201 + { id, fullName, email } on success
    return postJson(ENDPOINTS.register, {
      fullName: payload.fullName,
      email:    payload.email,
      password: payload.password
    }, false);
  }

  /**
   * Login with email + password.
   * payload: { email, password, tenant? }
   * Returns: { ok, status, data, token, tenant }
   */
  async function login(payload) {
    const result = await postJson(ENDPOINTS.login, {
      email:    payload.email,
      password: payload.password,
      tenant:   payload.tenant || undefined
    }, false);

    if (result.ok && result.token) {
      const user = result?.data?.user || {};
      storeAuth({
        token:  result.token,
        tenant: result.tenant || payload.tenant || "",
        email:  payload.email,
        name:   user.fullName || user.username || ""
      });
    }
    return result;
  }

  /**
   * Optional: current-user profile (if you wire it up).
   */
  async function me() {
    return getJson(ENDPOINTS.me, true);
  }

  /**
   * Authorized fetch helper.
   */
  async function fetchAuth(path, options = {}) {
    const headers = authHeaders(options.headers || {});
    const { res, data } = await coreFetch(path, { ...options, headers });
    return shape(res, data);
  }

  // =================
  // EXPORT
  // =================
  window.AuthAPI = {
    ENDPOINTS,
    // state
    storeAuth,
    loadAuth,
    clearAuth,
    isAuthenticated,
    // actions
    register,
    login,
    me,
    fetch: fetchAuth
  };
})();
