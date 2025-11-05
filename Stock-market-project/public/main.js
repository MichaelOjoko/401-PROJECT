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

  // Balance cache (prevents UI from flashing back to "—")
  const BAL_KEY = "acct.balance";

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
    try { localStorage.removeItem(BAL_KEY); } catch(_){}
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
  async function register(payload) {
    return postJson(ENDPOINTS.register, {
      fullName: payload.fullName,
      email:    payload.email,
      password: payload.password
    }, false);
  }

  async function login(payload) {
    const idStr = (payload.email || "").trim();
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(idStr);

    const result = await postJson(ENDPOINTS.login, {
      password: payload.password,
      ...(looksLikeEmail ? { email: idStr } : { username: idStr })
    }, false);

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
      try { localStorage.removeItem(BAL_KEY); } catch(_){}
      // keep redirect control with caller
    }
    return { ...result, token };
  }

  async function me() {
    return getJson(ENDPOINTS.me, true);
  }

  async function fetchAuth(path, options = {}) {
    const headers = authHeaders(options.headers || {});
    const { res, data } = await coreFetch(path, { ...options, headers });
    return shape(res, data);
  }

  // =================
  // REDIRECT HELPERS
  // =================
  function getReturnTo(defaultPath = "market.html") {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("returnTo") || defaultPath;
    } catch (_) {
      return defaultPath;
    }
  }

  function redirectAfterLogin(email) {
    const isAdmin = (email || "").toLowerCase().endsWith("@asu.edu");
    const fallback = isAdmin ? "admin-hub.html" : "market.html";
    const to = getReturnTo(fallback);
    window.location.href = to;
  }

  // =================
  // ACCOUNT HELPERS (BALANCE)
  // =================
  function getCachedBalance() {
    const v = localStorage.getItem(BAL_KEY);
    return v == null ? null : Number(v);
  }
  function setCachedBalance(v) {
    try { localStorage.setItem(BAL_KEY, String(v)); } catch(_){}
    try { window.dispatchEvent(new CustomEvent("account:balance-changed", { detail: { balance: Number(v) } })); } catch(_){}
  }

  async function fetchBalanceLive() {
    // Try common shapes; normalize to {balance, currency}
    const tryGet = async (u) => { try { const r = await getJson(u, true); return r.ok ? r.data : null; } catch(_){ return null; } };

    let data = await tryGet("/api/accounts/users/balance");
    if (!data) data = await tryGet("/api/accounts/users/summary");
    if (!data) data = await tryGet("/api/users/me");

    let bal = null, cur = "USD";
    if (data) {
      if (typeof data.balance === "number") { bal = data.balance; cur = data.currency || cur; }
      else if (typeof data.cash_balance === "number") { bal = data.cash_balance; cur = data.currency || cur; }
      else if (data.account && typeof data.account.cash_balance === "number") { bal = data.account.cash_balance; cur = data.account.currency || cur; }
      else if (Array.isArray(data.accounts) && data.accounts[0] && typeof data.accounts[0].cash_balance === "number") {
        bal = data.accounts[0].cash_balance; cur = data.accounts[0].currency || cur;
      }
    }
    if (bal != null) setCachedBalance(bal);
    return { balance: bal, currency: cur };
  }

  // =================
  // EXPORT + ACCESS GUARDS
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
    fetch: fetchAuth,

    // redirects
    getReturnTo,
    redirectAfterLogin,

    // balance helpers
    getCachedBalance,
    setCachedBalance,
    fetchBalanceLive,

    // ACCESS GUARDS
    requireLogin() {
      const { token } = window.AuthAPI.loadAuth();
      if (!token) window.location.replace("login.html");
    },

    requireAdmin() {
      const auth = window.AuthAPI.loadAuth();
      if (!auth.token) return window.location.replace("login.html");
      const isAsuAdmin = (auth.email || "").toLowerCase().endsWith("@asu.edu");
      if (!isAsuAdmin) return window.location.replace("index.html");
    }
  };

  // Global logout helper
  window.logoutUser = function () {
    try { clearAuth(); } catch (_) {}
    window.location.href = "login.html";
  };
})();
