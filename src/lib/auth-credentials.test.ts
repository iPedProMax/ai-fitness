import { describe, expect, it } from "vitest";

import {
  validateLoginCredentials,
  validateSignUpCredentials,
} from "./auth-credentials";

describe("auth credential validation", () => {
  it("accepts valid login credentials and normalizes the email", () => {
    const result = validateLoginCredentials({
      email: "  PED@example.COM  ",
      password: "password123",
    });

    expect(result).toEqual({
      success: true,
      data: {
        email: "ped@example.com",
        password: "password123",
      },
    });
  });

  it("rejects a malformed email", () => {
    const result = validateLoginCredentials({
      email: "not-an-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a blank login password", () => {
    const result = validateLoginCredentials({
      email: "ped@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a short sign-up password", () => {
    const result = validateSignUpCredentials({
      email: "ped@example.com",
      password: "12345",
      confirmPassword: "12345",
    });

    expect(result.success).toBe(false);
  });

  it("rejects mismatched sign-up passwords", () => {
    const result = validateSignUpCredentials({
      email: "ped@example.com",
      password: "password123",
      confirmPassword: "different123",
    });

    expect(result.success).toBe(false);
  });
});