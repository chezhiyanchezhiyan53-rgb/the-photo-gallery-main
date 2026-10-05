const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

export async function verifyRazorpayCheckout(response: unknown): Promise<boolean> {
  const result = await fetch(api + "/payments/verify-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response),
  });
  const payload = await result.json();
  if (!result.ok) throw new Error(payload.error || "Payment verification is pending.");
  return payload.verified === true;
}
