// services/auth.service.js
// Lightweight auth helper for MCM Stock App (CDN Vue)
// - Same-origin by default (API_BASE = '')
// - Adjust ENDPOINTS below to match your backend
// - Exposes `window.AuthAPI`

;(function () {
  // ============
  // CONFIG
  // ============
  const API_BASE =
    (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || ""; // e.g. "http://localhost:3000"

  const ENDPOINTS = {
    login:    "/api/v1/identity/auth/signin", // POST
    register: "/api/v1/identity/auth/signup", // POST (change if your backend differs)
    me:       "/api/v1/identity/auth/me"      // GET  (optional; change or leave as-is)
  };

  // localStorage keys
  const LS_KEYS = {
    token: "auth.token",
    tenant: "auth.tenant",
    username: "auth.username"
  };

  // ============
  // INTERNAL UTILS
  // ============
  function toUrl(path) {
    // Support absolute URLs or relative API paths
    if (/^https?:\/\//i.test(path)) return path;
    return API_BASE + path;
  }

  function jsonSafeParse(text) {
    try { return JSON.parse(text); } catch (e) { return {}; }
  }

  async function coreFetch(path, opts = {}) {
    const url = toUrl(path);
    const res = await fetch(url, opts);
    // Attempt to parse JSON; if none, use empty object
    let data = {};
    try {
      // Some APIs return JSON with proper content-type, others don't.
      const raw = await res.text();
      data = raw ? jsonSafeParse(raw) : {};
    } catch (_) {
      data = {};
    }
    return { res, data };
  }

  // ============
  // STORAGE
  // ============
  function storeAuth({ token, tenant, username }) {
    if (token != null)   localStorage.setItem(LS_KEYS.token, token);
    if (tenant != null)  localStorage.setItem(LS_KEYS.tenant, tenant);
    if (username != null) localStorage.setItem(LS_KEYS.username, username);
    // Optional: broadcast event for other tabs/components
    try {
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: loadAuth() }));
    } catch (_) {}
  }

  function clearAuth() {
    localStorage.removeItem(LS_KEYS.token);
    localStorage.removeItem(LS_KEYS.tenant);
    localStorage.removeItem(LS_KEYS.username);
    try {
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: loadAuth() }));
    } catch (_) {}
  }

  function loadAuth() {
    return {
      token: localStorage.getItem(LS_KEYS.token) || "",
      tenant: localStorage.getItem(LS_KEYS.tenant) || "",
      username: localStorage.getItem(LS_KEYS.username) || ""
    };
  }

  function isAuthenticated() {
    return !!localStorage.getItem(LS_KEYS.token);
  }

  // ============
  // REQUEST HELPERS
  // ============
  function authHeaders(extra = {}) {
    const { token, tenant } = loadAuth();
    const hdrs = {
      "Content-Type": "application/json",
      ...extra
    };
    if (token) hdrs.Authorization = `Bearer ${token}`;
    // Your code uses "x-tenant"; some backends reply with "x-tenant-id".
    if (tenant) hdrs["x-tenant"] = tenant;
    return hdrs;
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

  // Normalize response for the app
  function shape(res, data) {
    // Token/tenant may be in headers OR body (depends on your backend)
    const headerToken = (res.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const headerTenant = res.headers.get("x-tenant-id") || res.headers.get("x-tenant") || "";

    return {
      ok: res.ok,
      status: res.status,
      data,                // parsed JSON (or {})
      token: data.token || headerToken || "",
      tenant: data.tenant || headerTenant || ""
    };
  }

  // ============
  // PUBLIC API
  // ============
  /**
   * Register a new user.
   * payload: { fullName, email, phone, username, password }
   * Returns: { ok, status, data }
   */
  async function register(payload) {
    // Adjust ENDPOINTS.register if your backend expects a different route or field names
    return postJson(ENDPOINTS.register, payload, false);
  }

  /**
   * Login user.
   * payload: { username, password, tenant? }
   * Returns: { ok, status, data, token, tenant }
   */
  async function login(payload) {
    const result = await postJson(ENDPOINTS.login, payload, false);
    // If login succeeded, persist token/tenant/username
    if (result.ok && result.token) {
      storeAuth({
        token: result.token,
        tenant: result.tenant || payload.tenant || "",
        username: payload.username || ""
      });
    }
    return result;
  }

  /**
   * Get current user profile (optional endpoint).
   * Requires Authorization header.
   * Returns: { ok, status, data }
   */
  async function me() {
    return getJson(ENDPOINTS.me, true);
  }

  /**
   * Fetch wrapper that automatically includes Authorization + x-tenant.
   * Example: AuthAPI.fetch('/api/secure/resource', { method: 'GET' })
   */
  async function fetchAuth(path, options = {}) {
    const headers = authHeaders(options.headers || {});
    const { res, data } = await coreFetch(path, { ...options, headers });
    return shape(res, data);
  }

  // ============
  // EXPORT
  // ============
  window.AuthAPI = {
    // endpoints (in case you need to read/change at runtime)
    ENDPOINTS,
    // auth state
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
