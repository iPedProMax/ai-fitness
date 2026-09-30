import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  signInWithPasswordMock,
  signUpMock,
  redirectMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signUpMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import {
  signInWithEmail,
  signUpWithEmail,
} from "./actions";

describe("auth actions", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    signInWithPasswordMock.mockReset();
    signUpMock.mockReset();
    redirectMock.mockReset();

    createClientMock.mockResolvedValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
      },
    });
  });

  it("does not call Supabase when login credentials are invalid", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("password", "");

    await signInWithEmail(formData);

    expect(createClientMock).not.toHaveBeenCalled();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login?error=")
    );
  });

  it("calls Supabase with normalized valid login credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: null,
    });

    const formData = new FormData();
    formData.set("email", "  PED@example.COM  ");
    formData.set("password", "password123");

    await signInWithEmail(formData);

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "ped@example.com",
      password: "password123",
    });

    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("does not call Supabase when sign-up passwords do not match", async () => {
    const formData = new FormData();
    formData.set("email", "ped@example.com");
    formData.set("password", "password123");
    formData.set("confirmPassword", "different123");

    await signUpWithEmail(formData);

    expect(createClientMock).not.toHaveBeenCalled();
    expect(signUpMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/sign-up?error=")
    );
  });

  it("calls Supabase for valid sign-up credentials", async () => {
    signUpMock.mockResolvedValue({
      error: null,
    });

    const formData = new FormData();
    formData.set("email", "PED@example.COM");
    formData.set("password", "password123");
    formData.set("confirmPassword", "password123");

    await signUpWithEmail(formData);

    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ped@example.com",
        password: "password123",
      })
    );
  });
});