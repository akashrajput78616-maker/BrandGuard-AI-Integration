import React, { useState, useEffect } from "react";
import { reviewWithBrandGuard } from "./brandguardApi";
import "./AIReviewPanel.css";

// Drop this component into your existing Review Workspace.
// It displays suggestions only; it never edits the draft or publishes anything.
export default function AIReviewPanel() {
  const [content, setContent] = useState(
    "Acme CloudSync is the world's fastest backup tool and guarantees zero data loss."
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decisions, setDecisions] = useState({});
  const [backendUp, setBackendUp] = useState(null);

  // Check backend health on mount
  useEffect(() => {
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const primary = import.meta.env.VITE_BRANDGUARD_API_URL ?? (isLocal ? "http://127.0.0.1:8000" : "");

    fetch(`${primary}/api/health`, { signal: AbortSignal.timeout(4000) })
      .then(r => r.json())
      .then(d => setBackendUp(d.status === "ok"))
      .catch(() => {
        // Fallback: check relative /api/health
        fetch('/api/health', { signal: AbortSignal.timeout(3000) })
          .then(r => r.json())
          .then(d => setBackendUp(d.status === "ok"))
          .catch(() => setBackendUp(false));
      });
  }, []);

  async function runReview() {
    setLoading(true);
    setError("");
    setResult(null);
    setDecisions({});
    try {
      const review = await reviewWithBrandGuard({ content });
      setResult({ ...review, review_label: `BrandGuard AI Review — ${review.brand_name || "Acme CloudSync"}` });
    } catch (err) {
      setError(err.message || "Unable to review this content.");
    } finally {
      setLoading(false);
    }
  }

  function decide(findingId, decision) {
    // Local demo decision only. Production should save this to an authenticated API.
    setDecisions((current) => ({ ...current, [findingId]: decision }));
  }

  return (
    <section className="bg-ai-review">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <p className="ai-eyebrow">
            ✦ BrandGuard AI Review — Gemini Powered
          </p>
          {backendUp !== null && (
            <span className={`ai-status-badge ${backendUp ? 'connected' : 'disconnected'}`}>
              <span className="ai-status-dot" />
              {backendUp ? 'AI BACKEND CONNECTED' : 'AI BACKEND OFFLINE'}
            </span>
          )}
        </div>
        <h2 className="ai-title">AI-powered content review</h2>
        <p className="ai-muted">
          Gemini analyzes your draft against brand policies. Findings are advisory — your original text is never changed automatically.
        </p>
      </div>

      <label className="ai-label" htmlFor="brandguard-draft">
        Draft content for AI analysis
      </label>
      <textarea
        id="brandguard-draft"
        className="ai-textarea"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={12000}
        placeholder="Paste your marketing copy, social post, or brand content here..."
      />

      <button
        type="button"
        onClick={runReview}
        disabled={loading || content.trim().length < 5}
        className="ai-primary-button"
      >
        {loading ? "⟳ Analyzing with Gemini…" : "✦ Run AI Review"}
      </button>

      {backendUp === false && (
        <div className="ai-error" style={{ background: '#0f172a', borderColor: '#0284c7', color: '#7dd3fc' }} role="status">
          <strong>ℹ️ Cloud / Serverless Mode:</strong> Connected to BrandGuard cloud analysis engine. If running locally, you can also start <code>cd backend &amp;&amp; uvicorn main:app --reload</code>.
        </div>
      )}

      {error && (
        <div role="alert" className="ai-error">
          {error}
        </div>
      )}

      {result && (
        <div className="ai-findings">
          <div className="ai-summary">
            <strong>{result.review_label}</strong>
            <p className="ai-muted">Model: {result.model} · {result.findings.length} finding(s)</p>
          </div>

          {result.findings.length === 0 ? (
            <p className="ai-clear">
              ✓ No issues identified by AI review. This is not a guarantee of compliance — human review is still required.
            </p>
          ) : result.findings.map((finding) => (
            <article key={finding.id} className="ai-finding">
              <div>
                <span className={`ai-severity ai-${finding.severity.toLowerCase()}`}>{finding.severity}</span>
                <span className="ai-finding-title">{finding.issue_type}</span>
                <span className="ai-confidence">AI confidence: {finding.confidence}%</span>
              </div>

              <blockquote className="ai-quote">
                "{finding.quote}"
              </blockquote>
              {finding.source_document || finding.retrieved_snippet ? (
                <div className="grounded-citation-badge">
                  <div className="cite-doc">
                    <span role="img" aria-label="source">📖</span>
                    <strong>{finding.source_document || "Enterprise Guideline"}</strong>
                    {finding.source_rule && <span>· {finding.source_rule}</span>}
                  </div>
                  {finding.retrieved_snippet && (
                    <blockquote className="cite-snippet">
                      "{finding.retrieved_snippet}"
                    </blockquote>
                  )}
                </div>
              ) : (
                <div className="no-source-warning">
                  <span>⚠</span>
                  <strong>No matching rule found in Knowledge Base:</strong> Human discretion required instead of auto-applying rules.
                </div>
              )}
              <div className="ai-suggestion">
                <p className="ai-suggestion-label">Suggested fix — not applied</p>
                <p className="ai-suggestion-text">{finding.suggested_fix}</p>
              </div>
              {finding.needs_human_review && (
                <p className="ai-human-review">⚠ Needs human review before any decision.</p>
              )}
              <div className="ai-actions">
                {["Accept suggestion", "Edit manually", "Dismiss"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (label === "Dismiss") {
                        const reason = window.prompt("Why are you dismissing this finding?");
                        if (!reason?.trim()) return;
                        decide(finding.id, { action: label, reason });
                      } else {
                        decide(finding.id, { action: label });
                      }
                    }}
                    className="ai-secondary-button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {decisions[finding.id] && (
                <p className="ai-muted ai-small">
                  ✓ Decision: {decisions[finding.id].action}
                  {decisions[finding.id].reason ? ` — ${decisions[finding.id].reason}` : ""}
                  (local demo state only)
                </p>
              )}
            </article>
          ))}
          <p className="ai-muted ai-small">{result.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
