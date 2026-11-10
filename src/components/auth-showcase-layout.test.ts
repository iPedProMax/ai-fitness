import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const login = readFileSync("src/app/auth/login/page.tsx", "utf8");
const signup = readFileSync("src/app/auth/sign-up/page.tsx", "utf8");
const layout = readFileSync("src/components/auth-showcase-layout.tsx", "utf8");
const css = readFileSync("src/app/auth/auth-showcase.css", "utf8");
const password = readFileSync("src/components/auth-password-field.tsx", "utf8");
const emailModal = readFileSync("src/components/check-email-modal.tsx", "utf8");

describe("Khalories authentication showcase", () => {
  it("keeps existing server actions, redirects, and confirmation modal", () => {
    expect(login).toContain("createClient()");
    expect(login).toContain('redirect("/")');
    expect(login).toContain("action={signInWithEmail}");
    expect(login).toContain("action={signInWithGoogle}");
    expect(login).toContain("<CheckEmailModal />");
    expect(signup).toContain("createClient()");
    expect(signup).toContain('redirect("/")');
    expect(signup).toContain("action={signUpWithEmail}");
    expect(signup).toContain("action={signInWithGoogle}");
    expect(emailModal).toContain("Khalories AI account");
  });

  it("uses the same brand across both forms, not fake ads", () => {
    expect(login).toContain('<AuthShowcaseLayout mode="login">');
    expect(signup).toContain('<AuthShowcaseLayout mode="signup">');
    expect(layout).toContain("Big cravings.");
    expect(layout).toContain("Smart tracking.");
    expect(layout).toContain("Coach FONZ");
    expect(layout).toContain("/khalories-brand-original-leaf.png");
    expect(layout).not.toContain("12,000+");
  });

  it("keeps mobile layout, usable form fields and reduced-motion behavior", () => {
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("@media (max-width: 370px)");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(password).toContain('type={visible ? "text" : "password"}');
    expect(password).toContain('name={id}');
    expect(password).toContain("minLength={minLength}");
    expect(signup).toContain('id="confirmPassword"');
    expect(signup).toContain("minLength={8}");
  });
});
