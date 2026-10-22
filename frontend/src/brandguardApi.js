const isBrowser = typeof window !== "undefined";
const isLocal = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
export const API_BASE = import.meta.env.VITE_BRANDGUARD_API_URL ?? (isLocal ? "http://127.0.0.1:8000" : "");

export async function reviewWithBrandGuard({
  content,
  brandName = "Acme CloudSync",
  guidelines,
  approvedFacts,
  bannedTerms,
  approvedClaims,
}) {
  const response = await fetch(`${API_BASE}/api/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      brand_name: brandName,
      ...(guidelines ? { guidelines } : {}),
      ...(approvedFacts ? { approved_facts: approvedFacts } : {}),
      ...(bannedTerms ? { banned_terms: bannedTerms } : {}),
      ...(approvedClaims ? { approved_claims: approvedClaims } : {}),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Review failed (${response.status})`);
  }
  return data;
}
