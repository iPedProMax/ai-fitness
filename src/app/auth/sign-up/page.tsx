import Link from "next/link";
import { AuthShowcaseLayout } from "@/components/auth-showcase-layout";
import { AuthPasswordField } from "@/components/auth-password-field";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  signInWithGoogle,
  signUpWithEmail,
} from "../actions";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignUpPage({
  searchParams,
}: SignUpPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <AuthShowcaseLayout mode="signup">
      <h1 className="k-auth-form-heading">Start your journey.</h1>
      <p className="k-auth-form-subtitle">One simple account for meals, nutrition, progress, and Coach FONZ.</p>

      {params.error && <div role="alert" className="k-auth-alert k-auth-alert-error">{params.error}</div>}

      <form action={signUpWithEmail} className="k-auth-form">
        <div className="k-auth-field">
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="k-auth-input" />
        </div>
        <AuthPasswordField id="password" label="Password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" />
        <AuthPasswordField id="confirmPassword" label="Confirm password" autoComplete="new-password" minLength={8} placeholder="Repeat your password" />
        <button type="submit" className="k-auth-submit">Create my account</button>
      </form>

      <div className="k-auth-divider">or continue with</div>
      <form action={signInWithGoogle}>
        <button type="submit" className="k-auth-google"><span className="k-auth-google-mark" aria-hidden="true">G</span>Continue with Google</button>
      </form>
      <p className="k-auth-switch">Already tracking with us? <Link href="/auth/login">Sign in</Link></p>
    </AuthShowcaseLayout>
  );
}
