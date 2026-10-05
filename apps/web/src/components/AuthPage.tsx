"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAppSupabaseClient } from "@/lib/supabaseClient";

function safeNext() {
  const value = new URLSearchParams(window.location.search).get("next");
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function authErrorMessage(error: { message?: string; code?: string; status?: number }) {
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (text.includes("email_not_confirmed")) return "Please confirm your email using the link we sent, then sign in.";
  if (text.includes("email_address_not_authorized") || text.includes("email address not authorized") || text.includes("smtp")) {
    return "Supabase did not send the confirmation email. Configure a custom SMTP provider in Supabase Authentication settings, then try again.";
  }
  if (text.includes("redirect_to_not_allowed") || text.includes("redirect url") || text.includes("redirect_to")) {
    return `Supabase blocked the confirmation link. Add ${window.location.origin}/** to Authentication → URL Configuration → Redirect URLs, then try again.`;
  }
  if (error.status === 429 || text.includes("rate limit") || text.includes("too many requests")) return "Too many attempts were made. Wait a few minutes, then try again.";
  if (text.includes("user already registered") || text.includes("already been registered")) return "An account already exists for this email. Sign in instead, or reset your password.";
  if (text.includes("invalid login credentials")) return "Email or password is incorrect. Check both and try again, or reset your password.";
  if (text.includes("password should be at least") || text.includes("password must be")) return "Choose a password with at least 8 characters.";
  return error.message || "Could not complete that request. Please try again.";
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Audience = "studio" | "customer";
type Mode = "login" | "signup" | "reset";

export default function AuthPage({ mode, audience = "studio" }: { mode: Mode; audience?: Audience }) {
  const router = useRouter();
  const [client] = useState(() => url && anon ? createAppSupabaseClient(url, anon) : null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [activeAudience, setActiveAudience] = useState<Audience | null>(null);
  const routing = useRef(false);

  const destination = audience === "customer" ? "/customer" : "/dashboard";
  const loginHref = audience === "customer" ? "/customer/login" : "/login";
  const signupHref = audience === "customer" ? "/customer/signup" : "/signup";
  const otherRoleHref = audience === "customer" ? (mode === "signup" ? "/signup" : "/login") : (mode === "signup" ? "/customer/signup" : "/customer/login");
  const otherRoleLabel = audience === "customer" ? "Photographer" : "Customer";

  useEffect(() => {
    if (!client) return;
    let active = true;
    const goToAccount = (session: import("@supabase/supabase-js").Session | null) => {
      if (!active || !session || mode === "reset" || routing.current) return;
      const userType = String(session.user.user_metadata?.user_type || "").toLowerCase();
      const signedInAudience = userType === "customer" ? "customer" : userType === "photographer" || userType === "studio" ? "studio" : audience;
      setActiveAudience(signedInAudience);
      const account = signedInAudience === "customer" ? "/customer" : "/dashboard";
      routing.current = true;
      router.replace((signedInAudience === audience ? safeNext() : null) || account);
    };
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        void client.auth.signOut();
        return;
      }
      goToAccount(data.session);
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        return;
      }
      if (event === "SIGNED_OUT") setActiveAudience(null);
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") goToAccount(session);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [audience, client, mode, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        if (password !== confirm) throw new Error("The passwords do not match.");
        const next = safeNext();
        const callback = new URL(loginHref, window.location.origin);
        if (next) callback.searchParams.set("next", next);
        const { data, error: signupError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: callback.toString(),
            data: { user_type: audience === "customer" ? "customer" : "photographer", full_name: fullName.trim() },
          },
        });
        if (signupError) throw signupError;
        if (data.session) {
          const userType = String(data.session.user.user_metadata?.user_type || "").toLowerCase();
          const signedInAudience = userType === "customer" ? "customer" : "studio";
          const account = signedInAudience === "customer" ? "/customer" : "/dashboard";
          router.replace(signedInAudience === audience ? (next || account) : account);
          return;
        }
        setMessage(audience === "customer"
          ? "Account created. Check your inbox (and spam folder) for the confirmation link. After confirming, sign in here to request appointments and view your bookings and private galleries."
          : "Account created. Check your inbox (and spam folder) for the confirmation link. After confirming, sign in, create your studio workspace, and submit it for one Super Admin review.");
      } else if (mode === "login") {
        const { error: loginError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) throw loginError;
      } else if (recovery) {
        if (password.length < 8) throw new Error("Choose a password with at least 8 characters.");
        if (password !== confirm) throw new Error("The passwords do not match.");
        const { error: updateError } = await client.auth.updateUser({ password });
        if (updateError) throw updateError;
        setMessage("Your password has been changed. You can sign in now.");
        setPassword("");
        setConfirm("");
        setRecovery(false);
        await client.auth.signOut();
      } else {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (resetError) throw resetError;
        setMessage("If the address belongs to an account, a password reset link will arrive by email.");
      }
    } catch (caught) {
      setError(authErrorMessage(caught instanceof Error ? caught as Error & { code?: string; status?: number } : {}));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup"
    ? "Sign up"
    : mode === "reset" ? recovery ? "Choose a new password" : "Reset your password"
      : "Sign in";

  return (
    <main className="auth-shell">
      <header className="auth-topbar"><a className="auth-brand" href="/">The Photo Gallery <span>{audience === "customer" ? "Customer account" : "Photographer workspace"}</span></a>{mode === "signup" && <a className="auth-top-signin" href={loginHref}>Sign in</a>}</header>
      <section className="panel auth-card">
        <h1>{title}</h1>
        <p>{mode === "signup"
          ? audience === "customer"
            ? "Create an account to request appointments and keep quotations, payments and private galleries together."
            : "Create your photographer account, then set up your studio. Your studio will be reviewed once before access is enabled."
          : mode === "reset" ? "We’ll send a secure reset link to your account email."
            : audience === "customer" ? "View appointment requests, quotations, payments and private galleries shared with you."
              : "Manage your studio, projects, client galleries, invoices and media."}</p>
        {activeAudience && activeAudience !== audience && <div className="auth-alert" role="status">You are currently signed in as a {activeAudience === "customer" ? "customer" : "photographer"}. Sign in here with your {audience === "customer" ? "customer" : "photographer"} account to switch accounts.</div>}
        {!url || !anon ? <div className="auth-alert" role="alert">Authentication is not configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>apps/web/.env.local</code>.</div> : (
          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && <label>Your name<input required minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} /></label>}
            {(mode !== "reset" || !recovery) && <label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>}
            {(mode !== "reset" || recovery) && <label>{recovery ? "New password" : "Password"}<input type="password" minLength={8} required autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} /></label>}{mode === "signup" && <label>Confirm password<input type="password" minLength={8} required autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label>}
            {recovery && <label>Confirm new password<input type="password" minLength={8} required autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label>}
            {error && <div className="auth-alert auth-error" role="alert">{error}</div>}
            {message && <div className="auth-alert auth-success" role="status">{message}</div>}
            <button className="primary" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Sign up" : mode === "reset" ? recovery ? "Update password" : "Send reset link" : "Sign in"}</button>
          </form>
        )}
        {mode === "login" && <a className="auth-sub-link" href="/reset-password">Forgot your password?</a>}
        {mode !== "signup" && <div className="auth-footer">{mode === "login" ? <>Don’t have an account? <a href={signupHref}>Sign up</a></> : <>Remember your password? <a href={loginHref}>Sign in</a></>}</div>}
        {mode !== "reset" && <nav className="auth-secondary-nav" aria-label="More account options"><a href={otherRoleHref}>{otherRoleLabel} account</a>{audience === "customer" && <a href="/photographers">Browse photographers</a>}</nav>}
        {mode === "reset" && <a className="auth-home" href={audience === "customer" ? "/photographers" : "/"}>← {audience === "customer" ? "Browse photographers" : "Back to home"}</a>}
      </section>
    </main>
  );
}


