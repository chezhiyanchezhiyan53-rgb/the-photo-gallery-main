"use client";
import { createAppSupabaseClient } from "@/lib/supabaseClient";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createAppSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

type Studio = { id: string; name: string; status: string };
type Asset = { id: string; filename: string; mimeType: string; projectName: string; previewUrl: string; hasPreview: boolean; alreadyPublished: boolean };
type PortfolioItem = { id: string; media_id: string; caption: string; previewUrl?: string; media?: { filename: string; mime_type: string } };

export default function PortfolioDesk() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studios, setStudios] = useState<Studio[]>([]);
  const [org, setOrg] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [caption, setCaption] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch(api + "/studios", { headers: { Authorization: "Bearer " + session.access_token } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load studio access.");
        if (cancelled) return;
        const available: Studio[] = data.studios || [];
        setStudios(available);
        const saved = localStorage.getItem("activeOrganizationId");
        const preferred = available.find((studio) => studio.id === saved);
        setOrg(preferred?.id || (available.length === 1 ? available[0].id : ""));
      })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load studio access."); });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!session || !org) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetch(api + "/studio/portfolio-assets", { headers: { Authorization: "Bearer " + session.access_token, "x-organization-id": org } }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load available studio images.");
        return data.assets as Asset[];
      }),
      fetch(api + "/studio/portfolio", { headers: { Authorization: "Bearer " + session.access_token, "x-organization-id": org } }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your portfolio.");
        return data.items as PortfolioItem[];
      }),
    ])
      .then(([available, published]) => {
        if (cancelled) return;
        setAssets(available);
        setItems(published);
      })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load your portfolio."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, org]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !org) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(api + "/studio/portfolio", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token, "x-organization-id": org, "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: selectedId, caption: caption.trim(), consentConfirmed: confirmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not publish this image.");
      const publishedAsset = assets.find((asset) => asset.id === selectedId);
      setItems((current) => [{ ...data.item, previewUrl: publishedAsset?.previewUrl, media: { filename: publishedAsset?.filename || "", mime_type: publishedAsset?.mimeType || "" } }, ...current]);
      setAssets((current) => current.map((asset) => asset.id === selectedId ? { ...asset, alreadyPublished: true } : asset));
      setSelectedId("");
      setCaption("");
      setConfirmed(false);
      setMessage("The image has been added to your public studio portfolio.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not publish this image.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: PortfolioItem) {
    if (!session || !org) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(api + "/studio/portfolio/" + item.id, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + session.access_token, "x-organization-id": org },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove this image.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setAssets((current) => current.map((asset) => asset.id === item.media_id ? { ...asset, alreadyPublished: false } : asset));
      setMessage("The image has been removed from the public portfolio.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove this image.");
    } finally {
      setBusy(false);
    }
  }

  if (!supabase) return <section className="panel portfolio-gate"><h2>Connect your studio account</h2><p>Set up Supabase before managing your studio portfolio.</p></section>;
  if (!session) return <section className="panel connect-panel"><h2>Sign in to manage your portfolio</h2><form className="connect-form" onSubmit={signIn}><input type="email" required placeholder="Studio email" value={email} onChange={(event) => setEmail(event.target.value)} /><input type="password" required placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="primary">Sign in</button></form>{error && <p className="connect-error">{error}</p>}</section>;

  const studio = studios.find((entry) => entry.id === org);

  return <section className="portfolio-desk">
    <div className="panel portfolio-intro">
      <div><p className="eyebrow">PUBLIC PHOTOGRAPHER GALLERY</p><h2>Choose the work people can see.</h2><p>Publish photographs cleared for public display. A published photo can also appear in a private customer gallery.</p></div>
      <label>Studio<select value={org} onChange={(event) => setOrg(event.target.value)}><option value="">Choose studio</option>{studios.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.status.replaceAll("_", " ")}</option>)}</select></label>
    </div>

    {studio?.status === "PENDING_APPROVAL" && <div className="panel portfolio-notice">Your public profile and portfolio will appear after the Super Admin approves the studio.</div>}
    {error && <div className="panel portfolio-error" role="alert">{error}</div>}
    {message && <div className="panel portfolio-message" role="status">{message}</div>}

    {org && <div className="portfolio-columns">
      <section className="panel portfolio-picker">
        <div className="portfolio-section-heading"><div><h3>Add a photograph</h3><p>Ready studio images are listed here, including photos already in a customer gallery.</p></div><span>{assets.filter((asset) => !asset.alreadyPublished && asset.hasPreview).length} available</span></div>
        {loading ? <p className="portfolio-empty">Loading studio images…</p> : assets.filter((asset) => !asset.alreadyPublished && asset.hasPreview).length === 0 ? <div className="portfolio-empty"><p>No eligible images yet. Create a studio portfolio project, upload photographs cleared for public display in Storage, and leave them out of private customer galleries.</p><a href="/dashboard?view=Projects">Open projects →</a><a href="/dashboard?view=Storage">Open storage →</a></div> : <>
          <form className="portfolio-publish-form" onSubmit={publish}>
            <label className="portfolio-select-label">Select image<select required value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Choose an image</option>{assets.filter((asset) => !asset.alreadyPublished && asset.hasPreview).map((asset) => <option key={asset.id} value={asset.id}>{asset.filename} · {asset.projectName}</option>)}</select></label>
            {selectedId && <div className="portfolio-selected-preview">{assets.find((asset) => asset.id === selectedId)?.previewUrl ? <img src={assets.find((asset) => asset.id === selectedId)?.previewUrl} alt="Selected photograph preview" /> : <span>Preview unavailable</span>}</div>}
            <label className="portfolio-caption-label">Caption <span>(optional)</span><input maxLength={200} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="A short note about this photograph" /></label>
            <label className="portfolio-consent"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm this image is approved for public display and does not reveal client material without permission.</span></label>
            <button className="primary" disabled={busy || !selectedId || !confirmed}>{busy ? "Saving…" : "Add to public portfolio"}</button>
          </form>
        </>}
      </section>

      <section className="panel portfolio-published">
        <div className="portfolio-section-heading"><div><h3>On your public portfolio</h3><p>Remove an image at any time.</p></div><span>{items.length} published</span></div>
        {loading ? <p className="portfolio-empty">Loading published images…</p> : items.length === 0 ? <p className="portfolio-empty">Your public portfolio is empty. Add a photograph when you have images cleared to share.</p> : <div className="portfolio-published-list">{items.map((item) => <article key={item.id}><div className="portfolio-published-thumb">{item.previewUrl ? <img src={item.previewUrl} alt={item.caption || item.media?.filename || "Published portfolio photograph"} /> : <span>IMG</span>}</div><div><b>{item.caption || item.media?.filename || "Portfolio photograph"}</b><small>{item.media?.filename}</small></div><button disabled={busy} onClick={() => void remove(item)} aria-label={"Remove " + (item.media?.filename || "photograph")}>Remove</button></article>)}</div>}
      </section>
    </div>}
  </section>;
}




