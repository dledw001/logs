# logs-backend (auth-first starter)

Opinionated Node/Express auth/ops starter with sessions, CSRF, rate limits, roles, audit logging, OpenAPI docs, and a minimal browser SDK. Includes a Next.js UI shell under `frontend/` for trying the API.

## Quick start
```bash
git clone <repo>
cd logs/backend
cp .env.example .env      # update DATABASE_URL / secrets
npm install
npm run migrate:up:dev
npm start
```

Endpoints:
- Docs: http://localhost:4000/docs
- Swagger: http://localhost:4000/swagger.html
- SDK demo (same-origin): http://localhost:4000/sdk-test.html
- OpenAPI: http://localhost:4000/openapi.json
- Next UI: http://localhost:3000 (after running `npm run dev` in `frontend/`)

## Common scripts
From `backend/`:
- `npm run dev` – nodemon dev server
- `npm run test` / `npm run test:coverage`
- `npm run migrate:up:dev` / `npm run migrate:up:test`
- `npm run wipe:db` – **danger** wipe dev/test DBs

From `frontend/` (Next.js):
- `npm run dev` / `npm run build` / `npm run start`
- Copy `.env.local.example` to `.env.local` to point the proxy at your backend (defaults to http://localhost:4000).

## Adding a route
1. Create a file in `src/routes/` (e.g., `hello.js`), export an Express router.
2. Mount it in `src/routes/index.js`.
3. If it needs auth, use `requireAuth` (and `withPolicy`/`requireRole` if needed).
4. Add to `public/openapi.json` and optionally `public/docs.html`.
5. Add a test in `test/` (use supertest or TestClient).

Example `src/routes/hello.js`:
```js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { withPolicy } from "../auth/authorization.js";

const router = Router();
router.get("/", requireAuth, withPolicy(() => ({ allow: true })), (req, res) => {
  res.json({ message: `Hi ${req.user.username}` });
});

export default router;
```

Mount in `src/routes/index.js`:
```js
import helloRoutes from "./hello.js";
router.use("/hello", helloRoutes);
```

Test (e.g., `test/hello.test.js`):
```js
import request from "supertest";
import app from "../src/app.js";

test("hello returns greeting when authenticated", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ username: "h1", email: "h1@example.com", password: "password123" });
  await agent.post("/api/auth/login").send({ identifier: "h1", password: "password123" });
  const res = await agent.get("/api/hello");
  expect(res.status).toBe(200);
});
```

## Notes
- Auth uses HttpOnly cookie sessions (`sid`), CSRF double-submit, rate limits, and audit logging (file + optional DB).
- Ops endpoints: `/health`, `/ready`, `/metrics`, `/api/config`, `/api/admin/audit-log` (admin).
- Browser SDK at `/sdk.js`; see `/sdk-test.html` for a working demo.
