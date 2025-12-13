import { hashPassword, verifyPassword } from "../src/auth/password.js";

describe("password helpers", () => {
  test("hashPassword rejects empty values", async () => {
    await expect(hashPassword("")).rejects.toThrow();
    await expect(hashPassword(null)).rejects.toThrow();
  });

  test("verifyPassword handles missing hash and empty input", async () => {
    expect(await verifyPassword("", null)).toBe(false);
    expect(await verifyPassword("", "fake")).toBe(false);
  });
});
