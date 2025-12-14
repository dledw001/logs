# logs-frontend (Next.js shell)

Minimal Next.js app router UI that proxies the auth backend so you can exercise login, sessions, and docs from a browser.

## Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local   # optional, defaults work if backend on localhost:4000
npm run dev
```

Then open http://localhost:3000. Requests to `/api/*`, `/docs`, `/swagger.html`, and `/openapi.json` are rewritten to the backend target set in `API_BASE_URL` (defaults to `http://localhost:4000`), keeping cookies same-origin with the Next app.

## Environment
Copy `.env.local.example` if you need overrides:
- `API_BASE_URL` – backend origin for rewrites (server-side).
- `NEXT_PUBLIC_API_BASE_URL` – leave empty to use relative paths (recommended for cookie auth); set only if you intentionally call a different origin.

## Notes
- Non-GET requests automatically attach `x-csrf-token` from the `csrf_token` cookie.
- If you point the UI at a different origin without a proxy, update backend cookies to `SameSite=None; Secure` and set CORS `ALLOWED_ORIGINS` appropriately.
- The home page shows links to the backend docs and Swagger UI and provides quick actions: register, login, me, session list, revoke others, logout, and config.
