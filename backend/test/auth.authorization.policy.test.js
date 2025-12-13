import { withPolicy } from "../src/auth/authorization.js";

function makeReqRes() {
  const req = {};
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

describe("withPolicy helper", () => {
  test("allows when policy returns allow=true", async () => {
    const { req, res } = makeReqRes();
    let nextCalled = false;
    const mw = withPolicy(() => ({ allow: true }));
    await mw(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  test("denies when policy returns allow=false", async () => {
    const { req, res } = makeReqRes();
    const mw = withPolicy(() => ({ allow: false, reason: "nope" }));
    await mw(req, res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "nope" });
  });

  test("500s on policy throw", async () => {
    const { req, res } = makeReqRes();
    const mw = withPolicy(() => {
      throw new Error("boom");
    });
    await mw(req, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "internal server error" });
  });
});
