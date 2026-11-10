import Image from "next/image";
import type { ReactNode } from "react";

type AuthShowcaseLayoutProps = {
  mode: "login" | "signup";
  children: ReactNode;
};

type FeatureIconProps = { kind: "camera" | "chart" | "coach" };

function FeatureIcon({ kind }: FeatureIconProps) {
  if (kind === "camera") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h4l1.5-2h5L16 7h4a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.25"/></svg>;
  }
  if (kind === "chart") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19V5M4 19h16M8 15v-4M13 15V7M18 15v-6"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5 14 9.8l7.5 2.2-7.5 2.2-2 7.3-2.2-7.3-7.3-2.2 7.3-2.2L12 2.5Z"/></svg>;
}

const features: { kind: FeatureIconProps["kind"]; name: string; detail: string }[] = [
  { kind: "camera", name: "Scan meals", detail: "Photo and barcode tools" },
  { kind: "chart", name: "See your progress", detail: "Nutrition and daily reports" },
  { kind: "coach", name: "Meet Coach FONZ", detail: "Helpful wellness guidance" },
];

/** Reusable presentation only. Auth actions, redirects, and inputs remain in each server page. */
export function AuthShowcaseLayout({ mode, children }: AuthShowcaseLayoutProps) {
  return <main className="k-auth-page">
    <div className="k-auth-shell">
      <section className="k-auth-story" aria-label="Discover Khalories AI">
        <span className="k-auth-orb k-auth-orb-one" aria-hidden="true" />
        <span className="k-auth-orb k-auth-orb-two" aria-hidden="true" />
        <div className="k-auth-story-content">
          <div className="k-auth-brand">
            <div className="k-auth-brand-lockup">
              <span className="k-auth-brand-symbol"><Image src="/khalories-brand-original-leaf.png" alt="" width={42} height={42} priority /></span>
              <span className="k-auth-brand-name">Khalories <strong>AI</strong></span>
            </div>
            <span className="k-auth-brand-tag">Your wellness, simplified</span>
          </div>

          <div className="k-auth-story-lead">
            <span className="k-auth-eyebrow"><span aria-hidden="true" className="k-auth-eyebrow-dot" /> A smarter way to track</span>
            <h2>Big cravings.<br /><span>Smart tracking.</span></h2>
            <p>One place for your meals, nutrition, and daily progress. Build a routine that works for you.</p>
          </div>

          <div className="k-auth-mini-demo" aria-label="Illustrative meal logging feature preview">
            <div className="k-auth-demo-top"><span className="k-auth-demo-kicker">KHALORIES IN ACTION</span><span className="k-auth-demo-spark" aria-hidden="true">+</span></div>
            <div className="k-auth-demo-main">
              <span className="k-auth-demo-plate" aria-hidden="true"><span className="k-auth-demo-leaf" /></span>
              <span className="k-auth-demo-copy"><strong>Your next meal, made simple</strong><span>Log it. Review nutrition. Keep going.</span></span>
              <span className="k-auth-demo-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5L20 7" /></svg></span>
            </div>
            <div className="k-auth-demo-steps" aria-hidden="true"><span /><span /><span /></div>
          </div>

          <div className="k-auth-feature-list">
            {features.map(feature => <div className="k-auth-feature" key={feature.kind}>
              <span className="k-auth-feature-icon"><FeatureIcon kind={feature.kind} /></span>
              <strong>{feature.name}</strong>
              <small>{feature.detail}</small>
            </div>)}
          </div>
          <div className="k-auth-mobile-chips" aria-label="Khalories features">
            <span>Photo scan</span><span>Nutrition logs</span><span>Coach FONZ</span>
          </div>
        </div>
      </section>

      <section className="k-auth-right" aria-label={mode === "login" ? "Sign in to Khalories AI" : "Create a Khalories AI account"}>
        <div className="k-auth-form-wrap">
          <p className="k-auth-form-kicker">{mode === "login" ? "GOOD TO SEE YOU AGAIN" : "WELCOME TO KHALORIES AI"}</p>
          {children}
          <p className="k-auth-supporting-note">Small steps. Real progress. Your pace.</p>
        </div>
      </section>
    </div>
  </main>;
}
