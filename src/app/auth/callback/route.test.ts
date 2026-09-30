import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  createClientMock,
  exchangeCodeForSessionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  exchangeCodeForSessionMock: vi.fn(),
}));

vi.mock(
  "@/lib/supabase/server",
  () => ({
    createClient: createClientMock,
  })
);

import { GET } from "./route";

describe("auth callback", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    exchangeCodeForSessionMock.mockReset();

    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession:
          exchangeCodeForSessionMock,
      },
    });
  });

  it("exchanges a valid authorization code and redirects home", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: null,
    });

    const request = new Request(
      "http://localhost/auth/callback?code=test-code"
    );

    const response = await GET(request);

    expect(
      exchangeCodeForSessionMock
    ).toHaveBeenCalledWith("test-code");

    expect(response.status).toBe(307);

    expect(
      response.headers.get("location")
    ).toBe("http://localhost/");
  });

  it("redirects to login when the authorization code is missing", async () => {
    const request = new Request(
      "http://localhost/auth/callback"
    );

    const response = await GET(request);

    expect(
      exchangeCodeForSessionMock
    ).not.toHaveBeenCalled();

    expect(response.status).toBe(307);

    expect(
      response.headers.get("location")
    ).toContain("/auth/login?error=");
  });

  it("redirects to login when the code exchange fails", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: new Error(
        "Invalid authorization code"
      ),
    });

    const request = new Request(
      "http://localhost/auth/callback?code=bad-code"
    );

    const response = await GET(request);

    expect(
      exchangeCodeForSessionMock
    ).toHaveBeenCalledWith("bad-code");

    expect(response.status).toBe(307);

    expect(
      response.headers.get("location")
    ).toContain("/auth/login?error=");
  });
});