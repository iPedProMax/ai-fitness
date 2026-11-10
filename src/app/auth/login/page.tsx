import Link from "next/link";
import { AuthShowcaseLayout } from "@/components/auth-showcase-layout";
import { AuthPasswordField } from "@/components/auth-password-field";
import { CheckEmailModal } from "@/components/check-email-modal";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  signInWithEmail,
  signInWithGoogle,
} from "../actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <AuthShowcaseLayout mode="login">
      {params.message === "Account created. Check your email if confirmation is required, then sign in." && <CheckEmailModal />}
      <h1 className="k-auth-form-heading">Welcome back.</h1>
      <p className="k-auth-form-subtitle">Ready for your next small win? Sign in to pick up where you left off.</p>

      {params.error && <div role="alert" className="k-auth-alert k-auth-alert-error">{params.error}</div>}
      {params.message && <div role="status" className="k-auth-alert k-auth-alert-info">{params.message}</div>}

      <form action={signInWithEmail} className="k-auth-form">
        <div className="k-auth-field">
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="k-auth-input" />
        </div>
        <AuthPasswordField id="password" label="Password" autoComplete="current-password" placeholder="Your password" />
        <button type="submit" className="k-auth-submit">Sign in to Khalories</button>
      </form>

      <div className="k-auth-divider">or continue with</div>
      <form action={signInWithGoogle}>
        <button type="submit" className="k-auth-google"><span className="k-auth-google-mark" aria-hidden="true">G</span>Continue with Google</button>
      </form>
      <p className="k-auth-switch">New to Khalories? <Link href="/auth/sign-up">Create an account</Link></p>
    </AuthShowcaseLayout>
  );
}
