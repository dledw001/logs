import { jest } from "@jest/globals";
import { requireRole, hasRole } from "../src/auth/authorization.js";

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
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
};

describe("authorization helpers", () => {
  test("hasRole checks role membership", () => {
    expect(hasRole({ roles: ["admin"] }, "admin")).toBe(true);
    expect(hasRole({ roles: ["user"] }, "admin")).toBe(false);
    expect(hasRole({}, "admin")).toBe(false);
  });

  test("requireRole denies when role missing", () => {
    const middleware = requireRole("admin");
    const req = { user: { roles: ["user"] } };
    const res = makeRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  test("requireRole allows when role present", () => {
    const middleware = requireRole("admin");
    const req = { user: { roles: ["admin", "user"] } };
    const res = makeRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(next).toHaveBeenCalled();
  });
});
