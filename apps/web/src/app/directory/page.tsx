"use client";
import { createAppSupabaseClient } from "@/lib/supabaseClient";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";
const supabase=process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?createAppSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY):null;
const categories = ["All photographers", "Wedding", "Portraits", "Family", "Events", "Commercial"];

type Studio = {
  organization_id: string;
  public_name: string;
  city: string;
  description: string;
  specialties: string[];
  photo_url?: string | null;
};

type RequestForm = {
  name: string;
  email: string;
  phone: string;
  eventType: string;
  preferredDate: string;
  message: string;
};

const blankForm: RequestForm = { name: "", email: "", phone: "", eventType: "", preferredDate: "", message: "" };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

export default function DirectoryPage() {
  const [session,setSession]=useState<Session|null>(null);
  const [authReady,setAuthReady]=useState(false);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [selected, setSelected] = useState<Studio | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<RequestForm>(blankForm);
  useEffect(()=>{let active=true;if(!supabase){setAuthReady(true);return;}supabase.auth.getSession().then(({data})=>{if(!active)return;setSession(data.session);setAuthReady(true);}).catch(()=>{if(active)setAuthReady(true);});const sub=supabase.auth.onAuthStateChange((_event,current)=>{setSession(current);setAuthReady(true);});return()=>{active=false;sub.data.subscription.unsubscribe();};},[]);

  async function loadStudios(requestedId?: string) {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(api + "/public/studios");
      if (!response.ok) throw new Error();
      const data = await response.json();
      const loadedStudios: Studio[] = Array.isArray(data.studios) ? data.studios : [];
      setStudios(loadedStudios);
      const requestedStudio = requestedId && loadedStudios.find((studio) => studio.organization_id === requestedId);
      if (requestedStudio) setSelected(requestedStudio);
    } catch {
      setLoadError("The photographer directory is unavailable right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get("studio") || undefined;
    void loadStudios(requestedId);
  }, []);

  const visibleStudios = useMemo(() => {
    const query = search.trim().toLowerCase();
    return studios.filter((studio) => {
      const searchable = [studio.public_name, studio.city, studio.description, ...(studio.specialties || [])].join(" ").toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesCategory = category === categories[0] || (studio.specialties || []).some((item) => item.toLowerCase().includes(category.toLowerCase().replace(/s$/, "")));
      return matchesSearch && matchesCategory;
    });
  }, [studios, search, category]);

  function openRequest(studio: Studio) {
    setSelected(studio);
    setSent(false);
    setFormError("");
    setForm(blankForm);
    window.history.replaceState(null, "", "/photographers?studio=" + encodeURIComponent(studio.organization_id));
  }

  function closeRequest() {
    setSelected(null);
    setSent(false);
    setFormError("");
    window.history.replaceState(null, "", "/photographers");
  }

  async function sendRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      eventType: form.eventType.trim(),
      ...(form.preferredDate ? { preferredDate: form.preferredDate } : {}),
      message: form.message.trim(),
    };
    try {
      const response = await fetch(api + "/customer/studios/" + selected.organization_id + "/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token||""}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your request could not be sent. Please try again.");
      setSent(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Your request could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="directory-page">
      <header className="directory-nav">
        <a href="/" className="directory-brand" aria-label="The Photo Gallery home">
          <span className="directory-brand-mark">P</span>
          <span>The Photo Gallery</span>
        </a>
        <nav aria-label="Main navigation"><a href="/work">Gallery</a><a className="active" href="/photographers">Photographers</a></nav>
        <div className="directory-auth-links"><a className="directory-signin" href="/customer/login">Sign in</a><a className="directory-signin" href="/customer/signup">Sign up</a></div>
      </header>

      <section className="directory-listing" id="studios">
        <div className="directory-listing-heading">
          <div><h2>Photographers to meet</h2></div>
          <span className="directory-result-count">{loading ? "…" : visibleStudios.length + (visibleStudios.length === 1 ? " studio" : " studios")}</span>
        </div>
        <div className="directory-tools">
          <label className="directory-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, location or specialty" aria-label="Search photographers" /><kbd>SEARCH</kbd></label>
          <div className="directory-categories" aria-label="Filter photographers by specialty">
            {categories.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
        </div>

        {loadError && <div className="directory-state directory-error"><span>!</span><div><strong>We couldn’t reach the directory.</strong><p>{loadError}</p></div><button onClick={() => void loadStudios()}>Try again</button></div>}
        {!loadError && loading && <div className="directory-loading" aria-live="polite"><span /><span /><span />Loading approved studios…</div>}
        {!loadError && !loading && visibleStudios.length > 0 && <div className="directory-cards">
          {visibleStudios.map((studio, index) => <article className="directory-card" key={studio.organization_id}>
            <div className={"directory-card-art art-" + (index % 3) + (studio.photo_url ? " has-photo" : "")}>
              {studio.photo_url ? <img className="directory-card-photo" src={studio.photo_url} alt={`${studio.public_name} portfolio`} onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement?.classList.remove("has-photo"); }} /> : <span className="directory-monogram">{initials(studio.public_name)}</span>}
            </div>
            <div className="directory-card-info">
              <div className="directory-card-meta"><span>{studio.city || "Photography studio"}</span></div>
              <h3>{studio.public_name}</h3>{studio.description && <p>{studio.description}</p>}
              <div className="directory-specialties">{(studio.specialties || []).slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
              <button className="directory-card-action" onClick={() => openRequest(studio)}>Request an appointment <span>↗</span></button>
            </div>
          </article>)}
        </div>}
        {!loadError && !loading && visibleStudios.length === 0 && studios.length > 0 && <div className="directory-state"><span>⌕</span><div><strong>No studios match those filters.</strong><p>Try another search or choose a different specialty.</p></div><button onClick={() => { setSearch(""); setCategory(categories[0]); }}>Clear filters</button></div>}
        {!loadError && !loading && studios.length === 0 && <div className="directory-empty">
          <h3>No photographers yet.</h3>
          <p>Once a photography studio has been approved and published, you’ll be able to explore its profile and request an appointment here.</p>
        </div>}
      </section>

      <footer className="directory-footer"><a href="/" className="directory-brand"><span className="directory-brand-mark">P</span><span>The Photo Gallery</span></a><a href="/login">Studio sign in →</a></footer>

      {selected && <div className="directory-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRequest(); }}>
        <section className="directory-modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
          <button className="directory-modal-close" onClick={closeRequest} aria-label="Close appointment request">×</button>
          {!sent ? <>
            <div className="directory-modal-aside"><p className="directory-eyebrow">APPOINTMENT REQUEST</p>{selected.photo_url ? <img className="directory-modal-photo" src={selected.photo_url} alt={`${selected.public_name} portfolio`} /> : <span className="modal-monogram">{initials(selected.public_name)}</span>}<h2>{selected.public_name}</h2><p>{selected.city || "Photography studio"}</p><div className="modal-specialties">{(selected.specialties || []).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="modal-note"><b>What happens next?</b><p>The studio receives your request and will follow up using the contact details you provide. Your appointment and project updates will be saved to your customer account.</p></div></div>
            <div className="directory-modal-form"><p className="directory-eyebrow">TELL US ABOUT YOUR PLANS</p><h2 id="request-title">Let’s make an introduction.</h2><p className="directory-form-intro">A few details will help the studio get back to you with the right information.</p>
              {!authReady ? <div className="directory-auth-prompt" role="status"><p>Checking your account…</p></div> : (!session || session.user.user_metadata?.user_type === "photographer" || session.user.user_metadata?.user_type === "studio") ? <div className="directory-auth-prompt"><p>{session ? "You are signed in to a photographer account. Appointment requests need a customer account." : "Create or sign in to your customer account before requesting an appointment. Your quotation, payment status, and private gallery will be kept there."}</p><div className="directory-auth-actions">{session ? <button type="button" className="primary" onClick={async () => { await supabase?.auth.signOut(); window.location.assign(`/customer/signup?next=${encodeURIComponent(`/photographers?studio=${selected.organization_id}`)}`); }}>Continue as customer</button> : <><a className="primary" href={`/customer/signup?next=${encodeURIComponent(`/photographers?studio=${selected.organization_id}`)}`}>Sign up</a><a className="directory-auth-secondary" href={`/customer/login?next=${encodeURIComponent(`/photographers?studio=${selected.organization_id}`)}`}>Sign in</a></>}</div></div>:<form onSubmit={sendRequest}>
                <label>Your name<input required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Name" /></label>
                <div className="directory-form-row"><label>Account email<input type="email" value={session.user.email||""} readOnly /></label><label>Phone <span>(optional)</span><input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone number" /></label></div>
                <div className="directory-form-row"><label>What are you planning?<select value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value })}><option value="">Choose an occasion</option><option>Wedding</option><option>Portrait session</option><option>Family photographs</option><option>Birthday or event</option><option>Commercial project</option><option>Something else</option></select></label><label>Preferred date <span>(optional)</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.preferredDate} onChange={(event) => setForm({ ...form, preferredDate: event.target.value })} /></label></div>
                <label>A note for the studio <span>(optional)</span><textarea rows={3} maxLength={2000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Share a little about what you have in mind." /></label>
                {formError && <p className="directory-form-error" role="alert">{formError}</p>}
                <button className="directory-submit" disabled={busy}>{busy ? "Sending your request…" : "Send appointment request"} <span>→</span></button><small className="directory-privacy">Your details are sent to this studio so they can respond to your enquiry.</small>
              </form>}
            </div>
          </> : <div className="directory-success"><span className="success-check">✓</span><p className="directory-eyebrow">REQUEST SENT</p><h2>Thanks, {form.name.split(" ")[0]}.</h2><p>Your appointment request has been sent to <strong>{selected.public_name}</strong>. You can track this appointment and future updates from your customer account.</p><a className="directory-submit" href="/customer">Open my customer account →</a><button className="directory-submit" onClick={closeRequest}>Back to photographers <span>→</span></button></div>}
        </section>
      </div>}
    </main>
  );
}

