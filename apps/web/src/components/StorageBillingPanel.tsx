"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";
type Billing = {
  storage: { storage_limit_bytes: number; storage_used_bytes: number; storage_reserved_bytes: number };
  subscription: { plan_name: string; status: string; current_period_end: string | null };
  addons: { id: string; storage_bytes: number; amount: number; status: string; paid_at: string | null }[];
  addonOptions: { id: string; bytes: number; amount: number }[];
  billingReady: boolean;
  billingMessage: string | null;
};

function formatBytes(value: number) {
  if (value >= 1024 ** 4) return `${(value / 1024 ** 4).toFixed(1)} TB`;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  return `${(value / 1024 ** 2).toFixed(0)} MB`;
}
function formatGigabytes(value: number) { return `${(value / 1024 ** 3).toFixed(1)} GB`; }
function formatMoney(paise: number) { return `₹${(paise / 100).toLocaleString("en-IN")}`; }

export default function StorageBillingPanel({ session, orgId, onQuotaChange, compact = false }: {
  session: Session | null;
  orgId: string;
  onQuotaChange?: (limitBytes: number) => void;
  compact?: boolean;
}) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [checkoutReady, setCheckoutReady] = useState(false);

  const load = useCallback(async () => {
    if (!session || !orgId) { setBilling(null); return; }
    const response = await fetch(`${api}/billing/storage`, { headers: { Authorization: `Bearer ${session.access_token}`, "x-organization-id": orgId } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load storage billing.");
    setBilling(data);
    setError("");
    onQuotaChange?.(Number(data.storage.storage_limit_bytes));
  }, [session, orgId, onQuotaChange]);

  useEffect(() => {
    let active = true;
    setError("");
    const refresh = (reportError = false) => {
      if (document.visibilityState === "hidden") return;
      load().catch((reason) => { if (active && reportError) setError(reason instanceof Error ? reason.message : "Could not load storage billing."); });
    };
    refresh(true);
    const timer = window.setInterval(() => refresh(), 15000);
    const refreshOnChange = () => refresh();
    window.addEventListener("focus", refreshOnChange);
    window.addEventListener("storage-usage-updated", refreshOnChange);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refreshOnChange); window.removeEventListener("storage-usage-updated", refreshOnChange); };
  }, [load]);

  async function request<T>(path: string, body?: unknown): Promise<T> {
    if (!session) throw new Error("Sign in to manage your storage plan.");
    const response = await fetch(`${api}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${session.access_token}`, "x-organization-id": orgId, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The billing request could not be completed.");
    return data as T;
  }

  async function subscribe() {
    setBusy("basic"); setError(""); setNotice("");
    try {
      const result = await request<{ orderId: string; keyId: string; amount: number; currency: string }>("/billing/basic-order", {});
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Secure checkout is still loading. Try again in a moment.");
      const checkout = new Razorpay({ key: result.keyId, order_id: result.orderId, amount: result.amount, currency: result.currency, name: "The Photo Gallery", description: "Basic plan · 5 GB storage · 1 month · ₹499", prefill: { email: session?.user.email }, theme: { color: "#20201e" }, handler: async (payment: any) => {
        try {
          await request("/billing/basic-order-verify", { orderId: payment.razorpay_order_id || result.orderId, paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature });
          setNotice(""); await load();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not confirm the Basic plan payment yet."); }
        finally { setBusy(""); }
      } });
      checkout.on?.("payment.failed", (event: any) => { setError(event?.error?.description || "The Basic plan payment did not complete."); setBusy(""); });
      checkout.open();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not start the Basic plan payment."); setBusy(""); }
  }

  async function buyAddon(packId: string) {
    setBusy(packId); setError(""); setNotice("");
    try {
      const result = await request<{ orderId: string; keyId: string; amount: number; currency: string }>("/billing/storage-addon-order", { packId });
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Secure checkout is still loading. Try again in a moment.");
      const checkout = new Razorpay({ key: result.keyId, order_id: result.orderId, amount: result.amount, currency: result.currency, name: "The Photo Gallery", description: `${packId.toUpperCase()} storage add-on`, prefill: { email: session?.user.email }, theme: { color: "#20201e" }, handler: async (payment: any) => {
        try {
          await request("/billing/storage-addon-verify", { orderId: payment.razorpay_order_id || result.orderId, paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature });
          setNotice("Payment verified. Your storage quota has been increased."); await load();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not confirm the add-on payment yet."); }
        finally { setBusy(""); }
      } });
      checkout.on?.("payment.failed", (event: any) => { setError(event?.error?.description || "The add-on payment did not complete."); setBusy(""); });
      checkout.open();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not start the storage add-on."); setBusy(""); }
  }

  if (!session || !orgId) return null;
  const used = billing ? Number(billing.storage.storage_used_bytes) + Number(billing.storage.storage_reserved_bytes) : 0;
  const limit = billing ? Number(billing.storage.storage_limit_bytes) : 0;
  const remaining = Math.max(0, limit - used);
  const percent = limit > 0 ? Math.min(100, used / limit * 100) : 0;
  const nearLimit = percent >= 80;
  const planActive = billing?.subscription.status === "ACTIVE" && (!billing.subscription.current_period_end || new Date(billing.subscription.current_period_end) > new Date());

  return <section className={`panel storage-billing-card${compact ? " is-compact" : ""}`}>
    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" onReady={() => setCheckoutReady(true)} />
    <div className="storage-billing-heading"><div><span className="eyebrow">STORAGE USAGE</span><h2>{billing?.subscription.plan_name || "Basic"} plan</h2><p>5 GB included · ₹499 for one month</p></div><span className={`storage-billing-status ${billing?.subscription.status === "ACTIVE" ? "is-active" : ""}`}>{(billing?.subscription.status || "Loading").replaceAll("_", " ")}</span></div>
    {error && <p className="storage-billing-message is-error" role="alert">{error}</p>}{notice && <p className="storage-billing-message" role="status">{notice}</p>}
    {billing ? <>
      <div className="storage-billing-usage"><div><strong>{formatGigabytes(used)} <span>/ {formatGigabytes(limit)} used</span></strong><b>{formatGigabytes(remaining)} remaining</b></div><div className="storage-billing-meter" role="progressbar" aria-label="Studio storage used" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><i className={nearLimit ? "is-near-limit" : ""} style={{ width: `${percent}%` }} /></div><small>{billing.storage.storage_reserved_bytes > 0 ? `${formatGigabytes(Number(billing.storage.storage_reserved_bytes))} reserved for active uploads · ` : ""}{percent.toFixed(0)}% used</small></div>
      {nearLimit && <div className={`storage-billing-prompt${remaining === 0 ? " is-over-limit" : ""}`}><span>{remaining === 0 ? "Storage is full. Purchase an add-on before uploading more files." : "You’re nearing your storage limit. Add storage whenever you need it."}</span><a href="#storage-addon-options">Buy Additional Storage <span aria-hidden="true">→</span></a></div>}
      {billing.billingMessage && <p className="storage-billing-message" role="status">{billing.billingMessage}</p>}
      <div className="storage-addon-options" id="storage-addon-options">{billing.addonOptions.map(pack => <button key={pack.id} type="button" disabled={!!busy || !checkoutReady || !billing.billingReady || !planActive} onClick={() => void buyAddon(pack.id)}><span>{busy === pack.id ? "Opening checkout…" : `＋ ${formatBytes(pack.bytes)}`}</span><b>{formatMoney(pack.amount)}</b></button>)}</div>
      {(billing.subscription.status !== "ACTIVE" || billing.subscription.current_period_end && new Date(billing.subscription.current_period_end) <= new Date()) && <div className="storage-basic-action"><span>One-time payment. Your 5 GB access lasts one month; renew manually to keep uploading and buying add-ons.</span><button type="button" className="primary" disabled={!!busy || !checkoutReady || !billing.billingReady} onClick={() => void subscribe()}>{busy === "basic" ? "Opening checkout…" : billing.subscription.status === "PENDING_PAYMENT" ? "Complete Basic payment" : "Pay ₹499 · 1 month"}</button></div>}
      {!compact && billing.addons.some(addon => addon.status === "CAPTURED") && <details className="storage-addon-history"><summary>Purchased storage add-ons</summary>{billing.addons.filter(addon => addon.status === "CAPTURED").map(addon => <div key={addon.id}><span>{formatBytes(Number(addon.storage_bytes))} · {addon.paid_at ? new Date(addon.paid_at).toLocaleDateString() : "Paid"}</span><b>{formatMoney(Number(addon.amount))}</b></div>)}</details>}
    </> : !error && <p className="storage-billing-loading">Loading your storage plan…</p>}
  </section>;
}
