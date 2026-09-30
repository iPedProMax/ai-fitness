import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  createClientMock,
  signInWithPasswordMock,
  signUpMock,
  signInWithOAuthMock,
  signOutMock,
  redirectMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signUpMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
  signOutMock: vi.fn(),
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
  signInWithGoogle,
  signOut,
  signUpWithEmail,
} from "./actions";

describe("auth actions", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    signInWithPasswordMock.mockReset();
    signUpMock.mockReset();
    signInWithOAuthMock.mockReset();
    signOutMock.mockReset();
    redirectMock.mockReset();

    process.env.NEXT_PUBLIC_SITE_URL =
      "http://localhost:3000";

    createClientMock.mockResolvedValue({
      auth: {
        signInWithPassword:
          signInWithPasswordMock,
        signUp: signUpMock,
        signInWithOAuth:
          signInWithOAuthMock,
        signOut: signOutMock,
      },
    });
  });

  it("does not call Supabase when login credentials are invalid", async () => {
    const formData = new FormData();

    formData.set(
      "email",
      "not-an-email"
    );

    formData.set(
      "password",
      ""
    );

    await signInWithEmail(
      formData
    );

    expect(
      createClientMock
    ).not.toHaveBeenCalled();

    expect(
      signInWithPasswordMock
    ).not.toHaveBeenCalled();

    expect(
      redirectMock
    ).toHaveBeenCalledWith(
      expect.stringContaining(
        "/auth/login?error="
      )
    );
  });

  it("calls Supabase with normalized valid login credentials", async () => {
    signInWithPasswordMock.mockResolvedValue(
      {
        error: null,
      }
    );

    const formData = new FormData();

    formData.set(
      "email",
      "  PED@example.COM  "
    );

    formData.set(
      "password",
      "password123"
    );

    await signInWithEmail(
      formData
    );

    expect(
      signInWithPasswordMock
    ).toHaveBeenCalledWith({
      email:
        "ped@example.com",
      password:
        "password123",
    });

    expect(
      redirectMock
    ).toHaveBeenCalledWith("/");
  });

  it("does not call Supabase when sign-up passwords do not match", async () => {
    const formData = new FormData();

    formData.set(
      "email",
      "ped@example.com"
    );

    formData.set(
      "password",
      "password123"
    );

    formData.set(
      "confirmPassword",
      "different123"
    );

    await signUpWithEmail(
      formData
    );

    expect(
      createClientMock
    ).not.toHaveBeenCalled();

    expect(
      signUpMock
    ).not.toHaveBeenCalled();

    expect(
      redirectMock
    ).toHaveBeenCalledWith(
      expect.stringContaining(
        "/auth/sign-up?error="
      )
    );
  });

  it("calls Supabase for valid sign-up credentials", async () => {
    signUpMock.mockResolvedValue({
      error: null,
    });

    const formData = new FormData();

    formData.set(
      "email",
      "PED@example.COM"
    );

    formData.set(
      "password",
      "password123"
    );

    formData.set(
      "confirmPassword",
      "password123"
    );

    await signUpWithEmail(
      formData
    );

    expect(
      signUpMock
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        email:
          "ped@example.com",
        password:
          "password123",
      })
    );
  });

  it("starts Google OAuth with the auth callback URL", async () => {
    signInWithOAuthMock.mockResolvedValue(
      {
        data: {
          url: "https://accounts.google.com/example",
        },
        error: null,
      }
    );

    await signInWithGoogle();

    expect(
      signInWithOAuthMock
    ).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "http://localhost:3000/auth/callback",
      },
    });

    expect(
      redirectMock
    ).toHaveBeenCalledWith(
      "https://accounts.google.com/example"
    );
  });

  it("signs the user out and redirects to login", async () => {
    signOutMock.mockResolvedValue({
      error: null,
    });

    await signOut();

    expect(
      signOutMock
    ).toHaveBeenCalled();

    expect(
      redirectMock
    ).toHaveBeenCalledWith(
      "/auth/login"
    );
  });
});