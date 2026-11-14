import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ArrowRight, ArrowUpRight, Check, AlertTriangle, FileText,
  LayoutDashboard, BookOpen, ScanSearch, ChartNoAxesCombined, History, Settings,
  Sun, Moon, Menu, X, Upload, Plus, Search, CheckCircle2, MessageSquare, Lock,
  Eye, Users, ChevronRight, Download, RefreshCw, Sparkles, Shield, Info,
  Image as ImageIcon, Type, Palette, Accessibility, SlidersHorizontal, Clock,
  ExternalLink, Trash2, Award, Activity, Cpu, Key, FileCheck2, Zap, LogOut,
  Minus, FilePlus2, Layers, CheckCheck
} from 'lucide-react';

import './style.css';
import './submission.css';
import './rag.css';
import './collab.css';
import './vision.css';

import AIReviewPanel from './AIReviewPanel.jsx';
import KnowledgeBaseRAG from './KnowledgeBaseRAG.jsx';
import CollaborativeWorkspace from './CollaborativeWorkspace.jsx';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import VisualGovernanceStudio from './VisualGovernanceStudio.jsx';
import RuleHealthDashboard from './RuleHealthDashboard.jsx';
import ReliabilityDashboard from './ReliabilityDashboard.jsx';
import ApiIntegrations from './ApiIntegrations.jsx';
import ClaimsLedger from './ClaimsLedger.jsx';
import AuditChainView from './AuditChainView.jsx';
import PublicationReceiptModal from './PublicationReceiptModal.jsx';

// BrandGuard Logo
function BrandLogo({ compact = false }) {
  return (
    <div className="bs-logo">
      <span className="bs-logo-square">B</span>
      <span className="bs-logo-text">BrandGuard</span>
      {!compact && <span className="bs-logo-badge">R2</span>}
    </div>
  );
}

// Personas
const personas = [
  {
    role: 'creator',
    name: 'Maya Rao',
    title: 'Creator',
    line: 'Write the caption. Run the gate.',
    detail: 'Submits the Lumora launch caption, sees the fast lane as she types, and waits for the report.'
  },
  {
    role: 'reviewer',
    name: 'Dev Kapoor',
    title: 'Reviewer',
    line: 'Work the findings.',
    detail: 'Accepts, edits or rejects each finding with a reason. Can send the version back for revision.'
  },
  {
    role: 'approver',
    name: 'Ines Alvarez',
    title: 'Approver',
    line: 'Sign it off, or stop it.',
    detail: 'Approves or rejects. Claims findings can be escalated to Legal. Exports the review receipt.'
  },
  {
    role: 'admin',
    name: 'Ravi Shah',
    title: 'Admin',
    line: 'Own the rulebook.',
    detail: 'Compiles a guideline document into typed rules, edits the proposal and publishes it.'
  }
];

const sixIdeas = [
  {
    n: "01",
    title: "Brand Pack Compiler",
    body: "Guideline documents become typed rules with source excerpts. An admin reviews, edits and publishes. Nothing enters the rulebook by itself."
  },
  {
    n: "02",
    title: "Two-lane review",
    body: "Deterministic checks run in under a second. Five specialist reviewers read for judgment. Model calls only happen where reading is required."
  },
  {
    n: "03",
    title: "Evidence or silence",
    body: "A finding survives only if its quoted span is verbatim, its rule exists, and its guideline excerpt is from the rulebook. Low confidence goes to Needs human."
  },
  {
    n: "04",
    title: "Claim Ledger",
    body: "Approved claims carry an owner, evidence and expiry. Copy is labelled Supported, Unsupported, Expired or Contradicts, and the nearest approved wording is proposed."
  },
  {
    n: "05",
    title: "Human decisions",
    body: "Accept, edit or reject per finding, with comments and a reason on rejection. Fixes are tracked diffs with an intent-preservation score. Nothing auto-applies."
  },
  {
    n: "06",
    title: "Receipt and audit",
    body: "Every decision is hash-chained. An approver signs off and exports a receipt with the version hash, findings, models used and the AI disclosure statement."
  }
];

const initialRules = [
  { id: 'R-TERM-01', title: 'Terminology & messaging · R-TERM-01', category: 'terminology', body: 'Always write the full product name “Lumora Glow Serum” on first mention.' },
  { id: 'R-CLM-03', title: 'Claims Policy · R-CLM-03', category: 'claims', body: 'Clinical superiority and speed claims require an approved trial registry and citation.' },
  { id: 'R-TONE-02', title: 'Voice & Tone · R-TONE-02', category: 'tone', body: 'Avoid hyperbolic hype and sensational words like MIRACLE, LIFE-CHANGING, or UNBELIEVABLE.' },
  { id: 'R-A11Y-01', title: 'Accessibility Standard · R-A11Y-01', category: 'accessibility', body: 'All text overlays and informative graphics must maintain at least 4.5:1 contrast.' },
  { id: 'R-VIS-04', title: 'Visual & Palette · R-VIS-04', category: 'visual', body: 'Ensure brand palette compliance. Avoid deprecated hot-pink accents (#FF2E93).' }
];

const initialDrafts = [
  {
    id: 1,
    title: 'Lumora Glow Serum — Launch caption',
    channel: 'Instagram',
    version: '3',
    creatorName: 'Maya Rao',
    status: 'In review',
    updatedAt: '12m ago',
    findingCount: 4,
    legalFlag: true,
    content: "Glow Serum is here — and it's a MIRACLE for tired skin. Clinically proven to remove wrinkles in 7 days. Get yours before it sells out!!",
    alt: 'High-contrast product visual with serum bottle',
    type: 'text'
  },
  {
    id: 2,
    title: 'Email newsletter / Founder announcement',
    channel: 'Email',
    version: '1',
    creatorName: 'Maya Rao',
    status: 'Draft',
    updatedAt: '2h ago',
    findingCount: 2,
    legalFlag: false,
    content: "Lumora Glow Serum is crafted for radiant skin. Backed by organic cold-pressed botanicals.",
    alt: '',
    type: 'text'
  },
  {
    id: 3,
    title: 'Paid ad specimen / TikTok cut',
    channel: 'Paid Social',
    version: '2',
    creatorName: 'Maya Rao',
    status: 'Changes requested',
    updatedAt: 'Yesterday',
    findingCount: 3,
    legalFlag: false,
    content: "Our cloud storage thing is literally the best formula ever invented.",
    alt: '',
    type: 'text'
  }
];

function detectFindings(text) {
  const list = [];
  if (/Glow Serum/i.test(text) && !/Lumora Glow Serum/i.test(text)) {
    list.push({
      id: 'f-1',
      ruleId: 'R-TERM-01',
      type: 'Terminology & messaging · R-TERM-01',
      severity: 'Critical',
      phrase: 'Glow Serum',
      why: '“Glow Serum” drops the brand name. The rule requires the full product name on first mention.',
      excerpt: '“Always write the full product name ‘Lumora Glow Serum’ on first mention.”',
      fix: 'Lumora Glow Serum',
      confidence: 96,
      intentScore: 0.61,
      status: 'open'
    });
  }
  if (/MIRACLE/i.test(text)) {
    list.push({
      id: 'f-2',
      ruleId: 'R-TONE-02',
      type: 'Voice & Tone · R-TONE-02',
      severity: 'High',
      phrase: 'MIRACLE',
      why: 'Aggressive hype term contradicts Lumora’s grounded, clinical register.',
      excerpt: '“Avoid hyperbolic hype and sensational words like MIRACLE.”',
      fix: 'breakthrough',
      confidence: 94,
      intentScore: 0.82,
      status: 'open'
    });
  }
  if (/remove wrinkles in 7 days/i.test(text)) {
    list.push({
      id: 'f-3',
      ruleId: 'R-CLM-03',
      type: 'Claims Policy · R-CLM-03',
      severity: 'Critical',
      phrase: 'remove wrinkles in 7 days',
      why: 'Clinical timeframe claim not backed by active trial in Claim Ledger.',
      excerpt: '“Clinical superiority and speed claims require an approved trial registry and citation.”',
      fix: 'visibly smooth fine lines over time',
      confidence: 98,
      intentScore: 0.54,
      status: 'open'
    });
  }
  return list;
}

const pageNotes = {
  queue: { title: "Review queue", note: "Everything waiting on a human decision." },
  rulebook: { title: "Rulebook & Documents", note: "Published rules, claims ledger, and RAG guideline document ingestion." },
  rules: { title: "Drift & rule health", note: "Where reviewers disagree with the machine, and which channel is drifting." },
  api: { title: "API & webhooks", note: "Keys, signed events and the delivery log." },
  audit: { title: "Audit trail", note: "Append-only. Every row commits to the last." },
  reliability: { title: "Reliability", note: "Model calls, verifier counts and eval results." },
  visual: { title: "Visual Governance", note: "CIELAB color distance, palette enforcement and visual inspection." }
};

export default function App() {
  const [page, setPage] = useState('home');
  const [activeRole, setActiveRole] = useState('reviewer');
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selectedId, setSelectedId] = useState(1);
  const [queueFilter, setQueueFilter] = useState('all');
  const [receiptModal, setReceiptModal] = useState(null);

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace('#', '');
      if (['queue', 'rulebook', 'rules', 'audit', 'api', 'reliability', 'visual', 'review'].includes(h)) {
        setPage(h);
      } else if (h === 'ideas' || h === 'submit') {
        setPage('queue');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const currentPersona = personas.find(p => p.role === activeRole) || personas[1];
  const currentDraft = drafts.find(d => d.id === selectedId) || drafts[0];
  const findings = detectFindings(currentDraft.content);

  const go = (p) => {
    const target = p === 'submit' ? 'queue' : p;
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const switchRole = (r) => {
    setActiveRole(r);
  };

  const handleAcceptFinding = (f) => {
    const nextContent = currentDraft.content.replace(f.phrase, f.fix);
    setDrafts(prev => prev.map(d => d.id === currentDraft.id ? { ...d, content: nextContent, status: 'Changes requested' } : d));
  };

  const handleApproveDraft = () => {
    if (activeRole !== 'approver' && activeRole !== 'admin') {
      alert("Only an Approver or Admin seat can sign off on publication.");
      return;
    }
    setDrafts(prev => prev.map(d => d.id === currentDraft.id ? { ...d, status: 'Approved' } : d));
    setReceiptModal(currentDraft);
  };

  // ==========================================
  // 1. LANDING PAGE
  // ==========================================
  if (page === 'home') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
        {/* Header */}
        <header className="bs-header">
          <div className="bs-header-inner">
            <button onClick={() => go('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <BrandLogo />
            </button>
            <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
              <a href="#ideas" style={{ color: 'var(--muted-foreground)', textDecoration: 'none', fontSize: '12px' }}>The six ideas</a>
              <a href="#pipeline" style={{ color: 'var(--muted-foreground)', textDecoration: 'none', fontSize: '12px' }}>How it works</a>
              <a href="#evidence" style={{ color: 'var(--muted-foreground)', textDecoration: 'none', fontSize: '12px' }}>Evidence</a>
              <a href="#roles" style={{ color: 'var(--muted-foreground)', textDecoration: 'none', fontSize: '12px' }}>Demo roles</a>
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={() => go('queue')} style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                Workspace
              </button>
              <button onClick={() => go('demo')} className="bs-btn bs-btn-primary">
                Enter the demo <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bs-hero-section">
          <div className="bs-hero-grid">
            {/* Left Hero Column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '32px', height: '1px', background: 'var(--foreground)', opacity: 0.4 }} />
                <span className="label-caps">Round 2 prototype · Lumora demo workspace</span>
              </div>
              <h1 className="serif-display" style={{ fontSize: 'clamp(46px, 5.5vw, 76px)', margin: '24px 0 20px', letterSpacing: '-0.03em' }}>
                The brand gate<br />you can audit.
              </h1>
              <p style={{ fontSize: '15px', lineHeight: 1.75, color: 'var(--muted-foreground)', maxWidth: '480px', margin: '0 0 28px' }}>
                BrandGuard reviews content before it is published against a company's own guidelines. Findings arrive with evidence, a rule and a source excerpt. A human accepts, edits or rejects each one, and the decision trail is hash-chained.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => go('demo')} className="bs-btn bs-btn-primary" style={{ padding: '12px 22px' }}>
                  Try the Lumora demo <ArrowRight size={16} />
                </button>
                <a href="#pipeline" className="bs-btn bs-btn-outline" style={{ padding: '12px 22px' }}>
                  See the pipeline
                </a>
              </div>
              <p style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted-foreground)' }}>
                No signup · one-click roles · synthetic brand, seeded data
              </p>
              <div className="bs-stat-grid">
                <div className="bs-stat-cell">
                  <p>14</p>
                  <p>typed rules</p>
                </div>
                <div className="bs-stat-cell">
                  <p>6</p>
                  <p>ledger claims</p>
                </div>
                <div className="bs-stat-cell">
                  <p>05</p>
                  <p>specialist reviewers</p>
                </div>
              </div>
            </div>

            {/* Right Hero Column: Specimen Card */}
            <div>
              <div className="bs-specimen-card">
                <div className="bs-specimen-header">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--muted-foreground)' }}>
                    Specimen · Instagram caption · v3
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: '#8F4526' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A9552F' }} />
                    4 findings
                  </span>
                </div>
                <div className="bs-specimen-body">
                  <p className="font-serif" style={{ fontSize: '24px', lineHeight: 1.4, margin: 0 }}>
                    <span className="finding-mark-critical">Glow Serum</span> is here — and it's a{" "}
                    <span className="finding-mark-critical">MIRACLE</span> for tired skin. Clinically proven to{" "}
                    <span className="finding-mark">remove wrinkles in 7 days</span>. Get yours before it sells out!!
                  </p>
                  <p style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted-foreground)' }}>
                    Caption colours: #FF2E93 on #F4EFE6 · <span className="finding-mark">1.9:1 contrast</span>
                  </p>
                </div>
                <div className="bs-specimen-finding">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="bs-tag bs-tag-red">Critical</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                      Terminology & messaging · R-TERM-01
                    </span>
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#4F5C47' }}>
                      <Check size={12} /> evidence verified
                    </span>
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: '12.5px', lineHeight: 1.6 }}>
                    “Glow Serum” drops the brand name. The rule requires the full product name on first mention.
                  </p>
                  <div style={{ marginTop: '12px', borderLeft: '2px solid var(--border)', paddingLeft: '12px' }}>
                    <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Guideline · Edition 4</p>
                    <p style={{ margin: '4px 0 0', fontSize: '11.5px', fontStyle: 'italic', color: 'var(--muted-foreground)' }}>
                      “Always write the full product name ‘Lumora Glow Serum’ on first mention.”
                    </p>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                    <span style={{ border: '1px solid var(--border)', padding: '1px 5px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--muted-foreground)' }}>FIX</span>
                    <span className="font-mono">
                      <span style={{ textDecoration: 'line-through', color: '#8F2F24' }}>Glow Serum</span>{" "}
                      <span style={{ color: '#4F5C47' }}>Lumora Glow Serum</span>
                    </span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--muted-foreground)' }}>intent 0.61</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', padding: '0 4px' }}>
                <p style={{ margin: 0, fontSize: '10px', color: 'var(--muted-foreground)' }}>
                  Every finding on the right carries the same six pieces of evidence.
                </p>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Fig. 01</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4 Pillars Strip */}
        <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <div className="bs-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)' }}>
            {[
              ["The gate", "Content cannot be approved while a critical finding is unresolved."],
              ["The evidence", "Verbatim spans, real rules, real quotes. Invented proof is dropped."],
              ["The human", "Creator submits. Reviewer decides. Approver signs. Legal can be raised."],
              ["The record", "Hash-chained audit and a PDF receipt for every approved version."]
            ].map(([s, r]) => (
              <div key={s} style={{ background: 'var(--background)', padding: '24px 20px' }}>
                <p className="label-caps" style={{ margin: '0 0 8px' }}>{s}</p>
                <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted-foreground)' }}>{r}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Problem Section */}
        <section className="bs-container" style={{ padding: '80px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '48px' }}>
            <div>
              <p className="label-caps">The problem</p>
              <h2 className="font-serif" style={{ fontSize: '38px', lineHeight: 1.15, margin: '12px 0 0' }}>
                Content ships faster than the brand can check it.
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '14.5px', lineHeight: 1.75, color: 'var(--muted-foreground)' }}>
              <p style={{ margin: 0 }}>
                A single unclaimed promise in a paid ad can cost a week of removal requests and verification. An old product name stays in the search index long after the campaign ends. Style guides do not enforce themselves at the moment of publishing, and the people writing the copy are not the people who own the rules.
              </p>
              <p style={{ margin: 0 }}>
                BrandGuard sits between the draft and the publish button. It does not replace the brand team. It gives them a smaller queue, each item with evidence they can check in seconds, and a record of what they decided.
              </p>
              <div style={{ borderLeft: '2px solid var(--foreground)', paddingLeft: '20px', fontFamily: 'var(--font-serif)', fontSize: '20px', lineHeight: 1.45, color: 'var(--foreground)' }}>
                “A finding that cannot show its evidence never reaches a human. That is the whole product.”
              </div>
            </div>
          </div>
        </section>

        {/* The Six Ideas */}
        <section id="ideas" style={{ borderTop: '1px solid var(--border)', padding: '80px 0' }}>
          <div className="bs-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
              <div>
                <p className="label-caps">Six ideas</p>
                <h2 className="font-serif" style={{ fontSize: '42px', margin: '12px 0 0' }}>What makes this different</h2>
              </div>
              <p style={{ maxWidth: '420px', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted-foreground)', margin: 0 }}>
                Each one exists in the running product. If it were not built, it would not be on this list.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
              {sixIdeas.map(s => (
                <div key={s.n} style={{ background: 'var(--card)', padding: '28px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted-foreground)' }}>{s.n}</span>
                    <span style={{ width: '24px', height: '1px', background: 'var(--border)' }} />
                  </div>
                  <h3 className="font-serif" style={{ fontSize: '22px', margin: '20px 0 10px' }}>{s.title}</h3>
                  <p style={{ fontSize: '12.5px', lineHeight: 1.65, color: 'var(--muted-foreground)', margin: 0 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline Section */}
        <section id="pipeline" style={{ borderTop: '1px solid var(--border)', background: 'var(--card)', padding: '80px 0' }}>
          <div className="bs-container">
            <p className="label-caps">The pipeline</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '12px 0 40px' }}>
              <h2 className="font-serif" style={{ fontSize: '42px', margin: 0 }}>Two lanes, one gate</h2>
              <p style={{ maxWidth: '440px', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--muted-foreground)', margin: 0 }}>
                The fast lane is deterministic and returns in milliseconds. The deep lane runs five reviewers in parallel, then a verifier that can only delete, never add.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1.05fr', gap: '16px', alignItems: 'center' }}>
              <div className="bs-card" style={{ padding: '24px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted-foreground)', margin: '0 0 8px' }}>
                  Lane 01 · deterministic · &lt; 1s
                </p>
                <h3 className="font-serif" style={{ fontSize: '24px', margin: '0 0 16px' }}>Fast lane</h3>
                <ul style={{ listStyle: 'none', padding: '16px 0 0', margin: 0, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {["Glossary and banned terms", "Product naming and casing", "WCAG contrast ratio", "Missing alt text", "Palette distance in CIELAB"].map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <Minus size={12} color="var(--muted-foreground)" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <ArrowRight size={18} color="var(--muted-foreground)" />
              <div className="bs-card" style={{ padding: '24px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted-foreground)', margin: '0 0 8px' }}>
                  Lane 02 · judgment · parallel
                </p>
                <h3 className="font-serif" style={{ fontSize: '24px', margin: '0 0 16px' }}>Deep lane</h3>
                <ul style={{ listStyle: 'none', padding: '16px 0 0', margin: 0, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {["Tone & voice", "Terminology & messaging", "Claims against the ledger", "Visual consistency", "Accessibility reading"].map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <Minus size={12} color="var(--muted-foreground)" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <ArrowRight size={18} color="var(--muted-foreground)" />
              <div className="bs-dark-card">
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(244, 239, 230, 0.6)', margin: '0 0 8px' }}>
                  Evidence gate
                </p>
                <h3 className="font-serif" style={{ fontSize: '24px', margin: '0 0 16px', color: '#f4efe6' }}>Verifier → Synthesizer</h3>
                <p style={{ borderTop: '1px solid rgba(244, 239, 230, 0.2)', paddingTop: '16px', fontSize: '12px', lineHeight: 1.7, color: 'rgba(244, 239, 230, 0.75)', margin: 0 }}>
                  Duplicates are merged, severity decides order, fixes get an intent score. Dropped findings are counted and shown, not hidden.
                </p>
                <button onClick={() => go('demo')} style={{ marginTop: '20px', background: 'none', border: 'none', borderBottom: '1px solid rgba(244, 239, 230, 0.4)', paddingBottom: '2px', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#f4efe6', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Run it on the sample <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Roles Section */}
        <section id="roles" style={{ borderTop: '1px solid var(--border)', padding: '80px 0' }}>
          <div className="bs-container">
            <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: '48px' }}>
              <div>
                <p className="label-caps">Judge access</p>
                <h2 className="font-serif" style={{ fontSize: '42px', margin: '12px 0 20px' }}>Four roles.<br />No signup.</h2>
                <p style={{ fontSize: '13.5px', lineHeight: 1.7, color: 'var(--muted-foreground)', maxWidth: '420px', margin: '0 0 24px' }}>
                  Enter as any Lumora persona with one click. The role switcher stays in the header, so you can submit as Creator, decide as Reviewer and sign off as Approver without changing accounts. Every switch is audited.
                </p>
                <button onClick={() => go('demo')} className="bs-btn bs-btn-primary">
                  Open the demo screen <ArrowRight size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
                {personas.map(p => (
                  <div key={p.role} onClick={() => { setActiveRole(p.role); go('queue'); }} style={{ background: 'var(--card)', padding: '24px', cursor: 'pointer', transition: 'background-color 0.15s ease' }}>
                    <p className="label-caps" style={{ margin: '0 0 8px' }}>{p.title}</p>
                    <p className="font-serif" style={{ fontSize: '20px', margin: '0 0 8px', color: 'var(--foreground)' }}>{p.name}</p>
                    <p style={{ fontSize: '11.5px', lineHeight: 1.6, color: 'var(--muted-foreground)', margin: 0 }}>{p.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 0' }}>
          <div className="bs-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BrandLogo compact={true} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Round 2 · October 2026</span>
            </div>
            <p style={{ fontSize: '10.5px', color: 'var(--muted-foreground)', maxWidth: '580px', margin: 0 }}>
              Lumora is a synthetic brand created for this prototype. All content, claims and studies are fictional. Model output is treated as a proposal; a human makes every decision.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // 2. DEMO ROLE PICKER SCREEN
  // ==========================================
  if (page === 'demo') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
        <header className="bs-header">
          <div className="bs-header-inner">
            <button onClick={() => go('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <BrandLogo />
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--muted-foreground)' }}>
              Demo access · no signup
            </span>
          </div>
        </header>

        <main className="bs-container" style={{ padding: '60px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '48px' }}>
            <div>
              <p className="label-caps">Lumora Studio · synthetic brand</p>
              <h1 className="serif-display" style={{ fontSize: '48px', margin: '16px 0 20px' }}>Choose a seat<br />at the gate.</h1>
              <p style={{ fontSize: '13.5px', lineHeight: 1.7, color: 'var(--muted-foreground)', maxWidth: '420px', margin: '0 0 24px' }}>
                One click signs you into the seeded Lumora workspace under a demo persona. Use the role switcher in the header to move between seats without signing up again.
              </p>
              <div className="bs-card" style={{ padding: '20px', background: 'rgba(251, 247, 241, 0.6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ShieldCheck size={16} color="#4F5C47" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.14em' }}>What is real here</span>
                </div>
                <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '11.5px', lineHeight: 1.8, color: 'var(--muted-foreground)' }}>
                  <li>The rulebook, claims ledger and guideline document are seeded.</li>
                  <li>Model calls are live. Findings are stored, not mocked.</li>
                  <li>Every role switch and decision is written to the audit chain.</li>
                  <li>Nothing is published anywhere. Approval only produces a receipt.</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
              {personas.map((p, i) => (
                <div
                  key={p.role}
                  onClick={() => { setActiveRole(p.role); go('queue'); }}
                  style={{ background: 'var(--card)', padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', minHeight: '210px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--muted-foreground)' }}>
                      0{i + 1} · {p.title}
                    </span>
                    <ArrowRight size={14} color="var(--muted-foreground)" />
                  </div>
                  <h2 className="font-serif" style={{ fontSize: '27px', margin: '20px 0 4px', color: 'var(--foreground)' }}>{p.name}</h2>
                  <p className="font-serif" style={{ fontSize: '15px', fontStyle: 'italic', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>{p.line}</p>
                  <p style={{ fontSize: '11.5px', lineHeight: 1.6, color: 'var(--muted-foreground)', margin: '0 0 16px' }}>{p.detail}</p>
                  <span style={{ marginTop: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--foreground)' }}>
                    Enter as {p.title.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================
  // 3. APP WORKSPACE (BrandGuard Layout)
  // ==========================================
  const currentNavTitle = pageNotes[page]?.title || "Workspace";
  const currentNavNote = pageNotes[page]?.note || "Brand governance, with evidence.";

  return (
    <div className="bs-app-layout">
      {/* Sidebar */}
      <aside className="bs-sidebar">
        <button onClick={() => go('home')} style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', textAlign: 'left' }}>
          <BrandLogo />
        </button>
        <p style={{ margin: '10px 0 28px', padding: '0 4px', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--muted-foreground)' }}>
          Lumora Studio · demo
        </p>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[
            { id: 'queue', label: 'Review queue', icon: LayoutDashboard, count: drafts.filter(d => d.status === 'In review').length },
            { id: 'rulebook', label: 'Rulebook & Documents', icon: BookOpen },
            { id: 'rules', label: 'Drift & rule health', icon: Activity },
            { id: 'audit', label: 'Audit trail', icon: History },
            { id: 'api', label: 'API & webhooks', icon: Key },
            { id: 'reliability', label: 'Reliability', icon: Cpu },
            { id: 'visual', label: 'Visual Studio', icon: Palette }
          ].map(item => {
            const Icon = item.icon;
            const isActive = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`bs-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={15} style={{ opacity: 0.7 }} />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted-foreground)' }}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Persona Box at Bottom */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="bs-card" style={{ padding: '14px' }}>
            <p className="label-caps" style={{ margin: '0 0 4px' }}>Signed in</p>
            <p className="font-serif" style={{ fontSize: '16px', margin: '0 0 2px' }}>{currentPersona.name}</p>
            <p style={{ fontSize: '11px', textTransform: 'capitalize', color: 'var(--muted-foreground)', margin: 0 }}>
              {currentPersona.title} · Lumora Studio
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted-foreground)' }}>
                14 rules · 6 claims
              </span>
              <button onClick={() => go('demo')} title="Switch seat" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
                <LogOut size={13} />
              </button>
            </div>
          </div>
          <p style={{ margin: 0, padding: '0 4px', fontSize: '10px', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
            Synthetic brand and seeded data. Nothing here is a real client.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="bs-main-content">
        {/* Topbar */}
        <header className="bs-topbar">
          <div>
            <p className="label-caps" style={{ margin: 0 }}>Lumora Studio</p>
            <h1 className="font-serif" style={{ fontSize: '22px', margin: '2px 0 0' }}>{currentNavTitle}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="label-caps" style={{ margin: 0 }}>Acting as</span>
              <select
                value={activeRole}
                onChange={(e) => switchRole(e.target.value)}
                style={{ height: '32px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', padding: '0 8px', fontSize: '12px', cursor: 'pointer' }}
              >
                {personas.map(p => (
                  <option key={p.role} value={p.role}>{p.title} ({p.name})</option>
                ))}
              </select>
            </div>

            <button onClick={() => go('rulebook')} className="bs-btn bs-btn-outline" style={{ height: '32px', padding: '0 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={13} /> Upload documents
            </button>
            <button onClick={() => { setSelectedId(1); go('review'); }} className="bs-btn bs-btn-primary" style={{ height: '32px', padding: '0 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={13} /> Review specimen
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main style={{ padding: '28px' }}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
            <p className="prose-note" style={{ margin: 0 }}>{currentNavNote}</p>
          </div>

          {/* TAB: REVIEW QUEUE (DASHBOARD) */}
          {page === 'queue' && (
            <div className="bs-queue-grid">
              {/* Left Column: Live Queue Table */}
              <div>
                <div className="bs-card">
                  <div className="bs-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <p className="label-caps" style={{ margin: 0 }}>Lumora Studio · live queue</p>
                      <h2 className="font-serif" style={{ fontSize: '30px', margin: '6px 0 4px' }}>The gate, this morning</h2>
                      <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0 }}>
                        Open a submission to work its findings. The whole loop runs on seeded Lumora data, with live model review.
                      </p>
                    </div>
                    <button onClick={() => { setSelectedId(1); go('review'); }} className="bs-btn bs-btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}>
                      <Eye size={14} /> Review specimen
                    </button>
                  </div>

                  {/* 4 KPIs */}
                  <div className="bs-kpi-grid">
                    <div className="bs-kpi-cell">
                      <p>{drafts.filter(d => d.status === 'In review').length}</p>
                      <p>Awaiting review</p>
                    </div>
                    <div className="bs-kpi-cell">
                      <p>{drafts.reduce((acc, d) => acc + d.findingCount, 0)}</p>
                      <p>Findings</p>
                    </div>
                    <div className="bs-kpi-cell">
                      <p>{drafts.filter(d => d.status === 'Changes requested').length}</p>
                      <p>Decided</p>
                    </div>
                    <div className="bs-kpi-cell">
                      <p>{drafts.filter(d => d.status === 'Approved').length}</p>
                      <p>Approved</p>
                    </div>
                  </div>

                  {/* Filter Sub-header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted-foreground)' }}>Submissions</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['all', 'open'].map(mode => (
                        <button
                          key={mode}
                          onClick={() => setQueueFilter(mode)}
                          style={{
                            padding: '4px 8px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            border: 'none',
                            cursor: 'pointer',
                            background: queueFilter === mode ? 'var(--foreground)' : 'transparent',
                            color: queueFilter === mode ? 'var(--background)' : 'var(--muted-foreground)'
                          }}
                        >
                          {mode === 'all' ? 'All' : 'Open'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submissions List */}
                  <div>
                    {drafts
                      .filter(d => queueFilter === 'all' ? true : d.status !== 'Approved')
                      .map(s => (
                        <div key={s.id} onClick={() => { setSelectedId(s.id); go('review'); }} className="bs-sub-row">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="font-serif" style={{ fontSize: '18px', color: 'var(--foreground)' }}>{s.title}</span>
                              {s.legalFlag && <span className="bs-tag bs-tag-red">Legal</span>}
                            </div>
                            <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: '9.5px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                              {s.channel} · v{s.version} · {s.creatorName} · {s.updatedAt}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <p className="font-serif" style={{ fontSize: '18px', margin: 0, lineHeight: 1 }}>{s.findingCount}</p>
                              <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>findings</p>
                            </div>
                            <span className={`bs-tag ${s.status === 'Approved' ? 'bs-tag-green' : s.status === 'In review' ? 'bs-tag-amber' : 'bs-tag-subtle'}`}>
                              {s.status}
                            </span>
                            <ArrowRight size={14} color="var(--muted-foreground)" />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* The Two Minute Path */}
                <div className="bs-card" style={{ marginTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted-foreground)' }}>The two-minute path</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Creator → Reviewer → Approver</span>
                  </div>
                  <div className="bs-path-grid">
                    {[
                      ["01", "Submit", "Load the Lumora caption. Fast lane flags issues immediately."],
                      ["02", "Review", "Specialist reviewers report. The verifier suppresses anything unsupported."],
                      ["03", "Decide", "Accept, edit or reject. Approve with the Approver role."],
                      ["04", "Receipt", "Export the PDF. Check the audit chain from the sidebar."]
                    ].map(([n, t, d]) => (
                      <div key={n} className="bs-path-cell">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--muted-foreground)' }}>{n}</span>
                        <h4 className="font-serif" style={{ fontSize: '17px', margin: '8px 0 4px' }}>{t}</h4>
                        <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.6, color: 'var(--muted-foreground)' }}>{d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Brand Pack & Shortcuts */}
              <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Active Brand Pack */}
                <div className="bs-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="label-caps" style={{ margin: 0 }}>Active brand pack</p>
                    <span className="bs-tag bs-tag-green">Published</span>
                  </div>
                  <h3 className="font-serif" style={{ fontSize: '28px', margin: '12px 0 2px' }}>Lumora</h3>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted-foreground)', margin: 0 }}>
                    Edition 4 · Q4 2026
                  </p>
                  <div style={{ display: 'flex', gap: '6px', margin: '16px 0' }}>
                    {["#1C1917", "#8F2F24", "#A9552F", "#4F5C47", "#D4C7B5"].map(hex => (
                      <div key={hex} style={{ flex: 1, height: '28px', background: hex, border: '1px solid rgba(0,0,0,0.1)' }} title={hex} />
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: 'var(--border)' }}>
                    {[["Rules", 14], ["Claims", 6], ["Expiring", 1], ["Model calls", 42]].map(([k, v]) => (
                      <div key={k} style={{ background: 'var(--card)', padding: '12px 14px' }}>
                        <p className="font-serif" style={{ fontSize: '20px', margin: 0, lineHeight: 1 }}>{v}</p>
                        <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{k}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => go('rulebook')} style={{ marginTop: '16px', background: 'none', border: 'none', borderBottom: '1px solid var(--foreground)', paddingBottom: '2px', fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.12em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    Open the rulebook <ArrowRight size={11} />
                  </button>
                </div>

                {/* Shortcuts */}
                <div className="bs-card" style={{ padding: '24px' }}>
                  <p className="label-caps" style={{ margin: '0 0 16px' }}>Shortcuts</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      ['rulebook', 'Upload brand documents', 'RAG vector ingestion (PDF/DOCX)', Upload],
                      ['audit', 'Audit trail', 'Verify the hash chain', History],
                      ['rules', 'Rule health', 'Override rates by rule', Activity],
                      ['reliability', 'Reliability', 'Calls, verifier, eval', Cpu]
                    ].map(([route, title, desc, Icon]) => (
                      <div key={route} onClick={() => go(route)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <Icon size={16} color="var(--muted-foreground)" />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 500 }}>{title}</p>
                          <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: '8.5px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{desc}</p>
                        </div>
                        <ArrowRight size={13} color="var(--muted-foreground)" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Black Paper Quote */}
                <div className="bs-dark-card">
                  <BrandLogo compact={true} />
                  <p className="font-serif" style={{ fontSize: '19px', lineHeight: 1.4, margin: '16px 0 12px', borderTop: '1px solid rgba(244, 239, 230, 0.2)', paddingTop: '16px', color: '#f4efe6' }}>
                    “A finding that cannot show its evidence never reaches a human.”
                  </p>
                  <p style={{ margin: 0, fontSize: '10.5px', lineHeight: 1.6, color: 'rgba(244, 239, 230, 0.65)' }}>
                    Suppressed findings stay counted. The report tells you what the verifier removed and why.
                  </p>
                </div>
              </aside>
            </div>
          )}

          {/* TAB: REVIEW DETAIL */}
          {page === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button onClick={() => go('queue')} className="bs-btn bs-btn-outline" style={{ fontSize: '12px', padding: '6px 12px' }}>
                    ← Back to queue
                  </button>
                  <div>
                    <h2 className="font-serif" style={{ fontSize: '24px', margin: 0 }}>{currentDraft.title}</h2>
                    <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: '9.5px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                      {currentDraft.channel} · Version {currentDraft.version} · Author: {currentDraft.creatorName}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {currentDraft.status === 'Approved' && (
                    <button onClick={() => setReceiptModal(currentDraft)} className="bs-btn bs-btn-outline">
                      <Award size={14} /> View Receipt
                    </button>
                  )}
                  <button onClick={handleApproveDraft} disabled={currentDraft.status === 'Approved'} className="bs-btn bs-btn-primary">
                    <CheckCheck size={14} />
                    {currentDraft.status === 'Approved' ? 'Signed & Approved' : 'Sign and approve'}
                  </button>
                </div>
              </div>

              {/* Split Editor and Findings */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px', alignItems: 'start' }}>
                <div className="bs-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                    <span className="label-caps">Draft content · live fast lane</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                      ⚡ {findings.length} live issues
                    </span>
                  </div>
                  <textarea
                    value={currentDraft.content}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDrafts(prev => prev.map(d => d.id === currentDraft.id ? { ...d, content: val } : d));
                    }}
                    rows={7}
                    style={{ width: '100%', marginTop: '16px', padding: '16px', background: 'var(--background)', border: '1px solid var(--border)', fontFamily: 'var(--font-serif)', fontSize: '19px', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <p className="label-caps" style={{ margin: '0 0 8px' }}>Active Fast-Lane Highlight Preview</p>
                    <div style={{ padding: '14px', background: 'var(--card)', border: '1px solid var(--border)', fontFamily: 'var(--font-serif)', fontSize: '18px', lineHeight: 1.5 }}>
                      {currentDraft.content}
                    </div>
                  </div>
                </div>

                {/* Findings Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <span className="label-caps">Evidence-backed findings ({findings.length})</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#4F5C47' }}>✓ All verified</span>
                  </div>

                  {findings.map(f => (
                    <div key={f.id} className="bs-card" style={{ padding: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`bs-tag ${f.severity === 'Critical' ? 'bs-tag-red' : 'bs-tag-amber'}`}>{f.severity}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{f.type}</span>
                      </div>
                      <p style={{ margin: '12px 0 6px', fontSize: '13px', lineHeight: 1.5, fontWeight: 500 }}>{f.why}</p>
                      <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '10px', margin: '8px 0' }}>
                        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '8.5px', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Rulebook Excerpt</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', fontStyle: 'italic', color: 'var(--muted-foreground)' }}>{f.excerpt}</p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        <div>
                          <span style={{ textDecoration: 'line-through', color: '#8F2F24' }}>{f.phrase}</span> → <span style={{ color: '#4F5C47' }}>{f.fix}</span>
                        </div>
                        <span style={{ fontSize: '9px', color: 'var(--muted-foreground)' }}>intent {f.intentScore}</span>
                      </div>
                      <button onClick={() => handleAcceptFinding(f)} className="bs-btn bs-btn-outline" style={{ marginTop: '12px', fontSize: '11px', padding: '5px 10px' }}>
                        <Check size={12} /> Accept fix
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: RULEBOOK & CLAIMS LEDGER */}
          {page === 'rulebook' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <KnowledgeBaseRAG tenantId="default-tenant" role={activeRole} />
              <ClaimsLedger role={activeRole} />
            </div>
          )}

          {/* TAB: DRIFT & RULE HEALTH */}
          {page === 'rules' && <RuleHealthDashboard />}

          {/* TAB: RELIABILITY */}
          {page === 'reliability' && <ReliabilityDashboard />}

          {/* TAB: API INTEGRATIONS */}
          {page === 'api' && <ApiIntegrations />}

          {/* TAB: AUDIT TRAIL */}
          {page === 'audit' && <AuditChainView />}

          {/* TAB: VISUAL STUDIO */}
          {page === 'visual' && <VisualGovernanceStudio />}
        </main>
      </div>

      {/* Publication Receipt Modal */}
      {receiptModal && (
        <PublicationReceiptModal
          draft={receiptModal}
          onClose={() => setReceiptModal(null)}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
