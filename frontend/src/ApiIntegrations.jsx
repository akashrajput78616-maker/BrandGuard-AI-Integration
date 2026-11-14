import React, { useState, useEffect } from 'react';
import { 
  Key, Code, FileText, Send, CheckCircle2, Copy, Trash2, 
  Plus, ExternalLink, ShieldCheck, RefreshCw, AlertCircle 
} from 'lucide-react';
import { fetchApiKeys, createApiKey, revokeApiKey, fetchWebhookDeliveries } from './brandguardApi';

export default function ApiIntegrations() {
  const [keys, setKeys] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState('creator');
  const [createdKeySecret, setCreatedKeySecret] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kRes, dRes] = await Promise.all([
        fetchApiKeys().catch(() => ({ keys: [] })),
        fetchWebhookDeliveries().catch(() => ({ deliveries: [] })),
      ]);
      setKeys(kRes.keys || []);
      setDeliveries(dRes.deliveries || []);
    } catch (err) {
      console.warn("Using fallback integration data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const res = await createApiKey(newKeyName, newKeyScope);
      setCreatedKeySecret(res.secret);
      setNewKeyName('');
      loadData();
    } catch (err) {
      alert("Failed to create key: " + err.message);
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm("Are you sure you want to revoke this API key?")) return;
    try {
      await revokeApiKey(id);
      loadData();
    } catch (err) {
      alert("Failed to revoke: " + err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="api-integrations-page">
      <div className="page-heading" style={{ marginBottom: '24px' }}>
        <span className="kicker" style={{ color: '#0fa3a3', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em' }}>PROGRAMMATIC GOVERNANCE</span>
        <h1 style={{ fontSize: '28px', margin: '4px 0 6px', fontWeight: 800 }}>API, Google Docs & Webhooks</h1>
        <p style={{ color: 'var(--text-muted, #64748b)', margin: 0, fontSize: '14px' }}>
          Integrate BrandGuard directly into copywriter tools, CI/CD pipelines, Google Docs, and signed enterprise webhooks.
        </p>
      </div>

      {/* Secret Banner on creation */}
      {createdKeySecret && (
        <div style={{ 
          background: '#ecfdf5', 
          border: '1px solid #10b981', 
          borderRadius: '12px', 
          padding: '18px 20px', 
          marginBottom: '28px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', fontWeight: 700, marginBottom: '6px' }}>
            <CheckCircle2 size={18} /> API Key Generated Successfully
          </div>
          <p style={{ color: '#334155', fontSize: '13px', margin: '0 0 10px' }}>
            Copy your secret key now. <strong>You will not be able to see it again!</strong>
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <code style={{ 
              background: '#fff', 
              border: '1px solid #cbd5e1', 
              padding: '8px 12px', 
              borderRadius: '6px', 
              fontFamily: 'monospace', 
              fontSize: '13px',
              flex: 1 
            }}>
              {createdKeySecret}
            </code>
            <button 
              className="btn primary small" 
              onClick={() => copyToClipboard(createdKeySecret)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0fa3a3' }}
            >
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Secret"}
            </button>
            <button className="btn secondary small" onClick={() => setCreatedKeySecret(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Google Docs Add-on Card */}
      <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={22} style={{ color: '#0fa3a3' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Google Docs Sidebar Add-on</h3>
              <small style={{ color: '#64748b' }}>Check brand tone, claims, and terminology directly inside Google Docs as you write</small>
            </div>
          </div>
          <span className="tag subtle" style={{ background: '#e0f2fe', color: '#0284c7', fontWeight: 700 }}>APPS SCRIPT</span>
        </div>
        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, marginBottom: '16px' }}>
          Connect BrandGuard to your team's Google Workspace documents. Writers can highlight paragraphs and receive immediate grounded citations from your central brand guidelines without switching browser tabs.
        </p>
        <div style={{ background: '#0f172a', borderRadius: '8px', padding: '14px', color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto', marginBottom: '14px' }}>
          <code>
            {`// Google Apps Script Snippet (Extensions > Apps Script)
function checkBrandCompliance() {
  var doc = DocumentApp.getActiveDocument();
  var text = doc.getSelection() ? doc.getSelection().getRangeElements()[0].getElement().asText().getText() : doc.getBody().getText();
  
  var response = UrlFetchApp.fetch("https://brandguard-api-np6g.onrender.com/api/review", {
    method: "POST",
    contentType: "application/json",
    headers: { "X-BrandGuard-Key": "YOUR_API_KEY_HERE" },
    payload: JSON.stringify({ content: text, brand_name: "Acme CloudSync" })
  });
  
  Logger.log(response.getContentText());
}`}
          </code>
        </div>
      </div>

      {/* API Keys Table */}
      <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Active Programmatic API Keys</h3>
            <small style={{ color: '#64748b' }}>Scoped tokens for server-to-server workflows and automated publication gates</small>
          </div>
        </div>

        <form onSubmit={handleCreateKey} style={{ padding: '16px 20px', background: 'var(--bg-subtle, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Key name (e.g. CI/CD GitHub Linter)" 
            value={newKeyName} 
            onChange={(e) => setNewKeyName(e.target.value)} 
            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          />
          <select 
            value={newKeyScope} 
            onChange={(e) => setNewKeyScope(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          >
            <option value="creator">Scope: Creator (Submit & Review)</option>
            <option value="reviewer">Scope: Reviewer (Accept & Comment)</option>
            <option value="approver">Scope: Approver (Sign & Approve)</option>
            <option value="admin">Scope: Admin (Full Access)</option>
          </select>
          <button type="submit" className="btn primary small" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0fa3a3' }}>
            <Plus size={15} /> Create Key
          </button>
        </form>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 163, 163, 0.05)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: '#475569' }}>
              <th style={{ padding: '12px 16px' }}>NAME</th>
              <th style={{ padding: '12px 16px' }}>KEY PREFIX</th>
              <th style={{ padding: '12px 16px' }}>SCOPE</th>
              <th style={{ padding: '12px 16px' }}>CREATED</th>
              <th style={{ padding: '12px 16px' }}>STATUS</th>
              <th style={{ padding: '12px 16px' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600 }}>{k.name}</td>
                <td style={{ padding: '14px 16px' }}>
                  <code style={{ fontSize: '12px', color: '#64748b' }}>{k.prefix}</code>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span className="tag subtle" style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', textTransform: 'uppercase' }}>
                    {k.scope}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', color: '#64748b' }}>
                  {new Date(k.created_at * 1000).toLocaleDateString()}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: k.revoked ? '#fee2e2' : '#ecfdf5',
                    color: k.revoked ? '#dc2626' : '#059669',
                  }}>
                    {k.revoked ? "Revoked" : "Active"}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  {!k.revoked && (
                    <button 
                      className="text-button" 
                      onClick={() => handleRevoke(k.id)}
                      style={{ color: '#ef4444', fontSize: '12px' }}
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Webhook Deliveries Table */}
      <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>HMAC-SHA256 Signed Webhook Deliveries</h3>
            <small style={{ color: '#64748b' }}>Outbound notification attempts to Slack, Teams, and custom publisher endpoints</small>
          </div>
          <span className="tag subtle" style={{ fontSize: '11px' }}>ALGORITHM: HMAC-SHA256</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 163, 163, 0.05)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: '#475569' }}>
              <th style={{ padding: '10px 16px' }}>EVENT</th>
              <th style={{ padding: '10px 16px' }}>ENDPOINT</th>
              <th style={{ padding: '10px 16px' }}>SIGNATURE HEADER</th>
              <th style={{ padding: '10px 16px' }}>RESPONSE</th>
              <th style={{ padding: '10px 16px' }}>LATENCY</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.event}</td>
                <td style={{ padding: '12px 16px', color: '#64748b', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.endpoint}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <code style={{ fontSize: '11px', color: '#0fa3a3' }}>{d.signature_header}</code>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: d.status_code === 200 ? '#ecfdf5' : '#fee2e2',
                    color: d.status_code === 200 ? '#059669' : '#dc2626',
                  }}>
                    HTTP {d.status_code}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>{d.latency_ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
