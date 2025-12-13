import { jest } from "@jest/globals";
import { handleHealth, handleMetrics, handleDocs, handleOpenApi } from "../src/app.js";

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headers["content-type"] = "application/json";
      this.finished = true;
      return this;
    },
  send(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
  type(value) {
      this.headers["content-type"] = value;
      return this;
    },
  sendFile(filePath) {
      this.body = filePath;
      if (!this.headers["content-type"] && filePath.endsWith(".html")) {
        this.headers["content-type"] = "text/html";
      }
      this.finished = true;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
  };
  return res;
}

describe("top-level routes", () => {
  afterEach(() => {
    jest.resetModules();
  });

  test("GET /health returns ok", async () => {
    const res = makeRes();
    handleHealth({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ service: "logs-backend", status: "ok" });
  });

  test("GET /metrics returns snapshot fields", async () => {
    const res = makeRes();
    handleMetrics({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("requests_total");
    expect(res.body).toHaveProperty("errors_total");
  });

  test("GET /docs serves HTML", async () => {
    const res = makeRes();
    await handleDocs({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.finished).toBe(true);
  });

  test("GET /ready returns ready when DB ok", async () => {
    jest.unstable_mockModule("../src/db/db.js", () => ({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      pool: { end: jest.fn() },
    }));
    const { handleReady } = await import(`../src/app.js?ready-ok=${Date.now()}`);
    const res = makeRes();
    await handleReady({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ service: "logs-backend", status: "ready" });
  });

  test("GET /ready returns 503 when DB fails", async () => {
    jest.unstable_mockModule("../src/db/db.js", () => ({
      query: jest.fn().mockRejectedValue(new Error("db down")),
      pool: { end: jest.fn() },
    }));
    const { handleReady } = await import(`../src/app.js?ready-fail=${Date.now()}`);
    const res = makeRes();
    await handleReady({}, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ service: "logs-backend", status: "degraded", error: "db_unreachable" });
  });

  test("GET /openapi.json serves spec", async () => {
    const res = makeRes();
    await handleOpenApi({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toContain("openapi");
  });
});
