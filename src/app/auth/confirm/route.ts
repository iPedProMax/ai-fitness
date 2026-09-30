import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const tokenHash =
    requestUrl.searchParams.get("token_hash");

  const type =
    requestUrl.searchParams.get(
      "type"
    ) as EmailOtpType | null;

  if (!tokenHash || !type) {
    const loginUrl = new URL(
      "/auth/login",
      requestUrl.origin
    );

    loginUrl.searchParams.set(
      "error",
      "Email confirmation link is invalid or incomplete."
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  const supabase =
    await createClient();

  const { error } =
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

  if (error) {
    const loginUrl = new URL(
      "/auth/login",
      requestUrl.origin
    );

    loginUrl.searchParams.set(
      "error",
      "Email confirmation could not be completed."
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  return NextResponse.redirect(
    new URL("/", requestUrl.origin)
  );
}