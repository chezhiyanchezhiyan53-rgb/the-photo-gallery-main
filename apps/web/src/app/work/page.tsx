"use client";

import { useEffect, useMemo, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";
type PortfolioItem = { id: string; caption: string; imageUrl: string; alt: string; studio: { name: string; city: string; specialties: string[] } };

export default function PublicPortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(api + "/public/portfolio");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The public gallery is unavailable right now.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The public gallery is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => [item.caption, item.studio.name, item.studio.city, ...item.studio.specialties].join(" ").toLowerCase().includes(query));
  }, [items, search]);

  return <main className="public-portfolio-page">
    <header className="directory-nav">
      <a href="/" className="directory-brand"><span className="directory-brand-mark">P</span><span>The Photo Gallery</span></a>
      <nav aria-label="Main navigation"><a className="active" href="/work">Gallery</a><a href="/photographers">Photographers</a></nav>
      <div className="directory-auth-links"><a className="directory-signin" href="/customer/login">Sign in</a><a className="directory-signin" href="/customer/signup">Sign up</a></div>
    </header>

    <section className="public-portfolio-hero">
      <p className="directory-eyebrow"><span /> WORK SHARED BY PHOTOGRAPHY STUDIOS</p>
      <h1>Good work speaks in its own way.</h1>
      <p>Browse images studios have chosen to share. Find a photographer whose work suits your plans.</p>
    </section>

    <section className="public-portfolio-content">
      <div className="public-portfolio-toolbar"><div><h2>Recent work</h2></div><label><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search work, studio or city" aria-label="Search public portfolio" /></label></div>
      {error && <div className="directory-state directory-error"><span>!</span><div><strong>We couldn’t load the gallery.</strong><p>{error}</p></div><button onClick={() => void load()}>Try again</button></div>}
      {loading && !error && <div className="directory-loading"><span /><span /><span />Loading public work…</div>}
      {!loading && !error && visibleItems.length > 0 && <div className="public-portfolio-grid">
        {visibleItems.map((item) => <article className="public-portfolio-card" key={item.id}>
          <div className="public-portfolio-photo"><img src={item.imageUrl} alt={item.alt} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /></div>
          <div className="public-portfolio-caption"><div><h3>{item.caption || item.studio.name}</h3><p>{item.studio.name}{item.studio.city ? " · " + item.studio.city : ""}</p></div><a href="/photographers" aria-label={"Browse photographers including " + item.studio.name}>↗</a></div>
          {item.studio.specialties.length > 0 && <div className="public-portfolio-tags">{item.studio.specialties.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>}
        </article>)}
      </div>}
      {!loading && !error && visibleItems.length === 0 && <div className="directory-empty">
        <h3>{items.length ? "No work matches that search." : "Public photographs will appear here."}</h3>
        <p>{items.length ? "Try another studio name, city or search term." : "Studios will add photographs they have approved for public sharing."}</p>
      </div>}
    </section>

    <footer className="directory-footer"><a href="/" className="directory-brand"><span className="directory-brand-mark">P</span><span>The Photo Gallery</span></a><a href="/photographers">Photographers →</a></footer>
  </main>;
}



