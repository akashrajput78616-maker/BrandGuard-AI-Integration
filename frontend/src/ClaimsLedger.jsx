import React, { useState, useEffect } from 'react';
import { 
  FileCheck2, ShieldAlert, AlertTriangle, Plus, Trash2, 
  Calendar, BookOpen, CheckCircle2, RotateCw, RefreshCw 
} from 'lucide-react';
import { fetchClaims, createClaim, deleteClaim } from './brandguardApi';

export default function ClaimsLedger({ role = 'Admin' }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [claimText, setClaimText] = useState('');
  const [category, setCategory] = useState('Performance');
  const [evidence, setEvidence] = useState('');
  const [sourceDoc, setSourceDoc] = useState('Brand Guidelines v3.2');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDays, setExpiryDays] = useState(180);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchClaims();
      setClaims(res.claims || []);
    } catch (err) {
      console.warn("Using fallback claims", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!claimText.trim()) return;
    try {
      const expires_at = hasExpiry ? (Date.now() / 1000 + expiryDays * 86400) : null;
      await createClaim({
        text: claimText,
        category,
        evidence,
        source_document: sourceDoc,
        expires_at,
      });
      setShowAddModal(false);
      setClaimText('');
      setEvidence('');
      loadData();
    } catch (err) {
      alert("Failed to create claim: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to remove this substantiated claim?")) return;
    try {
      await deleteClaim(id);
      loadData();
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '30px', textAlign: 'center' }}>
        <RefreshCw className="spin" size={20} style={{ color: '#0fa3a3' }} />
        <p style={{ fontSize: '13px', color: '#64748b' }}>Loading verified claims ledger...</p>
      </div>
    );
  }

  const isAdmin = role === 'Admin' || role === 'Brand Admin' || role === 'Manager';

  return (
    <div className="claims-ledger-section" style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Substantiated Claims Ledger</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Time-sensitive promotional claims, third-party benchmark citations, and validity expiration windows.
          </p>
        </div>
        {isAdmin && (
          <button 
            className="btn primary small" 
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0fa3a3', color: '#fff' }}
          >
            <Plus size={15} /> Add Claim
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {claims.map((c) => (
          <div 
            key={c.id} 
            style={{ 
              background: 'var(--card-bg, #fff)', 
              border: `1px solid ${c.is_expired ? '#fecaca' : 'var(--border-color, #e2e8f0)'}`, 
              borderRadius: '12px', 
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              boxShadow: c.is_expired ? '0 2px 8px rgba(239, 68, 68, 0.05)' : 'none'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span className="tag subtle" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                  {c.category}
                </span>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: c.is_expired ? '#fee2e2' : '#ecfdf5',
                  color: c.is_expired ? '#dc2626' : '#059669',
                }}>
                  {c.is_expired ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  {c.is_expired ? 'EXPIRED CLAIM' : 'ACTIVE / VALID'}
                </span>
              </div>

              <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: '0 0 12px', lineHeight: 1.5 }}>
                “{c.text}”
              </p>

              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <BookOpen size={13} style={{ color: '#0fa3a3' }} />
                  <strong>Evidence:</strong> {c.evidence}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} />
                  <span>
                    {c.expires_at 
                      ? `Valid until: ${new Date(c.expires_at * 1000).toLocaleDateString()}` 
                      : 'No expiration date'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '10px', marginTop: '12px' }}>
              <small style={{ color: '#94a3b8', fontSize: '11px' }}>Source: {c.source_document}</small>
              {isAdmin && (
                <button 
                  className="text-button" 
                  onClick={() => handleDelete(c.id)}
                  style={{ color: '#ef4444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Claim Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-heading">
              <h2>Add Substantiated Claim</h2>
              <button className="iconbtn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <label className="field-label">
                Approved Promotional Claim Text
                <textarea 
                  required 
                  value={claimText} 
                  onChange={(e) => setClaimText(e.target.value)} 
                  placeholder="e.g. Acme CloudSync supports continuous version history and AES-256 client-side encryption."
                />
              </label>
              <label className="field-label">
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Performance">Performance & Speed</option>
                  <option value="Security">Security & Encryption</option>
                  <option value="Reliability">Reliability & Uptime</option>
                  <option value="Compliance">Compliance & Certifications</option>
                </select>
              </label>
              <label className="field-label">
                Substantiation Evidence
                <input 
                  required 
                  value={evidence} 
                  onChange={(e) => setEvidence(e.target.value)} 
                  placeholder="e.g. ISO 27001 Audit Report §4.2 / TechBenchmarks 2026 Test"
                />
              </label>
              <label className="field-label">
                Source Document
                <input 
                  value={sourceDoc} 
                  onChange={(e) => setSourceDoc(e.target.value)} 
                  placeholder="e.g. Security Whitepaper 2026"
                />
              </label>
              <div style={{ marginTop: '10px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
                  Set claim validity expiration window (e.g. annual re-certification)
                </label>
                {hasExpiry && (
                  <div style={{ marginTop: '8px', paddingLeft: '24px' }}>
                    <label className="field-label" style={{ fontSize: '12px' }}>
                      Validity duration:
                      <select value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))}>
                        <option value={30}>30 Days (Short-term campaign)</option>
                        <option value={90}>90 Days (Quarterly benchmark)</option>
                        <option value={180}>180 Days (Half-year cert)</option>
                        <option value={365}>365 Days (Annual audit)</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
              <button type="submit" className="btn primary" style={{ width: '100%', background: '#0fa3a3' }}>
                Register Claim in Ledger
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
