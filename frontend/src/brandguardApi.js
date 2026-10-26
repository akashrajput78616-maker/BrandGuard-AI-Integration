const isBrowser = typeof window !== "undefined";
const isLocal = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// 1. Resolve HTTP REST API Base URL
export const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BRANDGUARD_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (isLocal ? "http://127.0.0.1:8000" : "")
).replace(/\/$/, "");

// 2. Resolve WebSocket Base URL
export function getWebSocketUrl(path = "") {
  // If explicitly specified in env
  const rawWs = import.meta.env.VITE_WS_URL;
  if (rawWs) {
    const base = rawWs.replace(/\/$/, "");
    return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
  }

  // Derive from API_BASE if available
  if (API_BASE) {
    const wsBase = API_BASE.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    return path.startsWith("/") ? `${wsBase}${path}` : `${wsBase}/${path}`;
  }

  // Fallback to current browser host
  const wsProto = isBrowser && window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost = isLocal ? "127.0.0.1:8000" : (isBrowser ? window.location.host : "localhost:8000");
  return `${wsProto}//${wsHost}${path.startsWith("/") ? path : `/${path}`}`;
}

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
    credentials: "include",
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
  const res = await fetch(`${API_BASE}/api/documents?tenant_id=${tenantId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function searchGuidelineChunks(query, tenantId = "default-tenant", topK = 4) {
  const res = await fetch(
    `${API_BASE}/api/rag/search?query=${encodeURIComponent(query)}&tenant_id=${tenantId}&top_k=${topK}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Search query failed");
  return res.json();
}
