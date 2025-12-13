import { authHandlers } from "../../src/routes/auth.js";
import { requireAuth } from "../../src/middleware/auth.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "../../src/middleware/csrf.js";

function serializeCookie(name, value, options = {}) {
    const parts = [`${name}=${value}`];

    if (options.maxAge !== undefined) {
        parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
    }
    if (options.path) {
        parts.push(`Path=${options.path}`);
    }
    if (options.httpOnly) {
        parts.push("HttpOnly");
    }
    if (options.secure) {
        parts.push("Secure");
    }
    if (options.sameSite) {
        const mode =
            typeof options.sameSite === "string"
                ? options.sameSite
                : options.sameSite === true
                    ? "Strict"
                    : "";
        if (mode) {
            const formatted = mode.charAt(0).toUpperCase() + mode.slice(1);
            parts.push(`SameSite=${formatted}`);
        }
    }

    return parts.join("; ");
}

function createMockResponse() {
    const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        finished: false,
        headersSent: false,
        locals: {},
        setHeader(key, value) {
            this.headers[key.toLowerCase()] = value;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            this.headers["content-type"] = "application/json";
            this.finished = true;
            this.headersSent = true;
            return this;
        },
        send(payload) {
            this.body = payload;
            this.finished = true;
            this.headersSent = true;
            return this;
        },
        cookie(name, value, options = {}) {
            const serialized = serializeCookie(name, value, options);
            this.headers["set-cookie"] = this.headers["set-cookie"] || [];
            this.headers["set-cookie"].push(serialized);
            return this;
        },
        clearCookie(name, options = {}) {
            const cleared = { ...options, maxAge: 0 };
            return this.cookie(name, "", cleared);
        },
        location(url) {
            this.headers["location"] = url;
            return this;
        },
    };

    return res;
}

async function runStack(stack, req, res) {
    let idx = 0;

    const next = async () => {
        if (idx >= stack.length || res.finished) return;
        const fn = stack[idx++];
        let nextCalled = false;
        await fn(req, res, () => {
            nextCalled = true;
        });
        res.headersSent = res.headersSent || res.finished;
        if (nextCalled && !res.finished) {
            return next();
        }
    };

    await next();
}

export class TestClient {
    constructor() {
        this.cookies = {};
    }

    async register(body) {
        return this._invoke(authHandlers.register, { body, path: "/register", method: "POST" });
    }

    async login(body) {
        return this._invoke(authHandlers.login, { body, path: "/login", method: "POST" });
    }

    async logout() {
        return this._invoke(authHandlers.logout, { body: {}, path: "/logout", method: "POST" });
    }

    async me() {
        return this._invoke(authHandlers.me, {
            middleware: [requireAuth],
            path: "/me",
            method: "GET",
        });
    }

    async passwordResetRequest(body) {
        return this._invoke(authHandlers.passwordResetRequest, {
            body,
            path: "/password-reset/request",
            method: "POST",
        });
    }

    async passwordResetComplete(body) {
        return this._invoke(authHandlers.passwordResetComplete, {
            body,
            path: "/password-reset/complete",
            method: "POST",
        });
    }

    getCookie(name) {
        return this.cookies[name];
    }

    _cookieHeader() {
        return Object.entries(this.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
    }

    _captureCookies(setCookieHeader) {
        if (!setCookieHeader) return;
        const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
        for (const entry of cookies) {
            const [pair] = entry.split(";");
            const [name, value = ""] = pair.split("=");
            if (!name) continue;
            if (value === "") {
                delete this.cookies[name];
            } else {
                this.cookies[name] = value;
            }
        }
    }

    async _invoke(handler, { body = {}, middleware = [], path = "/", method = "POST", csrf = true } = {}) {
        const req = {
            method,
            path,
            url: path,
            headers: {},
            body,
            cookies: { ...this.cookies },
            ip: "127.0.0.1",
            get(field) {
                return this.headers[field.toLowerCase()];
            },
        };

        if (Object.keys(this.cookies).length > 0) {
            req.headers.cookie = this._cookieHeader();
        }

        if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrf) {
            const csrf = this.cookies[CSRF_COOKIE_NAME];
            if (csrf) {
                req.headers[CSRF_HEADER_NAME] = csrf;
            }
        }

        const res = createMockResponse();

        const stack = [];
        if (handler) stack.push(handler);
        await runStack([...middleware, ...stack], req, res);
        this._captureCookies(res.headers["set-cookie"]);
        return res;
    }
}

export function createClient() {
    return new TestClient();
}
