import { handleConfig } from "../src/app.js";

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
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
}

test("config endpoint exposes session and rate limit settings", () => {
  process.env.SESSION_MAX_PER_USER = "3";
  process.env.SESSION_IDLE_TIMEOUT_MINUTES = "45";
  process.env.SESSION_TTL_DAYS = "10";
  process.env.SESSION_ROLLING_RENEWAL_MINUTES = "30";
  process.env.LOGIN_LIMIT_IP_MAX = "5";
  process.env.LOGIN_LIMIT_ID_MAX = "4";
  process.env.LOGIN_LIMIT_WINDOW_MS = "10000";
  process.env.RESET_LIMIT_MAX = "2";
  process.env.RESET_LIMIT_WINDOW_MS = "20000";

  const res = makeRes();
  handleConfig({}, res);
  expect(res.statusCode).toBe(200);
  expect(res.body.session.max_per_user).toBe(3);
  expect(res.body.session.idle_timeout_minutes).toBe(45);
  expect(res.body.rate_limits.login_ip_max).toBe(5);
});
