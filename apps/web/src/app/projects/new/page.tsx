import ProjectClientDesk from "@/components/ProjectClientDesk";

export default function NewProjectPage() {
  return (
    <main className="public-page new-project-page">
      <header className="public-header">
        <a href="/dashboard" className="brand"><span className="brand-mark">P</span><span>The Photo Gallery<small>STUDIO PLATFORM</small></span></a>
        <a className="text-button" href="/dashboard">← Workspace</a>
      </header>
      <section className="new-project-intro"><p className="eyebrow">STUDIO WORKSPACE</p><h1>New project</h1><p>Add the client and event details to get the work underway.</p></section>
      <div className="new-project-records"><ProjectClientDesk mode="Projects" /></div>
    </main>
  );
}
