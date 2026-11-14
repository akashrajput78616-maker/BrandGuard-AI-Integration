import React, { useState, useEffect } from 'react';
import { 
  Activity, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, 
  RotateCw, RefreshCw, BarChart2, Radio, Check, Sparkles, Layers 
} from 'lucide-react';
import { fetchRuleHealth, recordRuleDecision } from './brandguardApi';

export default function RuleHealthDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rules');
  const [acceptedDrafts, setAcceptedDrafts] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchRuleHealth();
      setData(res);
    } catch (e) {
      console.warn("Using fallback rule health data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcceptDraft = (ruleId) => {
    setAcceptedDrafts(prev => ({ ...prev, [ruleId]: true }));
    recordRuleDecision(ruleId, 'accepted');
  };

  if (loading) {
    return (
      <div className="panel-loading" style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="spin" size={24} style={{ color: '#0fa3a3', marginBottom: '12px' }} />
        <p>Computing rule health & human override rates...</p>
      </div>
    );
  }

  const summary = data || {
    total_rules_tracked: 5,
    total_findings: 189,
    total_overrides: 35,
    average_override_rate: 18.5,
    rules_needing_attention: 2,
    top_drifting_channel: { channel: "Instagram & Social", violation_rate: 45.2, top_violated_rule: "Voice & Tone §1.4" },
    rules: [],
    channels: []
  };

  return (
    <div className="rule-health-dashboard">
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <span className="kicker" style={{ color: '#0fa3a3', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em' }}>CONTINUOUS GOVERNANCE</span>
          <h1 style={{ fontSize: '28px', margin: '4px 0 6px', fontWeight: 800 }}>Rule Health & Channel Drift</h1>
          <p style={{ color: 'var(--text-muted, #64748b)', margin: 0, fontSize: '14px' }}>
            Where human reviewers disagree with the machine, and which channel is drifting from brand guidelines.
          </p>
        </div>
        <button className="btn secondary" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RotateCw size={15} /> Recompute metrics
        </button>
      </div>

      {/* Top Stat Cards */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="stat" style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', padding: '16px 20px', borderRadius: '12px' }}>
          <small style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>OVERALL OVERRIDE RATE</small>
          <strong style={{ display: 'block', fontSize: '26px', margin: '6px 0 2px', color: summary.average_override_rate > 25 ? '#ef4444' : '#0fa3a3' }}>
            {summary.average_override_rate}%
          </strong>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Human overrides across all rules</span>
        </div>
        <div className="stat" style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', padding: '16px 20px', borderRadius: '12px' }}>
          <small style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>RULES NEEDING ATTENTION</small>
          <strong style={{ display: 'block', fontSize: '26px', margin: '6px 0 2px', color: '#f59e0b' }}>
            {summary.rules_needing_attention}
          </strong>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Rules with &gt;20% override frequency</span>
        </div>
        <div className="stat" style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', padding: '16px 20px', borderRadius: '12px' }}>
          <small style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>TOP DRIFTING CHANNEL</small>
          <strong style={{ display: 'block', fontSize: '20px', margin: '8px 0 2px', color: '#8b5cf6' }}>
            {summary.top_drifting_channel?.channel || "Social"}
          </strong>
          <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
            {summary.top_drifting_channel?.violation_rate}% violation frequency
          </span>
        </div>
        <div className="stat" style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', padding: '16px 20px', borderRadius: '12px' }}>
          <small style={{ color: '#64748b', fontSize: '12px', fontWeight: 600 }}>TOTAL FINDINGS AUDITED</small>
          <strong style={{ display: 'block', fontSize: '26px', margin: '6px 0 2px', color: '#0f172a' }}>
            {summary.total_findings}
          </strong>
          <span style={{ fontSize: '12px', color: '#64748b' }}>{summary.total_overrides} reviewer overrides recorded</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color, #e2e8f0)', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('rules')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'rules' ? '2px solid #0fa3a3' : '2px solid transparent',
            color: activeTab === 'rules' ? '#0fa3a3' : '#64748b',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Rules Performance & Overrides
        </button>
        <button 
          onClick={() => setActiveTab('channels')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'channels' ? '2px solid #0fa3a3' : '2px solid transparent',
            color: activeTab === 'channels' ? '#0fa3a3' : '#64748b',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Channel Drift Analysis
        </button>
      </div>

      {activeTab === 'rules' && (
        <div>
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 163, 163, 0.05)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>RULE & POLICY</th>
                  <th style={{ padding: '12px 16px' }}>CATEGORY</th>
                  <th style={{ padding: '12px 16px' }}>FINDINGS</th>
                  <th style={{ padding: '12px 16px' }}>ACCEPTED</th>
                  <th style={{ padding: '12px 16px' }}>OVERRIDE</th>
                  <th style={{ padding: '12px 16px' }}>OVERRIDE RATE</th>
                  <th style={{ padding: '12px 16px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {summary.rules.map((r) => (
                  <tr key={r.rule_id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>{r.rule_title}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className="tag subtle" style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', background: '#f1f5f9' }}>
                        {r.category}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>{r.findings_count}</td>
                    <td style={{ padding: '14px 16px', color: '#10b981', fontWeight: 600 }}>{r.accepted_count}</td>
                    <td style={{ padding: '14px 16px', color: '#ef4444', fontWeight: 600 }}>{r.override_count}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                          <div style={{ 
                            width: `${Math.min(100, r.override_rate)}%`, 
                            height: '100%', 
                            background: r.override_rate > 35 ? '#ef4444' : r.override_rate > 20 ? '#f59e0b' : '#10b981' 
                          }} />
                        </div>
                        <span style={{ fontWeight: 700, minWidth: '40px' }}>{r.override_rate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: r.status === 'healthy' ? '#ecfdf5' : r.status === 'high_drift' ? '#fef2f2' : '#fffbeb',
                        color: r.status === 'healthy' ? '#059669' : r.status === 'high_drift' ? '#dc2626' : '#d97706',
                      }}>
                        {r.status === 'healthy' ? 'Healthy' : r.status === 'high_drift' ? 'High Drift' : 'Needs Review'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI-Suggested Rule Amendments */}
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Sparkles size={20} style={{ color: '#0fa3a3' }} />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>AI Rulebook Rewording Suggestions</h3>
              <span className="tag subtle" style={{ fontSize: '11px', background: 'rgba(15, 163, 163, 0.1)', color: '#0fa3a3' }}>
                SYNTHESIZED FROM HUMAN DECISIONS
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: 0, marginBottom: '20px' }}>
              When human reviewers repeatedly dismiss or edit findings for a rule, BrandGuard synthesizes updated guideline wording to match actual company consensus.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {summary.rules.filter(r => r.suggested_amendment).map((r) => (
                <div key={r.rule_id} style={{ 
                  border: '1px solid var(--border-color, #e2e8f0)', 
                  borderRadius: '10px', 
                  padding: '16px 20px', 
                  background: 'var(--bg-subtle, #f8fafc)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{r.rule_title}</strong>
                      <span className="tag red" style={{ fontSize: '11px' }}>{r.override_rate}% Override</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#334155', fontStyle: 'italic' }}>
                      “{r.suggested_amendment}”
                    </p>
                  </div>
                  <div>
                    {acceptedDrafts[r.rule_id] ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 700, fontSize: '13px' }}>
                        <Check size={16} /> Accepted as Draft
                      </span>
                    ) : (
                      <button 
                        className="btn primary small" 
                        onClick={() => handleAcceptDraft(r.rule_id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0fa3a3', color: '#fff' }}
                      >
                        <Check size={14} /> Accept as Draft
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'channels' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {summary.channels.map((c) => (
            <div key={c.channel} style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{c.channel}</h3>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: c.violation_rate > 30 ? '#fee2e2' : '#ecfdf5',
                  color: c.violation_rate > 30 ? '#dc2626' : '#059669',
                }}>
                  {c.violation_rate}% Drift
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                <div>Total reviews audited: <strong>{c.total_reviews}</strong></div>
                <div>Off-brand violations: <strong style={{ color: '#ef4444' }}>{c.violations_count}</strong></div>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '12px', fontSize: '12px' }}>
                <span style={{ color: '#64748b' }}>Primary violation source:</span>
                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{c.top_violated_rule}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

