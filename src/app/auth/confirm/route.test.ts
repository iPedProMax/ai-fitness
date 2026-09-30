import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  createClientMock,
  verifyOtpMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  verifyOtpMock: vi.fn(),
}));

vi.mock(
  "@/lib/supabase/server",
  () => ({
    createClient: createClientMock,
  })
);

import { GET } from "./route";

describe("email confirmation", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    verifyOtpMock.mockReset();

    createClientMock.mockResolvedValue({
      auth: {
        verifyOtp: verifyOtpMock,
      },
    });
  });

  it("verifies the email token and redirects home", async () => {
    verifyOtpMock.mockResolvedValue({
      error: null,
    });

    const request = new Request(
      "http://localhost/auth/confirm?token_hash=test-token&type=email"
    );

    const response = await GET(request);

    expect(
      verifyOtpMock
    ).toHaveBeenCalledWith({
      token_hash: "test-token",
      type: "email",
    });

    expect(response.status).toBe(307);

    expect(
      response.headers.get("location")
    ).toBe("http://localhost/");
  });

  it("redirects to login when confirmation information is missing", async () => {
    const request = new Request(
      "http://localhost/auth/confirm"
    );

    const response = await GET(request);

    expect(
      verifyOtpMock
    ).not.toHaveBeenCalled();

    expect(
      response.headers.get("location")
    ).toContain("/auth/login?error=");
  });

  it("redirects to login when verification fails", async () => {
    verifyOtpMock.mockResolvedValue({
      error: new Error(
        "Invalid token"
      ),
    });

    const request = new Request(
      "http://localhost/auth/confirm?token_hash=bad-token&type=email"
    );

    const response = await GET(request);

    expect(
      response.headers.get("location")
    ).toContain("/auth/login?error=");
  });
});