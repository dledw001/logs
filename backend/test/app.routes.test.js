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

  test("GET /openapi.json serves spec", async () => {
    const res = makeRes();
    await handleOpenApi({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toContain("openapi");
  });
});
