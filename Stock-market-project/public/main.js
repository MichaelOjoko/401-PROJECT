// services/auth.service.js
// Lightweight auth helper for MCM Stock App (vanilla / Vue via CDN)
// - Same-origin by default (API_BASE = '')
// - Endpoints match Moleculer-Web aliases in api.service.js
// - Exposes `window.AuthAPI` and a global `logoutUser()`

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

  // =================
  // LOCAL STORAGE KEYS
  // =================
  const LS_KEYS = {
    token: "auth.token",
    email: "auth.email",
    name:  "auth.name",
    id:    "auth.id",
    role:  "auth.role"
  };

  // (one-time) migrate away from old tenant key if it exists
  try { localStorage.removeItem("auth.tenant"); } catch (_) {}

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
  function storeAuth({ token, email, name, id, role }) {
    if (token != null) localStorage.setItem(LS_KEYS.token, token);
    if (email != null) localStorage.setItem(LS_KEYS.email, email);
    if (name  != null) localStorage.setItem(LS_KEYS.name,  name);
    if (id    != null) localStorage.setItem(LS_KEYS.id,    String(id));
    if (role  != null) localStorage.setItem(LS_KEYS.role,  role);
    try { window.dispatchEvent(new CustomEvent("auth:changed", { detail: loadAuth() })); } catch (_) {}
  }

  function clearAuth() {
    Object.values(LS_KEYS).forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
    try { window.dispatchEvent(new CustomEvent("auth:changed", { detail: loadAuth() })); } catch (_) {}
  }

  function loadAuth() {
    return {
      token: localStorage.getItem(LS_KEYS.token) || "",
      email: localStorage.getItem(LS_KEYS.email) || "",
      name:  localStorage.getItem(LS_KEYS.name)  || "",
      id:    localStorage.getItem(LS_KEYS.id)    || "",
      role:  localStorage.getItem(LS_KEYS.role)  || ""
    };
  }

  function isAuthenticated() {
    return !!localStorage.getItem(LS_KEYS.token);
  }

  // =================
  // REQUEST HELPERS
  // =================
  function authHeaders(extra = {}) {
    const { token } = loadAuth();
    const hdrs = { "Content-Type": "application/json", ...extra };
    if (token) hdrs.Authorization = `Bearer ${token}`;
    return hdrs;
  }

  // Normalize response
  function shape(res, data) {
    // Token may come in headers or body
    const headerToken = (res.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    return {
      ok:     res.ok,
      status: res.status,
      data,
      token:  data.token || headerToken || ""
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
    return postJson(ENDPOINTS.register, {
      fullName: payload.fullName,
      email:    payload.email,
      password: payload.password
    }, false);
  }

  /**
   * Login with email OR username + password.
   * payload: { email, password } // UI uses "email" field but it may contain a username
   * Returns: { ok, status, data, token }
   */
  async function login(payload) {
    const idStr = (payload.email || "").trim();
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(idStr);

    const result = await postJson(ENDPOINTS.login, {
      password: payload.password,
      ...(looksLikeEmail ? { email: idStr } : { username: idStr })
    }, false);

    // Token can be in header or body
    const token = result.token || result?.data?.token || "";
    const user  = result?.data?.user || result?.data || {};
    const success = result.ok && (token || result?.data?.success === true);

    if (success) {
      storeAuth({
        token,
        email: user.email || (looksLikeEmail ? idStr : ""),
        name:  user.fullName || user.username || "",
        id:    user.id ?? user.userId ?? user._id ?? "",
        role:  user.role ?? user.userRole ?? ""
      });
    }
    return { ...result, token };
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

  // Global logout helper (use in nav: <a onclick="logoutUser()" href="#">Logout</a>)
  window.logoutUser = function () {
    try { clearAuth(); } catch (_){}
    window.location.href = "login.html";
  };
})();
