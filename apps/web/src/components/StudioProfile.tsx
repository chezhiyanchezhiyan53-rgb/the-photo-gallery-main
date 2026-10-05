"use client";
import { createAppSupabaseClient } from "@/lib/supabaseClient";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import StorageBillingPanel from "@/components/StorageBillingPanel";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createAppSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

type Studio = { id: string; name: string; status: string };
type Profile = {
  public_name: string;
  city: string;
  description: string;
  specialties: string[];
  contact_email: string;
  published: boolean;
};

export default function StudioProfile() {
  const [session, setSession] = useState<Session | null>(null);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [contact, setContact] = useState("");
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedStudio = studios.find((studio) => studio.id === org);
  const isPending = selectedStudio?.status === "PENDING_APPROVAL";

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setSession(data.session));
    const subscription = supabase?.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetch(`${api}/studios`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your studios.");
        if (!active) return;
        const availableStudios: Studio[] = data.studios || [];
        setStudios(availableStudios);
        if (availableStudios.length === 1) setOrg(availableStudios[0].id);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load your studios."); });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session || !org) return;
    const studio = studios.find((item) => item.id === org);
    setName(studio?.name || "");
    setCity("");
    setDescription("");
    setSpecialties("");
    setContact("");
    setPublished(false);
    setSaved(false);
    setError("");
    if (!studio || studio.status !== "ACTIVE") return;

    let active = true;
    setLoading(true);
    fetch(`${api}/studio/profile`, { headers: { Authorization: `Bearer ${session.access_token}`, "x-organization-id": org } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load this public profile.");
        if (!active) return;
        const profile: Profile | null = data.profile;
        if (!profile) return;
        setName(profile.public_name || studio.name);
        setCity(profile.city || "");
        setDescription(profile.description || "");
        setSpecialties((profile.specialties || []).join(", "));
        setContact(profile.contact_email || "");
        setPublished(profile.published);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load this public profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, org, studios]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!supabase) { setError("Supabase configuration is required."); return; }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    else setPassword("");
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    const response = await fetch(`${api}/studio/profile`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${session?.access_token}`, "x-organization-id": org, "Content-Type": "application/json" },
      body: JSON.stringify({
        publicName: name,
        city,
        description,
        specialties: specialties.split(",").map((item) => item.trim()).filter(Boolean),
        contactEmail: contact,
        published,
      }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not save this profile."); return; }
    setSaved(true);
  }

  if (!session) return <section className="panel studio-profile-desk">
    <h2>Public studio profile</h2>
    <p>Sign in to choose what customers see in the photographer directory.</p>
    <form className="connect-form" onSubmit={signIn}>
      <input type="email" autoComplete="username" required placeholder="Studio email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input type="password" autoComplete="current-password" required placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <button className="primary">Sign in</button>
    </form>
    {error && <p className="connect-error">{error}</p>}
  </section>;

  return <>
  <section className="panel studio-profile-desk">
    <div className="inbox-toolbar">
      <div><h2>Public studio profile</h2><p>Publish your studio so customers can find and contact you.</p></div>
      <label>Studio<select value={org} onChange={(event) => setOrg(event.target.value)}>
        <option value="">Choose a studio</option>
        {studios.map((studio) => <option key={studio.id} value={studio.id}>{studio.name} · {studio.status.replaceAll("_", " ")}</option>)}
      </select></label>
    </div>

    {!org && <div className="studio-directory-status">Choose a studio to manage its customer listing.</div>}
    {selectedStudio && <div className={`studio-directory-status ${published ? "is-published" : ""}`}>
      <strong>{isPending ? "Approval in progress" : published ? "Your studio is listed" : "Your studio is not listed yet"}</strong>
      <span>{isPending ? "The Super Admin must approve this studio before it can appear to customers." : published ? "Customers can find it in the directory." : "Review your public name, turn on the listing, and save below."}</span>
    </div>}

    {studios.length === 0 && !error ? <div className="studio-profile-empty">No studio workspace yet. Create one from the Overview page first.</div> : selectedStudio && <form className="quotation-form" onSubmit={saveProfile}>
      <fieldset disabled={loading || isPending}>
        <label>Public studio name<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your studio name" /></label>
        <label>City<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City (optional)" /></label>
        <label>Specialties<input value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Weddings, portraits (optional)" /></label>
        <label>Contact email<input type="email" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Email customers can use (optional)" /></label>
        <label>About the studio<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A short introduction (optional)" /></label>
        <label className="publish-toggle"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />Show my studio in the public directory</label>
      </fieldset>
      {error && <p className="connect-error">{error}</p>}
      {saved && <div className="notice">{published ? "Your studio is now listed in the customer directory." : "Profile saved. Turn on the directory listing when you are ready."}</div>}
      {loading && <p className="profile-loading">Loading studio profile…</p>}
      <div className="studio-profile-actions"><button className="primary" disabled={!org || isPending || loading}>{published ? "Save and publish" : "Save profile"}</button><a className="text-button" href="/directory" target="_blank" rel="noreferrer">View customer directory →</a></div>
    </form>}
    {error && !selectedStudio && <p className="connect-error">{error}</p>}
  </section>
  {selectedStudio && <StorageBillingPanel session={session} orgId={org} />}
  </>;
}
