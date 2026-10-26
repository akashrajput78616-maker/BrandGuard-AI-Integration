const isBrowser = typeof window !== "undefined";
const isLocal = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
export const API_BASE = import.meta.env.VITE_BRANDGUARD_API_URL ?? (isLocal ? "http://127.0.0.1:8000" : "");

export async function reviewWithBrandGuard({
  content,
  brandName = "Acme CloudSync",
  tenantId = "default-tenant",
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
      tenant_id: tenantId,
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

export async function fetchDocuments(tenantId = "default-tenant") {
  const res = await fetch(`${API_BASE}/api/documents?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function searchGuidelineChunks(query, tenantId = "default-tenant", topK = 4) {
  const res = await fetch(
    `${API_BASE}/api/rag/search?query=${encodeURIComponent(query)}&tenant_id=${tenantId}&top_k=${topK}`
  );
  if (!res.ok) throw new Error("Search query failed");
  return res.json();
}
