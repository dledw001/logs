import { jest } from "@jest/globals";
import { recordError } from "../src/metrics/metrics.js";
import app from "../src/app.js";

// Minimal mock res to drive the error handler
function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("app error handler", () => {
  test("returns 500 with request_id when error thrown", async () => {
    // express 5 stores middleware on app.router.stack
    const layers = app.router.stack.filter((l) => l.handle && l.handle.length === 4);
    const errHandler = layers[layers.length - 1].handle;
    const res = makeRes();
    const req = { id: "req-123", path: "/boom", method: "GET" };
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const metricsSpy = jest.spyOn({ recordError }, "recordError").mockImplementation(() => {});

    await errHandler(new Error("boom"), req, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "internal server error", request_id: "req-123" });

    spy.mockRestore();
    metricsSpy.mockRestore();
  });
});
