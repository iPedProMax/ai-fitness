"use server";

import { redirect } from "next/navigation";

import {
  validateLoginCredentials,
  validateSignUpCredentials,
} from "@/lib/auth-credentials";
import { createClient } from "@/lib/supabase/server";

function getFirstError(
  errors: Record<string, string>
) {
  return (
    Object.values(errors)[0] ??
    "Please check your information."
  );
}

export async function signInWithEmail(
  formData: FormData
) {
  const validation =
    validateLoginCredentials({
      email: String(
        formData.get("email") ?? ""
      ),
      password: String(
        formData.get("password") ?? ""
      ),
    });

  if (!validation.success) {
    const message = getFirstError(
      validation.errors
    );

    return redirect(
      `/auth/login?error=${encodeURIComponent(
        message
      )}`
    );
  }

  const supabase =
    await createClient();

  const { error } =
    await supabase.auth.signInWithPassword(
      {
        email:
          validation.data.email,
        password:
          validation.data.password,
      }
    );

  if (error) {
    return redirect(
      `/auth/login?error=${encodeURIComponent(
        "Unable to sign in. Check your email and password."
      )}`
    );
  }

  return redirect("/");
}

export async function signUpWithEmail(
  formData: FormData
) {
  const validation =
    validateSignUpCredentials({
      email: String(
        formData.get("email") ?? ""
      ),
      password: String(
        formData.get("password") ?? ""
      ),
      confirmPassword: String(
        formData.get(
          "confirmPassword"
        ) ?? ""
      ),
    });

  if (!validation.success) {
    const message = getFirstError(
      validation.errors
    );

    return redirect(
      `/auth/sign-up?error=${encodeURIComponent(
        message
      )}`
    );
  }

  const supabase =
    await createClient();

  const { error } =
    await supabase.auth.signUp({
      email:
        validation.data.email,
      password:
        validation.data.password,
    });

  if (error) {
    return redirect(
      `/auth/sign-up?error=${encodeURIComponent(
        "Unable to create your account. Please try again."
      )}`
    );
  }

  return redirect(
    `/auth/login?message=${encodeURIComponent(
      "Account created. Check your email if confirmation is required, then sign in."
    )}`
  );
}

export async function signInWithGoogle() {
  const supabase =
    await createClient();

  const siteUrl =
    process.env
      .NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const { data, error } =
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });

  if (error || !data.url) {
    return redirect(
      `/auth/login?error=${encodeURIComponent(
        "Unable to start Google sign in."
      )}`
    );
  }

  return redirect(data.url);
}

export async function signOut() {
  const supabase =
    await createClient();

  await supabase.auth.signOut();

  return redirect("/auth/login");
}