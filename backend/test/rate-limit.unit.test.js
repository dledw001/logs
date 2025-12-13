import { jest } from "@jest/globals";
import { createRateLimiter } from "../src/middleware/rate-limit.js";

function makeReq(ip = "127.0.0.1") {
  return { ip, headers: {} };
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
  };
  return res;
}

describe("rate-limit middleware", () => {
  test("blocks and sets Retry-After when exceeding limit", () => {
    const limiter = createRateLimiter({
      windowMs: 1000,
      max: 1,
      blockDurationMs: 2000,
      name: "test-limit",
    });

    const next = jest.fn();

    // first call passes
    let req = makeReq();
    let res = makeRes();
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // second call hits block
    req = makeReq();
    res = makeRes();
    next.mockClear();
    limiter(req, res, next);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "test-limit temporarily blocked" });
    expect(res.headers["retry-after"]).toBeDefined();
    expect(next).not.toHaveBeenCalled();
  });
});
