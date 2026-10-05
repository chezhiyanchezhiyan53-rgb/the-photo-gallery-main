"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createAppSupabaseClient } from "@/lib/supabaseClient";
import MediaUploadPanel from "@/components/MediaUploadPanel";
import BookingInbox from "@/components/BookingInbox";
import QuotationDesk from "@/components/QuotationDesk";
import GalleryDesk from "@/components/GalleryDesk";
import StudioProfile from "@/components/StudioProfile";
import InvoiceDesk from "@/components/InvoiceDesk";
import ProjectClientDesk from "@/components/ProjectClientDesk";
import DashboardOverview from "@/components/DashboardOverview";
import PortfolioDesk from "@/components/PortfolioDesk";

type View = "Overview" | "Projects" | "Clients" | "Gallery" | "Storage" | "Invoices" | "Settings" | "Requests" | "Quotations" | "Portfolio";
const navGroups: { label:string; items:{ name:View; icon:string }[] }[] = [
  {label:"WORKSPACE",items:[{name:"Overview",icon:"⌂"},{name:"Projects",icon:"▧"},{name:"Clients",icon:"♙"},{name:"Requests",icon:"✉"}]},
  {label:"CLIENT DELIVERY",items:[{name:"Gallery",icon:"▦"},{name:"Portfolio",icon:"▧"}]},
  {label:"BILLING",items:[{name:"Quotations",icon:"₹"},{name:"Invoices",icon:"▤"}]},
  {label:"STUDIO",items:[{name:"Storage",icon:"◫"},{name:"Settings",icon:"⚙"}]}
];
const items = navGroups.flatMap(group => group.items);
function DashboardContent(){
 const [view,setView]=useState<View>("Overview");const params=useSearchParams();const section=params.get("view") as View|null;const projectId=params.get("projectId")||"";const mediaId=params.get("mediaId")||"";
 const [signedIn,setSignedIn]=useState(false);
 useEffect(()=>{if(section&&items.some(i=>i.name===section))setView(section);},[section]);
 useEffect(()=>{if(!authClient)return;let active=true;void authClient.auth.getSession().then(({data})=>{if(active)setSignedIn(Boolean(data.session));});const {data:{subscription}}=authClient.auth.onAuthStateChange((_event,session)=>setSignedIn(Boolean(session)));return()=>{active=false;subscription.unsubscribe();};},[]);
 async function signOut(){await authClient?.auth.signOut();window.location.replace("/login");}
 return <main className="workspace">
  <aside className="sidebar"><a className="brand" href="/"><span className="brand-mark">P</span><span>The Photo Gallery<small>STUDIO PLATFORM</small></span></a><nav className="workspace-nav" aria-label="Studio workspace">{navGroups.map(group=><div className="sidebar-nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item=><button key={item.name} className={`nav-item ${view===item.name?"active":""}`} aria-current={view===item.name?"page":undefined} onClick={()=>setView(item.name)}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.name}</span></button>)}</div>)}</nav><div className="sidebar-bottom"><a className="profile" href="/login"><span className="profile-pic">↗</span><span><b>{signedIn?"Account":"Account access"}</b><small>{signedIn?"Studio account":"Sign in or switch account"}</small></span></a>{signedIn&&<button className="sidebar-signout" onClick={()=>void signOut()}><span className="sidebar-signout-icon" aria-hidden="true">↪</span><span>Sign out</span></button>}</div></aside>
  <section className="main-area"><header className="topbar"><div className="breadcrumb">Studio workspace <span>/</span> {view}</div><div className="top-actions"><a className="help-link" href="/directory">Photographer directory</a></div></header>
   <div className="content"><div className="welcome-row"><div><p className="eyebrow">YOUR STUDIO AT A GLANCE</p><h1>{view==="Overview"?"Studio overview":view}</h1><p className="subhead">{view==="Overview"?"Here’s what’s happening at your studio today.":view==="Storage"?"Upload photos and videos to a project’s private gallery.":`Keep your ${view.toLowerCase()} moving smoothly.`}</p></div>{view!=="Storage"&&<a className="primary" href="/projects/new">＋ <span>New project</span></a>}</div>
   {view==="Overview"&&<DashboardOverview/>}
   {view==="Storage"&&<section className="storage-view"><MediaUploadPanel initialProjectId={projectId}/>{projectId&&<a className="text-button storage-gallery-link" href={`/dashboard?view=Gallery&projectId=${projectId}`}>Add uploaded photos to the customer gallery →</a>}</section>}
   {(view==="Projects"||view==="Clients")&&<ProjectClientDesk mode={view}/>} {view==="Requests"&&<BookingInbox/>}{view==="Quotations"&&<QuotationDesk initialProjectId={projectId}/>} {view==="Gallery"&&<GalleryDesk initialProjectId={projectId} initialMediaId={mediaId}/>}{view==="Settings"&&<StudioProfile/>}{view==="Invoices"&&<InvoiceDesk/>}{view==="Portfolio"&&<PortfolioDesk/>}
   <footer>© {new Date().getFullYear()} The Photo Gallery <span>Private by design <i>·</i> Built for photographers</span></footer></div>
  </section>
 </main>
}

const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const authAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authClient = authUrl && authAnon ? createAppSupabaseClient(authUrl, authAnon) : null;
const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

function DashboardAccessGate() {
  const [access, setAccess] = useState<"loading" | "allowed" | "pending" | "suspended" | "photographer-pending" | "photographer-rejected" | "unverified">("loading");
  useEffect(() => {
    if (!authClient) { setAccess("allowed"); return; }
    let active = true;
    authClient.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        await authClient.auth.signOut();
        if (active) window.location.replace("/login");
        return;
      }
      const session = data.session;
      if (!session) { window.location.replace("/login"); return; }
      if (session.user.user_metadata?.user_type === "customer") {
        window.location.replace("/customer");
        return;
      }
      try {
        const response = await fetch(apiBase + "/studios", { headers: { Authorization: "Bearer " + session.access_token } });
        if (response.status === 401) {
          await authClient.auth.signOut();
          window.location.replace("/login");
          return;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not verify studio access.");
        
        if (result.approvalStatus === "REJECTED") { setAccess("photographer-rejected"); return; }
        const studios = result.studios || [];
        if (!studios.some((studio: { status: string }) => studio.status === "ACTIVE")) {
          if (studios.some((studio: { status: string }) => studio.status === "PENDING_APPROVAL")) setAccess("pending");
          else if (studios.some((studio: { status: string }) => studio.status === "SUSPENDED")) setAccess("suspended");
          else setAccess("allowed");
          return;
        }
        setAccess("allowed");
      } catch {
        if (active) setAccess("unverified");
      }
    });
    return () => { active = false; };
  }, []);

  if (access === "loading") return <main className="auth-shell"><section className="panel auth-card">Checking your studio access…</section></main>;
  if (access === "unverified") return <main className="auth-shell"><section className="panel auth-card"><span className="eyebrow">PHOTOGRAPHER WORKSPACE</span><h1>Could not verify studio approval</h1><p>We could not confirm whether your studio is approved. Refresh this page to check again before opening the workspace.</p><button className="secondary-button" onClick={() => window.location.reload()}>Check again</button></section></main>;
  if (access === "photographer-pending" || access === "photographer-rejected") return <main className="auth-shell"><section className="panel auth-card"><span className="eyebrow">PHOTOGRAPHER ACCOUNT</span><h1>{access === "photographer-pending" ? "Your application is awaiting review" : "Your application was not approved"}</h1><p>{access === "photographer-pending" ? "A Super Admin will review your photographer account. You can set up your studio workspace after it is approved." : "Contact the Super Admin if you would like more information about this decision."}</p><button className="secondary-button" onClick={async () => { await authClient?.auth.signOut(); window.location.replace("/"); }}>Sign out</button></section></main>;
  if (access === "pending" || access === "suspended") return <main className="auth-shell"><section className="panel auth-card"><span className="eyebrow">PHOTOGRAPHER WORKSPACE</span><h1>{access === "pending" ? "Your studio is awaiting approval" : "Studio access is suspended"}</h1><p>{access === "pending" ? "A Super Admin must approve your studio before you can access projects, clients, payments, galleries or media. This page will be available after approval." : "Contact the Super Admin for information about your studio access."}</p><button className="secondary-button" onClick={async () => { await authClient?.auth.signOut(); window.location.replace("/"); }}>Sign out</button></section></main>;
  return <Suspense fallback={<main className="workspace"><section className="panel">Loading studio workspace…</section></main>}><DashboardContent/></Suspense>;
}

export default function Home(){
  return <DashboardAccessGate/>;
}




