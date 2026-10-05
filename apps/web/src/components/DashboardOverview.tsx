"use client";
import { createAppSupabaseClient } from "@/lib/supabaseClient";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import StorageBillingPanel from "@/components/StorageBillingPanel";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && anon ? createAppSupabaseClient(url, anon) : null;

type Studio = { id: string; name: string; status: string; role?: string };
type Dashboard = {
  summary: {
    activeProjects: number;
    clients: number;
    pendingPayments: number;
    completedPayments: number;
    receivedLast30Days: number;
    storageLimitBytes: number;
    storageUsedBytes: number;
    storageReservedBytes: number;
    activeGalleries: number;
  };
  recentProjects: { id: string; name: string; status: string; event_type: string; event_date: string | null; clients: { name: string } | null }[];
  recentInvoices: { id: string; number: string; kind: string; total: number; amount_paid: number; status: string; due_date: string | null; projects: { name: string } | null }[];
  upcomingEvents: { id: string; event_date: string; event_type: string; name: string; clients: { name: string } | null }[];
};

function money(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function DashboardOverview() {
  const [session, setSession] = useState<Session | null>(null);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [studiosLoaded, setStudiosLoaded] = useState(false);
  const [org, setOrg] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studioName, setStudioName] = useState("");
  const [creatingStudio, setCreatingStudio] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const acceptSession = (nextSession: Session | null) => {
      if (!active) return;
      if (nextSession?.user.user_metadata?.user_type === "customer") {
        window.location.replace("/customer");
        return;
      }
      setSession(nextSession);
    };
    supabase.auth.getSession().then(({ data: result, error: sessionError }) => {
      if (sessionError) {
        void supabase.auth.signOut();
        if (active) setSession(null);
        return;
      }
      acceptSession(result.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => acceptSession(nextSession));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) {
      setStudios([]);
      setStudiosLoaded(false);
      setOrg("");
      return;
    }
    let cancelled = false;
    setStudiosLoaded(false);
    fetch(api + "/studios", { headers: { Authorization: "Bearer " + session.access_token } })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { void supabase?.auth.signOut(); window.location.replace("/login"); throw new Error("Your session expired. Please sign in again."); } if (!response.ok) throw new Error(result.error || "Could not load studio access.");
        if (cancelled) return;
        const available: Studio[] = (result.studios || []).filter((studio: Studio) => studio.status === "ACTIVE");
        setStudios(available);
        setStudiosLoaded(true);
        const saved = localStorage.getItem("activeOrganizationId");
        const preferred = available.find((studio) => studio.id === saved);
        if (preferred) setOrg(preferred.id);
        else if (available.length === 1) setOrg(available[0].id);
        else setOrg("");
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Could not load studio access.");
          setStudiosLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (org) localStorage.setItem("activeOrganizationId", org);
  }, [org]);

  useEffect(() => {
    if (!session || !org) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    fetch(api + "/dashboard", {
      headers: { Authorization: "Bearer " + session.access_token, "x-organization-id": org },
    })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { void supabase?.auth.signOut(); window.location.replace("/login"); throw new Error("Your session expired. Please sign in again."); } if (!response.ok) throw new Error(result.error || "Could not load the dashboard.");
        if (!cancelled) setData(result);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load the dashboard.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, org]);

  async function createStudio(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setCreatingStudio(true);
    setError("");
    setSetupMessage("");
    try {
      const response = await fetch(api + "/studios", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({ name: studioName.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create your studio workspace.");
      if (result.status === "PENDING_APPROVAL") {
        window.location.replace("/dashboard");
        return;
      }
      const listResponse = await fetch(api + "/studios", { headers: { Authorization: "Bearer " + session.access_token } });
      const list = await listResponse.json();
      if (!listResponse.ok) throw new Error(list.error || "Your studio was created but could not be loaded yet. Refresh the page.");
      const available: Studio[] = list.studios || [];
      setStudios(available);
      setStudiosLoaded(true);
      setOrg(result.organizationId || available.at(-1)?.id || "");
      setStudioName("");
      setSetupMessage("Your studio workspace is ready for review. You can complete your profile now; publishing and media uploads will be available after approval.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create your studio workspace.");
    } finally {
      setCreatingStudio(false);
    }
  }

  if (!url || !anon) {
    return <section className="dashboard-gate panel"><span className="eyebrow">STUDIO WORKSPACE</span><h2>Connect your studio account</h2><p>Add the Supabase project URL and public key to <code>apps/web/.env.local</code>, then sign in to see live client, project, payment and storage information.</p><a className="primary" href="/login">Open sign in</a></section>;
  }

  if (!session) {
    return <section className="dashboard-gate panel"><span className="eyebrow">STUDIO WORKSPACE</span><h2>Your studio, at a glance</h2><p>Sign in to see active projects, clients, outstanding payments, recent invoices and storage usage.</p><a className="primary" href="/login">Sign in to your studio</a><span className="dashboard-secondary">New photographer? <a href="/signup">Create an account</a></span></section>;
  }

  const summary = data?.summary;
  const activeStudio = studios.find((studio) => studio.id === org);

  return <div className="live-dashboard">
    {studiosLoaded && studios.length === 0 && <section className="panel dashboard-gate">
      <span className="eyebrow">FIRST, SET UP YOUR STUDIO</span>
      <h2>Create your studio workspace</h2>
      <p>This is where you’ll manage appointments, clients, projects, quotations and private galleries. New studios are reviewed before they appear in the public directory.</p>
      <form className="dashboard-studio-form" onSubmit={createStudio}>
        <label htmlFor="new-studio-name">Studio name</label>
        <div><input id="new-studio-name" required minLength={2} maxLength={140} value={studioName} onChange={(event) => setStudioName(event.target.value)} placeholder="For example, Willow Photography" /><button className="primary" disabled={creatingStudio}>{creatingStudio ? "Creating workspace…" : "Create workspace"}</button></div>
      </form>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
    </section>}

    {studios.length > 0 && <div className="dashboard-controls"><label>Studio<select value={org} onChange={(event) => setOrg(event.target.value)}><option value="">Choose a studio</option>{studios.map((studio) => <option key={studio.id} value={studio.id}>{studio.name} · {studio.status.replaceAll("_", " ")}</option>)}</select></label><button className="text-button" onClick={() => void supabase?.auth.signOut()}>Sign out</button></div>}
    {activeStudio?.status === "PENDING_APPROVAL" && <div className="panel dashboard-approval"><b>Your studio is awaiting review.</b><span>You can prepare the studio profile while the platform team reviews the registration. Public listings and uploads become available after approval.</span></div>}
    {activeStudio?.status === "SUSPENDED" && <div className="panel dashboard-approval dashboard-suspended"><b>This studio is currently suspended.</b><span>Contact the Super Admin if you believe this is an error.</span></div>}
    {setupMessage && <div className="panel dashboard-approval"><b>Studio workspace created.</b><span>{setupMessage}</span></div>}
    {error && studios.length > 0 && <div className="panel dashboard-error" role="alert">{error}</div>}
    {loading && !data && <div className="panel dashboard-gate">Loading your studio summary…</div>}
    {studiosLoaded && studios.length > 0 && !org && <div className="panel dashboard-gate"><h2>Choose a studio workspace</h2><p>Select the studio you want to work in from the menu above.</p></div>}
    {org && <StorageBillingPanel session={session} orgId={org} />}

    {summary && <><div className="live-stat-grid">
      <article className="stat-card"><div className="stat-title">ACTIVE PROJECTS</div><div className="stat-value">{summary.activeProjects}</div><a href="/dashboard?view=Projects">View recent projects →</a></article>
      <article className="stat-card"><div className="stat-title">CLIENTS</div><div className="stat-value">{summary.clients}</div><a href="/dashboard?view=Clients">Open client list →</a></article>
      <article className="stat-card"><div className="stat-title">TO COLLECT</div><div className="stat-value">{money(summary.pendingPayments)}</div><div className="stat-foot">Open invoice balances</div></article>
      <article className="stat-card"><div className="stat-title">COLLECTED</div><div className="stat-value">{money(summary.completedPayments)}</div><div className="stat-foot">{money(summary.receivedLast30Days)} in the last 30 days</div></article>
    </div>
    <div className="live-dashboard-grid">
      <section className={`panel live-list${data?.recentProjects.length ? "" : " live-list-empty"}`}><div className="panel-head"><div><h2>Recent projects</h2><p>Current project activity</p></div>{data?.recentProjects.length ? <a className="text-button" href="/dashboard?view=Projects">All projects →</a> : null}</div>{data?.recentProjects.length ? data.recentProjects.map((project) => <div className="live-row" key={project.id}><div><b>{project.name}</b><small>{project.clients?.name || "Client not assigned"} · {project.event_type || "Event"}{project.event_date ? " · " + new Date(project.event_date + "T00:00:00").toLocaleDateString() : ""}</small></div><span className="status status-blue"><i />{project.status.replaceAll("_", " ")}</span></div>) : <div className="live-empty-state"><span aria-hidden="true">＋</span><div><b>Your projects will appear here</b><p>Create a project to keep its client, event details and progress together.</p></div><a href="/projects/new">Create project <span aria-hidden="true">→</span></a></div>}</section>
      {Boolean(data?.upcomingEvents.length) && <section className="panel live-list"><div className="panel-head"><div><h2>Upcoming events</h2><p>Scheduled projects</p></div></div>{data?.upcomingEvents.map((event) => <div className="live-row" key={event.id}><div><b>{event.name}</b><small>{event.clients?.name || "Client"} · {event.event_type || "Session"}</small></div><span>{new Date(event.event_date + "T00:00:00").toLocaleDateString()}</span></div>)}</section>}
      {Boolean(data?.recentInvoices.length) && <section className="panel live-list"><div className="panel-head"><div><h2>Recent invoices</h2><p>Payment status, verified by your provider</p></div></div>{data?.recentInvoices.map((invoice) => <div className="live-row" key={invoice.id}><div><b>{invoice.number}</b><small>{invoice.projects?.name || invoice.kind} · Paid {money(invoice.amount_paid)} of {money(invoice.total)}</small></div><span className={"status " + (invoice.status === "PAID" ? "status-green" : "status-amber")}><i />{invoice.status}</span></div>)}</section>}
    </div></>}
  </div>;
}




