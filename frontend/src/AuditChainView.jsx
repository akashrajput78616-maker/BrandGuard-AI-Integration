import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, History, RefreshCw, CheckCircle2, 
  AlertTriangle, Link, Hash, User, Calendar, ExternalLink 
} from 'lucide-react';
import { fetchAuditLogs, verifyAuditChain } from './brandguardApi';

export default function AuditChainView() {
  const [logs, setLogs] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs(50);
      setLogs(res.audit_logs || []);
    } catch (err) {
      console.warn("Using fallback audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await verifyAuditChain();
      setVerification(res);
    } catch (err) {
      setVerification({
        valid: false,
        message: "Failed to execute chain verification: " + err.message,
      });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="spin" size={24} style={{ color: '#0fa3a3', marginBottom: '12px' }} />
        <p>Loading cryptographic audit chain...</p>
      </div>
    );
  }

  return (
    <div className="audit-chain-view">
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <span className="kicker" style={{ color: '#0fa3a3', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em' }}>APPEND-ONLY PROOF OF INTEGRITY</span>
          <h1 style={{ fontSize: '28px', margin: '4px 0 6px', fontWeight: 800 }}>Cryptographic Audit Chain</h1>
          <p style={{ color: 'var(--text-muted, #64748b)', margin: 0, fontSize: '14px' }}>
            Every action, edit, role switch, and approval is sealed with parent-linked SHA-256 hash digests.
          </p>
        </div>
        <button 
          className="btn primary" 
          onClick={handleVerifyChain} 
          disabled={verifying}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0fa3a3', color: '#fff' }}
        >
          {verifying ? <RefreshCw className="spin" size={16} /> : <ShieldCheck size={16} />}
          {verifying ? "Verifying Hash Chain..." : "Run Chain Verification"}
        </button>
      </div>

      {/* Verification Results Banner */}
      {verification && (
        <div style={{ 
          background: verification.valid ? '#ecfdf5' : '#fef2f2', 
          border: `1px solid ${verification.valid ? '#10b981' : '#ef4444'}`, 
          borderRadius: '12px', 
          padding: '18px 20px', 
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {verification.valid ? (
              <CheckCircle2 size={32} style={{ color: '#10b981' }} />
            ) : (
              <ShieldAlert size={32} style={{ color: '#ef4444' }} />
            )}
            <div>
              <strong style={{ fontSize: '15px', color: verification.valid ? '#065f46' : '#991b1b' }}>
                {verification.valid ? "Cryptographic Chain Verified — 0 Broken Links" : "Tampering / Chain Break Detected!"}
              </strong>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>
                {verification.message} · Head Hash: <code style={{ fontSize: '11px', background: '#fff', padding: '2px 6px', borderRadius: '4px' }}>{verification.head_hash?.slice(0, 16)}...</code>
              </div>
            </div>
          </div>
          <button className="text-button" onClick={() => setVerification(null)} style={{ fontSize: '12px' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Chain Table */}
      <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 163, 163, 0.05)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: '#475569' }}>
              <th style={{ padding: '12px 16px' }}>ACTION / EVENT</th>
              <th style={{ padding: '12px 16px' }}>ACTOR</th>
              <th style={{ padding: '12px 16px' }}>TIMESTAMP</th>
              <th style={{ padding: '12px 16px' }}>DETAILS</th>
              <th style={{ padding: '12px 16px' }}>SHA-256 HASH & LINKAGE</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((item, idx) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: item.action.includes('approved') ? '#10b981' : item.action.includes('reject') ? '#ef4444' : '#0fa3a3' 
                    }} />
                    <strong style={{ color: '#0f172a' }}>{item.action}</strong>
                  </div>
                  <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>{item.resource_type}</small>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 600 }}>{item.user_name}</div>
                  <span className="tag subtle" style={{ fontSize: '10px' }}>{item.user_role}</span>
                </td>
                <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                  {new Date(item.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td style={{ padding: '14px 16px', color: '#334155', maxWidth: '240px', fontSize: '12px' }}>
                  {JSON.stringify(item.details)}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Hash size={12} style={{ color: '#0fa3a3' }} />
                      <code style={{ fontSize: '11px', color: '#0f172a', fontWeight: 600 }}>
                        {item.hash ? item.hash.slice(0, 16) + '...' : 'pending'}
                      </code>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Link size={11} style={{ color: '#94a3b8' }} />
                      <small style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        prev: {item.prev_hash ? item.prev_hash.slice(0, 12) + '...' : '000000000000...'}
                      </small>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

