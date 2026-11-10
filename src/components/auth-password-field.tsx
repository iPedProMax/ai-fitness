"use client";

import { useState } from "react";

type AuthPasswordFieldProps = {
  id: "password" | "confirmPassword";
  label: string;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
};

export function AuthPasswordField({ id, label, placeholder, autoComplete, minLength }: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return <div className="k-auth-field">
    <label htmlFor={id}>{label}</label>
    <div className="k-auth-password-shell">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        placeholder={placeholder}
        className="k-auth-input k-auth-password-input"
      />
      <button type="button" className="k-auth-password-toggle" onClick={() => setVisible(current => !current)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible}>
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  </div>;
}
