import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import { getSupabaseConfig } from "./config";

const originalUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const originalKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

afterEach(() => {
  if (originalUrl === undefined) {
    delete process.env
      .NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      originalUrl;
  }

  if (originalKey === undefined) {
    delete process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } else {
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      originalKey;
  }
});

describe("Supabase config", () => {
  it("rejects a missing project URL", () => {
    delete process.env
      .NEXT_PUBLIC_SUPABASE_URL;

    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "test-key";

    expect(() =>
      getSupabaseConfig()
    ).toThrow(
      "Missing NEXT_PUBLIC_SUPABASE_URL."
    );
  });

  it("rejects a missing publishable key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://example.supabase.co";

    delete process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(() =>
      getSupabaseConfig()
    ).toThrow(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  });

  it("returns valid configuration", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://example.supabase.co";

    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "test-key";

    expect(
      getSupabaseConfig()
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "test-key",
    });
  });
});