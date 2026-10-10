import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Returns null only for a verified Supabase Auth user. */
export async function requireFoodApiAuth(): Promise<NextResponse | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json(
        { error: "Sign in to use AI Fitness analysis." },
        { status: 401 }
      );
    }
    return null;
  } catch {
    // A server-side Supabase failure is NOT proof the visitor is unauthenticated.
    // Fail closed without exposing credentials or upstream error details.
    return NextResponse.json(
      { error: "Authentication is temporarily unavailable." },
      { status: 503 }
    );
  }
}