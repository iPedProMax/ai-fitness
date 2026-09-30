import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request
) {
  const requestUrl = new URL(
    request.url
  );

  const code =
    requestUrl.searchParams.get(
      "code"
    );

  if (!code) {
    const loginUrl = new URL(
      "/auth/login",
      requestUrl.origin
    );

    loginUrl.searchParams.set(
      "error",
      "Google sign in could not be completed."
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  const supabase =
    await createClient();

  const { error } =
    await supabase.auth.exchangeCodeForSession(
      code
    );

  if (error) {
    const loginUrl = new URL(
      "/auth/login",
      requestUrl.origin
    );

    loginUrl.searchParams.set(
      "error",
      "Google sign in could not be completed."
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  return NextResponse.redirect(
    new URL("/", requestUrl.origin)
  );
}