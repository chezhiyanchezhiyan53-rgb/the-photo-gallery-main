"use client";
import { createAppSupabaseClient } from "@/lib/supabaseClient";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

type Role = "customer" | "photographer";
type RoleState = Role | null | "loading";
const preferenceKey = "the-photo-gallery-audience";
const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const authAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authClient = authUrl && authAnon ? createAppSupabaseClient(authUrl, authAnon) : null;

function readRolePreference(): Role | null {
  try {
    const saved = window.localStorage.getItem(preferenceKey);
    return saved === "customer" || saved === "photographer" ? saved : null;
  } catch {
    return null;
  }
}

function saveRolePreference(role: Role | null) {
  try {
    if (role) window.localStorage.setItem(preferenceKey, role);
    else window.localStorage.removeItem(preferenceKey);
  } catch {
    // The role chooser still works when browser storage is blocked.
  }
}

export default function RoleHome() {
  const [role, setRole] = useState<RoleState>("loading");
  const routing = useRef(false);

  useEffect(() => {
    let active = true;
    const showPublicHome = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("chooseRole") === "1") { setRole(null); return; }
      setRole(readRolePreference());
    };
    const routeSession = (session: Session | null) => {
      if (!active || !session || routing.current) return;
      if (new URLSearchParams(window.location.search).get("chooseRole") === "1") {
        setRole(null);
        return;
      }
      const userType = String(session.user.user_metadata?.user_type || "").toLowerCase();
      const destination = userType === "customer" ? "/customer"
        : userType === "photographer" || userType === "studio" ? "/dashboard"
          : (() => { const saved = readRolePreference(); return saved === "customer" ? "/customer" : saved === "photographer" ? "/dashboard" : null; })();
      if (!destination) { showPublicHome(); return; }
      routing.current = true;
      window.location.replace(destination);
    };

    if (!authClient) { showPublicHome(); return () => { active = false; }; }
    authClient.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) { await authClient.auth.signOut(); if (active) showPublicHome(); return; }
      if (data.session) routeSession(data.session); else showPublicHome();
    }).catch(() => { if (active) showPublicHome(); });
    const { data } = authClient.auth.onAuthStateChange((event, session) => {
      if (session) routeSession(session);
      else if (event === "SIGNED_OUT") { routing.current = false; showPublicHome(); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  function chooseRole(next: Role) {
    saveRolePreference(next);
    window.history.replaceState(null, "", "/");
    setRole(next);
  }

  function switchRole() {
    saveRolePreference(null);
    setRole(null);
  }

  if (role === "loading") return <main className="role-home-loading" aria-busy="true" />;
  if (role === null) return <RoleChooser onChoose={chooseRole} />;
  return role === "customer" ? <CustomerHome onSwitchRole={switchRole} /> : <PhotographerHome onSwitchRole={switchRole} />;
}

function RoleChooser({ onChoose }: { onChoose: (role: Role) => void }) {
  return <main className="role-choice-shell">
    <header className="role-choice-brand"><a className="public-brand" href="/">The Photo Gallery</a></header>
    <section className="role-choice">
      <h1>Are you a customer or photographer?</h1>
      <div className="role-choice-list">
        <button type="button" className="role-choice-option" onClick={() => onChoose("customer")}><img className="role-choice-image" src="/images/role-customer.jpeg" alt=""/><span className="role-choice-shade" aria-hidden="true"/><span className="role-choice-number">01</span><strong>Customer</strong><b aria-hidden="true">↗</b></button>
        <button type="button" className="role-choice-option" onClick={() => onChoose("photographer")}><img className="role-choice-image" src="/images/role-photographer.jpeg" alt=""/><span className="role-choice-shade" aria-hidden="true"/><span className="role-choice-number">02</span><strong>Photographer</strong><b aria-hidden="true">↗</b></button>
      </div>
    </section>
  </main>;
}

function CustomerHome({ onSwitchRole }: { onSwitchRole: () => void }) {
  return <main className="public-site role-home customer-home">
    <header className="public-nav role-home-nav">
      <a className="public-brand" href="/">The Photo Gallery</a>
      <nav className="customer-landing-nav" aria-label="Account">
        <a className="customer-nav-signup" href="/customer/signup">Sign up</a>
      </nav>
    </header>
    <section className="customer-landing-hero">
      <div className="customer-landing-copy">

        <h1>Your story, beautifully captured.</h1>
        <p>Find a photographer, plan your booking and receive your images in one place.</p>
        <div className="hero-actions"><a className="primary" href="/photographers">Find a photographer</a><a className="gallery-text-link" href="/work">Explore the gallery</a></div>
      </div>
      <figure className="customer-hero-visual">
        <img src="/images/customer-photographers.jpeg" alt="Two photographers working together at sunset" />
      </figure>
    </section>

    <section className="customer-flow" id="how-it-works">
      <div className="customer-flow-heading"><h2>A considered journey, from enquiry to final image.</h2></div>
      <div className="customer-flow-list">
        <article><span>01</span><div><h3>Choose the right studio</h3><p>Browse photographers, share your event details and request a date.</p></div><a href="/photographers">Browse studios →</a></article>
        <article><span>02</span><div><h3>Agree on the details</h3><p>Review the quotation and follow your booking and payment updates.</p></div><a href="/customer/signup">Continue →</a></article>
        <article><span>03</span><div><h3>Enjoy the finished work</h3><p>Preview your private gallery. Download originals once payment is confirmed.</p></div><a href="/customer/signup">Open your account →</a></article>
      </div>
    </section>
    <footer className="public-footer role-home-footer"><a className="public-brand" href="/">The Photo Gallery<span>YOUR PHOTOGRAPHY, IN ONE PLACE</span></a><div><a href="/photographers">Find a photographer</a><button type="button" className="role-switch-link" onClick={onSwitchRole}>Photographer? Switch view</button></div><small>© {new Date().getFullYear()} The Photo Gallery</small></footer>
  </main>;
}

function PhotographerHome({ onSwitchRole }: { onSwitchRole: () => void }) {
  return <main className="public-site role-home photographer-home">
    <header className="public-nav role-home-nav">
      <a className="public-brand" href="/">The Photo Gallery<span>STUDIO PLATFORM</span></a>
      <div className="public-account-links"><a className="nav-login" href="/signup">Sign up</a></div>
    </header>
    <section className="public-hero"><div><p className="eyebrow">STUDIO MANAGEMENT, REFINED</p><h1>From first enquiry to final delivery.</h1><p>Manage bookings, payments and private photo delivery from one studio workspace.</p><div className="hero-actions"><a className="primary" href="/signup">Create your studio account</a></div></div><div className="hero-preview" aria-label="Preview of a studio project dashboard"><div className="preview-window"><div className="preview-top"><span><i className="preview-brand-mark">P</i><span><b>STUDIO WORKSPACE</b><small>PROJECT OVERVIEW</small></span></span><i className="preview-menu" aria-hidden="true">•••</i></div><div className="preview-stats"><span><b>ACTIVE PROJECTS</b><strong>Bookings, all in view</strong></span><span><b>CLIENT GALLERIES</b><strong>Private by default</strong></span></div><div className="preview-project"><div className="preview-photo"><img src="/images/wedding-gallery-preview.jpeg" alt="A bride holding flowers as the sun sets" /><span>FEATURED PROJECT</span><b>A day to remember</b></div><div className="preview-project-meta"><span><small>PROJECT</small><b>Wedding collection</b></span><span className="preview-status"><i />In progress</span></div></div><div className="preview-line"><span>Gallery access</span><b>Originals protected</b></div></div></div></section>
    <section className="public-intro"><h2>A clearer view of every project.</h2></section>
    <section className="public-feature-grid"><a href="/features"><span>01</span><h3>Projects that stay organised</h3><p>Keep client details, bookings, quotations and invoices together.</p><b>Explore features →</b></a><a href="/gallery"><span>02</span><h3>Private gallery delivery</h3><p>Share previews and release original downloads when ready.</p><b>See gallery delivery →</b></a><a href="/payments"><span>03</span><h3>Payments you can track</h3><p>Follow balances and verified payment updates in one place.</p><b>See payment flow →</b></a></section>
    <footer className="public-footer role-home-footer"><a className="public-brand" href="/">The Photo Gallery<span>STUDIO PLATFORM</span></a><div><a href="/features">Features</a><a href="/pricing">Pricing</a><button type="button" className="role-switch-link" onClick={onSwitchRole}>Customer? Switch view</button></div><small>© {new Date().getFullYear()} The Photo Gallery</small></footer>
  </main>;
}
