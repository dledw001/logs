/**
 * Minimal browser client for logs-backend auth.
 * Usage:
 *   const api = createClient({ baseUrl: "http://localhost:4000" });
 *   await api.login({ identifier: "alice", password: "password123" });
 *   const me = await api.me();
 */
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

export function createClient({ baseUrl = "" } = {}) {
  const base = baseUrl.replace(/\/$/, "");

  async function request(path, { method = "GET", body, csrf = true } = {}) {
    const headers = { "content-type": "application/json" };
    if (csrf && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
      const token = getCookie("csrf_token");
      if (token) headers["x-csrf-token"] = token;
    }
    const res = await fetch(`${base}${path}`, {
      method,
      credentials: "include",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { status: res.status, data: json };
  }

  return {
    register: (body) => request("/api/auth/register", { method: "POST", body, csrf: false }),
    login: (body) => request("/api/auth/login", { method: "POST", body, csrf: false }),
    logout: () => request("/api/auth/logout", { method: "POST" }),
    me: () => request("/api/auth/me"),
    session: () => request("/api/auth/session"),
    sessions: () => request("/api/auth/sessions"),
    revokeOtherSessions: () => request("/api/auth/sessions/revoke-others", { method: "POST" }),
    passwordResetRequest: (body) => request("/api/auth/password-reset/request", { method: "POST", body, csrf: false }),
    passwordResetComplete: (body) => request("/api/auth/password-reset/complete", { method: "POST", body, csrf: false }),
    verifyEmailRequest: () => request("/api/auth/email/verify/request", { method: "POST" }),
    verifyEmailComplete: (body) => request("/api/auth/email/verify/complete", { method: "POST", body, csrf: false }),
    changePassword: (body) => request("/api/auth/password/change", { method: "POST", body }),
    deleteAccount: () => request("/api/auth/account", { method: "DELETE" }),
  };
}
