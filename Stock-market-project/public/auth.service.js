// public/auth.service.js
(function () {
  const ENDPOINTS = {
    register: "/api/users/register",
    login: "/api/users/login"
  };

  async function coreFetch(url, opts) {
    const res = await fetch(url, opts);
    let data = {};
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch (_) {}
    return { res, data };
  }

  async function register(payload) {
    const { res, data } = await coreFetch(ENDPOINTS.register, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data };
  }

  async function login(payload) {
    const { res, data } = await coreFetch(ENDPOINTS.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data };
  }

  window.AuthAPI = { register, login };
})();
