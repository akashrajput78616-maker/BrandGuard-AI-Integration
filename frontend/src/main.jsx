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
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { jsPDF } from 'jspdf';

import './brandsentinel.css';
import './style.css';
import './submission.css';
import './rag.css';
import './collab.css';
import './vision.css';

import AIReviewPanel from './AIReviewPanel.jsx';
import SubmissionPage from './SubmissionPage.jsx';
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

// BrandSentinel Logo Component
function BrandLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center border border-foreground/30 bg-foreground font-serif text-[13px] font-medium text-background">
        B
      </span>
      <span className="font-serif text-[19px] tracking-tight text-foreground">
        BrandSentinel
      </span>
      {!compact && (
        <span className="ml-1 hidden border border-border px-1 py-[1px] font-mono text-[8px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
          R2
        </span>
      )}
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

const evidenceChecks = [
  "The quoted span exists verbatim in the submitted content",
  "The rule_id is published in the current rulebook",
  "The guideline excerpt is a real quote from the rulebook",
  "Claim findings reference an id that exists in the Claim Ledger"
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

function detectFindings(text, rules) {
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
      status: 'open',
      comments: []
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
      status: 'open',
      comments: []
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
      status: 'open',
      comments: []
    });
  }
  return list;
}

const pageNotes = {
  queue: { title: "Review queue", note: "Everything waiting on a human decision." },
  submit: { title: "New submission", note: "Fast lane runs as you type." },
  rulebook: { title: "Rulebook", note: "Published rules, claims and glossary." },
  rules: { title: "Drift & rule health", note: "Where reviewers disagree with the machine, and which channel is drifting." },
  api: { title: "API & webhooks", note: "Keys, signed events and the delivery log." },
  audit: { title: "Audit trail", note: "Append-only. Every row commits to the last." },
  reliability: { title: "Reliability", note: "Model calls, verifier counts and eval results." },
  visual: { title: "Visual Governance", note: "CIELAB color distance, palette enforcement and visual inspection." }
};

export default function App() {
  const [page, setPage] = useState('home'); // 'home', 'demo', 'queue', 'review', 'rulebook', 'rules', 'audit', 'reliability', 'api', 'visual', 'submit'
  const [activeRole, setActiveRole] = useState('reviewer'); // 'creator', 'reviewer', 'approver', 'admin'
  const [rules, setRules] = useState(initialRules);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selectedId, setSelectedId] = useState(1);
  const [queueFilter, setQueueFilter] = useState('all');
  const [receiptModal, setReceiptModal] = useState(null);
  const [modal, setModal] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [reasonText, setReasonText] = useState('');

  const currentPersona = personas.find(p => p.role === activeRole) || personas[1];
  const currentDraft = drafts.find(d => d.id === selectedId) || drafts[0];
  const findings = detectFindings(currentDraft.content, rules);
  const pendingFindings = findings.filter(f => f.status === 'open');

  const go = (p) => {
    setPage(p);
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

  // ----------------------------------------------------
  // 1. LANDING PAGE VIEW
  // ----------------------------------------------------
  if (page === 'home') {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Institutional Sticky Header */}
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/92 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-5 sm:px-8">
            <button onClick={() => go('home')} className="cursor-pointer">
              <BrandLogo />
            </button>
            <nav className="hidden items-center gap-7 text-[12px] text-muted-foreground md:flex">
              <a href="#ideas" className="transition-colors hover:text-foreground">The six ideas</a>
              <a href="#pipeline" className="transition-colors hover:text-foreground">How it works</a>
              <a href="#evidence" className="transition-colors hover:text-foreground">Evidence</a>
              <a href="#roles" className="transition-colors hover:text-foreground">Demo roles</a>
            </nav>
            <div className="flex items-center gap-3">
              <button onClick={() => go('queue')} className="hidden text-[12px] text-muted-foreground hover:text-foreground sm:inline cursor-pointer">
                Workspace
              </button>
              <button
                onClick={() => go('demo')}
                className="btn btn-primary h-8 rounded-none px-4 text-[12px] cursor-pointer"
              >
                Enter the demo <ArrowRight className="ml-1.5 size-3.5" />
              </button>
            </div>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-12 sm:px-8 sm:pt-16 lg:pb-20">
            <div className="grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
              <div>
                <div className="flex items-center gap-3">
                  <span className="h-[1px] w-8 bg-foreground/40" />
                  <span className="label-caps">Round 2 prototype · Lumora demo workspace</span>
                </div>
                <h1 className="serif-display mt-7 text-[clamp(3.1rem,7.2vw,5.5rem)]">
                  The brand gate<br />you can audit.
                </h1>
                <p className="mt-7 max-w-[46ch] text-[15px] leading-7 text-muted-foreground">
                  BrandSentinel reviews content before it is published against a company's own guidelines. Findings arrive with evidence, a rule and a source excerpt. A human accepts, edits or rejects each one, and the decision trail is hash-chained.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => go('demo')}
                    className="btn btn-primary h-11 rounded-none px-6 text-[13px] cursor-pointer"
                  >
                    Try the Lumora demo <ArrowRight className="ml-2 size-4" />
                  </button>
                  <a
                    href="#pipeline"
                    className="btn btn-outline h-11 rounded-none border-border px-6 text-[13px] cursor-pointer inline-flex items-center"
                  >
                    See the pipeline
                  </a>
                </div>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  No signup · one-click roles · synthetic brand, seeded data
                </p>
                <div className="mt-10 grid grid-cols-3 gap-px border border-border bg-border">
                  {[["14", "typed rules"], ["6", "ledger claims"], ["05", "specialist reviewers"]].map(([s, r]) => (
                    <div key={r} className="bg-card px-3 py-4">
                      <p className="font-serif text-[28px] leading-none">{s}</p>
                      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{r}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Specimen Card on Right */}
              <div className="relative">
                <div className="absolute -left-3 top-4 hidden h-[calc(100%-2rem)] w-[1px] bg-border lg:block" />
                <div className="paper">
                  <div className="flex items-center justify-between border-b border-border/80 px-5 py-3">
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                      Specimen · Instagram caption · v3
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8F4526]">
                      <span className="size-1.5 rounded-full bg-[#A9552F]" /> 4 findings
                    </span>
                  </div>
                  <div className="px-5 py-6">
                    <p className="font-serif text-[24px] leading-[1.35]">
                      <span className="finding-mark-critical">Glow Serum</span> is here — and it's a{" "}
                      <span className="finding-mark-critical">MIRACLE</span> for tired skin. Clinically proven to{" "}
                      <span className="finding-mark">remove wrinkles in 7 days</span>. Get yours before it sells out!!
                    </p>
                    <p className="mt-4 font-mono text-[10px] leading-5 text-muted-foreground">
                      Caption colours: #FF2E93 on #F4EFE6 · <span className="finding-mark">1.9:1 contrast</span>
                    </p>
                  </div>
                  <div className="border-t border-border/80 bg-[#A9552F]/[0.035] px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-[#8F2F24]/40 px-1.5 py-[2px] font-mono text-[8px] uppercase tracking-[0.16em] text-[#8F2F24]">
                        Critical
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                        Terminology & messaging · R-TERM-01
                      </span>
                      <span className="ml-auto flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#4F5C47]">
                        <Check className="size-3" /> evidence verified
                      </span>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-6">
                      “Glow Serum” drops the brand name. The rule requires the full product name on first mention.
                    </p>
                    <div className="mt-3 border-l border-border pl-3">
                      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Guideline · Edition 4</p>
                      <p className="mt-1 text-[11.5px] italic leading-5 text-muted-foreground">
                        “Always write the full product name ‘Lumora Glow Serum’ on first mention.”
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px]">
                      <span className="border border-border px-1.5 py-[2px] font-mono text-[9px] text-muted-foreground">FIX</span>
                      <span className="font-mono text-[11px]">
                        <span className="text-[#8F2F24] line-through">Glow Serum</span>{" "}
                        <span className="text-[#4F5C47]">Lumora Glow Serum</span>
                      </span>
                      <span className="ml-auto font-mono text-[9px] text-muted-foreground">intent 0.61</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-start justify-between gap-4 px-1">
                  <p className="text-[10px] leading-4 text-muted-foreground">
                    Every finding on the right carries the same six pieces of evidence.
                  </p>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Fig. 01</span>
                </div>
              </div>
            </div>
          </section>

          {/* 4 Pillars Strip */}
          <section className="border-y border-border/80 bg-card/40">
            <div className="mx-auto grid w-full max-w-[1180px] gap-px bg-border/70 px-5 py-0 sm:px-8 md:grid-cols-4">
              {[
                ["The gate", "Content cannot be approved while a critical finding is unresolved."],
                ["The evidence", "Verbatim spans, real rules, real quotes. Invented proof is dropped."],
                ["The human", "Creator submits. Reviewer decides. Approver signs. Legal can be raised."],
                ["The record", "Hash-chained audit and a PDF receipt for every approved version."]
              ].map(([s, r]) => (
                <div key={s} className="bg-background px-1 py-7 md:px-6">
                  <p className="label-caps">{s}</p>
                  <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{r}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Problem Section */}
          <section className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
              <div>
                <p className="label-caps">The problem</p>
                <h2 className="mt-4 font-serif text-[34px] leading-[1.1] sm:text-[40px]">
                  Content ships faster than the brand can check it.
                </h2>
              </div>
              <div className="space-y-5 text-[14.5px] leading-7 text-muted-foreground lg:pl-10">
                <p>
                  A single unclaimed promise in a paid ad can cost a week of removal requests and verification. An old product name stays in the search index long after the campaign ends. Style guides do not enforce themselves at the moment of publishing, and the people writing the copy are not the people who own the rules.
                </p>
                <p>
                  BrandSentinel sits between the draft and the publish button. It does not replace the brand team. It gives them a smaller queue, each item with evidence they can check in seconds, and a record of what they decided.
                </p>
                <div className="border-l-2 border-foreground/60 pl-5 font-serif text-[20px] leading-[1.45] text-foreground">
                  “A finding that cannot show its evidence never reaches a human. That is the whole product.”
                </div>
              </div>
            </div>
          </section>

          {/* The Six Ideas */}
          <section id="ideas" className="border-t border-border/80">
            <div className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="label-caps">Six ideas</p>
                  <h2 className="mt-3 font-serif text-[36px] leading-none sm:text-[44px]">What makes this different</h2>
                </div>
                <p className="max-w-[38ch] text-[12.5px] leading-6 text-muted-foreground">
                  Each one exists in the running product. If it were not built, it would not be on this list.
                </p>
              </div>
              <div className="mt-10 grid gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
                {sixIdeas.map(s => (
                  <div key={s.n} className="group bg-card p-6 transition-colors hover:bg-background">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">{s.n}</span>
                      <span className="h-[1px] w-6 bg-border transition-all group-hover:w-10 group-hover:bg-foreground/40" />
                    </div>
                    <h3 className="mt-6 font-serif text-[22px] leading-tight">{s.title}</h3>
                    <p className="mt-3 text-[12.5px] leading-6 text-muted-foreground">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* The Pipeline */}
          <section id="pipeline" className="border-t border-border/80 bg-card/50">
            <div className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20">
              <p className="label-caps">The pipeline</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <h2 className="max-w-[18ch] font-serif text-[36px] leading-[1.05] sm:text-[44px]">Two lanes, one gate</h2>
                <p className="max-w-[44ch] text-[12.5px] leading-6 text-muted-foreground">
                  The fast lane is deterministic and returns in milliseconds. The deep lane runs five reviewers in parallel, then a verifier that can only delete, never add.
                </p>
              </div>
              <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1.05fr]">
                {/* Lane 01 */}
                <div className="paper p-5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Lane 01 · deterministic · &lt; 1s</p>
                  <h3 className="mt-2 font-serif text-[24px]">Fast lane</h3>
                  <ul className="mt-4 space-y-2.5 border-t border-border/70 pt-4">
                    {["Glossary and banned terms", "Product naming and casing", "WCAG contrast ratio", "Missing alt text", "Palette distance in CIELAB"].map(s => (
                      <li key={s} className="flex items-start gap-2 text-[12px] leading-5">
                        <Minus className="mt-[3px] size-3 shrink-0 text-muted-foreground" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="hidden items-center justify-center lg:flex">
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
                {/* Lane 02 */}
                <div className="paper p-5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Lane 02 · judgment · parallel</p>
                  <h3 className="mt-2 font-serif text-[24px]">Deep lane</h3>
                  <ul className="mt-4 space-y-2.5 border-t border-border/70 pt-4">
                    {["Tone & voice", "Terminology & messaging", "Claims against the ledger", "Visual consistency", "Accessibility reading"].map(s => (
                      <li key={s} className="flex items-start gap-2 text-[12px] leading-5">
                        <Minus className="mt-[3px] size-3 shrink-0 text-muted-foreground" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="hidden items-center justify-center lg:flex">
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
                {/* Evidence Gate */}
                <div className="border border-foreground/25 bg-foreground p-5 text-background">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-background/60">Evidence gate</p>
                  <h3 className="mt-2 font-serif text-[24px] text-background">Verifier → Synthesizer</h3>
                  <p className="mt-4 border-t border-background/20 pt-4 text-[12px] leading-6 text-background/75">
                    Duplicates are merged, severity decides order, fixes get an intent score. Dropped findings are counted and shown, not hidden.
                  </p>
                  <button
                    onClick={() => go('demo')}
                    className="mt-5 inline-flex items-center gap-1.5 border-b border-background/40 pb-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-background cursor-pointer"
                  >
                    Run it on the sample <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Evidence or Silence */}
          <section id="evidence" className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <div>
                <p className="label-caps">Evidence or silence</p>
                <h2 className="mt-3 font-serif text-[36px] leading-[1.05] sm:text-[42px]">
                  Four checks<br />before a finding<br />reaches you.
                </h2>
                <p className="mt-5 max-w-[38ch] text-[13px] leading-6 text-muted-foreground">
                  Models are useful readers and unreliable witnesses. So we do not trust their output by default. A dropped finding is logged with its reason, and the report shows how many were suppressed.
                </p>
              </div>
              <div className="border border-border">
                {evidenceChecks.map((s, i) => (
                  <div key={s} className="flex gap-4 border-b border-border/70 px-5 py-5 last:border-b-0">
                    <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-[13.5px] leading-6">{s}</p>
                    </div>
                    <Check className="mt-1 size-4 shrink-0 text-[#4F5C47]" strokeWidth={1.6} />
                  </div>
                ))}
                <div className="bg-secondary/60 px-5 py-4">
                  <p className="font-mono text-[10px] leading-5 text-muted-foreground">
                    FAILURE MODES TARGETED · tone drift · naming · unsupported claim · expired claim · visual inconsistency · accessibility
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Demo Roles */}
          <section id="roles" className="border-t border-border/80 bg-card/60">
            <div className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20">
              <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <p className="label-caps">Judge access</p>
                  <h2 className="mt-3 font-serif text-[36px] leading-[1.05] sm:text-[42px]">
                    Four roles.<br />No signup.
                  </h2>
                  <p className="mt-5 max-w-[40ch] text-[13.5px] leading-6 text-muted-foreground">
                    Enter as any Lumora persona with one click. The role switcher stays in the header, so you can submit as Creator, decide as Reviewer and sign off as Approver without changing accounts. Every switch is audited.
                  </p>
                  <button
                    onClick={() => go('demo')}
                    className="btn btn-primary mt-6 h-11 rounded-none px-6 text-[13px] cursor-pointer"
                  >
                    Open the demo screen <ArrowRight className="ml-2 size-4" />
                  </button>
                </div>
                <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
                  {personas.map(p => (
                    <button
                      key={p.role}
                      onClick={() => { setActiveRole(p.role); go('queue'); }}
                      className="bg-card p-5 text-left transition-colors hover:bg-background cursor-pointer"
                    >
                      <p className="label-caps text-[9px]">{p.title}</p>
                      <p className="mt-2 font-serif text-[20px] leading-tight">{p.name}</p>
                      <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">{p.detail}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Institutional Footer */}
        <footer className="border-t border-border/80">
          <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-3">
              <BrandLogo compact={true} />
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Round 2 · October 2026
              </span>
            </div>
            <p className="max-w-[62ch] text-[10.5px] leading-5 text-muted-foreground">
              Lumora is a synthetic brand created for this prototype. All content, claims and studies are fictional. Model output is treated as a proposal; a human makes every decision.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ----------------------------------------------------
  // 2. DEMO ROLE SELECTION VIEW
  // ----------------------------------------------------
  if (page === 'demo') {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border/80">
          <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-5 sm:px-8">
            <button onClick={() => go('home')} className="cursor-pointer">
              <BrandLogo />
            </button>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Demo access · no signup
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14">
          <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <p className="label-caps">Lumora Studio · synthetic brand</p>
              <h1 className="serif-display mt-5 text-[clamp(2.6rem,5vw,3.6rem)]">
                Choose a seat<br />at the gate.
              </h1>
              <p className="mt-5 max-w-[38ch] text-[13.5px] leading-6 text-muted-foreground">
                One click signs you into the seeded Lumora workspace under a demo persona. Use the role switcher in the header to move between seats without signing up again.
              </p>
              <div className="mt-8 border border-border bg-card/60 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#4F5C47]" strokeWidth={1.5} />
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em]">What is real here</p>
                </div>
                <ul className="mt-3 space-y-2 text-[11.5px] leading-5 text-muted-foreground">
                  <li>The rulebook, claims ledger and guideline document are seeded.</li>
                  <li>Model calls are live. Findings are stored, not mocked.</li>
                  <li>Every role switch and decision is written to the audit chain.</li>
                  <li>Nothing is published anywhere. Approval only produces a receipt.</li>
                </ul>
              </div>
            </div>

            <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
              {personas.map((p, i) => (
                <button
                  key={p.role}
                  onClick={() => { setActiveRole(p.role); go('queue'); }}
                  className="group flex min-h-[210px] flex-col items-start bg-card p-5 text-left transition-colors hover:bg-background cursor-pointer"
                >
                  <div className="flex w-full items-start justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                      0{i + 1} · {p.title}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                  </div>
                  <h2 className="mt-6 font-serif text-[27px] leading-none">{p.name}</h2>
                  <p className="mt-1.5 font-serif text-[15px] italic text-muted-foreground">{p.line}</p>
                  <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">{p.detail}</p>
                  <span className="mt-auto pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-foreground/70">
                    Enter as {p.title.toLowerCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ----------------------------------------------------
  // 3. APP SHELL & WORKSPACE VIEW (BrandSentinel Layout)
  // ----------------------------------------------------
  const currentNavTitle = pageNotes[page]?.title || "Workspace";
  const currentNavNote = pageNotes[page]?.note || "Brand governance, with evidence.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1440px]">
        {/* Institutional Left Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-border/80 px-5 py-6 lg:flex">
          <button onClick={() => go('home')} className="px-1 text-left cursor-pointer">
            <BrandLogo />
          </button>
          <p className="mt-3 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Lumora Studio · demo
          </p>

          <nav className="mt-9 flex flex-col gap-[2px]">
            {[
              { id: 'queue', label: 'Review queue', icon: LayoutDashboard, count: drafts.filter(d => d.status === 'In review').length },
              { id: 'submit', label: 'New submission', icon: FilePlus2 },
              { id: 'rulebook', label: 'Rulebook', icon: BookOpen },
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
                  className={`group flex items-center gap-3 border-l-2 px-3 py-[9px] text-[13px] transition-colors cursor-pointer text-left ${
                    isActive
                      ? "border-foreground bg-foreground/[0.045] text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:bg-foreground/[0.025] hover:text-foreground"
                  }`}
                >
                  <Icon className="size-[15px] opacity-70" strokeWidth={1.5} />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Signed-in Persona at Bottom */}
          <div className="mt-auto space-y-4">
            <div className="border border-border/80 p-3">
              <p className="label-caps text-[9px]">Signed in</p>
              <p className="mt-1 font-serif text-[16px] leading-tight">{currentPersona.name}</p>
              <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                {currentPersona.title} · Lumora Studio
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  14 rules · 6 claims
                </span>
                <button onClick={() => go('demo')} className="text-muted-foreground hover:text-foreground cursor-pointer" title="Switch persona">
                  <LogOut className="size-[14px]" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <p className="px-1 text-[10px] leading-4 text-muted-foreground/80">
              Synthetic brand and seeded data. Nothing here is a real client.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="min-w-0 flex-1">
          {/* Top Header Bar */}
          <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
              <div className="flex items-center gap-4">
                <button onClick={() => go('home')} className="lg:hidden cursor-pointer">
                  <BrandLogo compact={true} />
                </button>
                <div className="hidden lg:block">
                  <p className="label-caps text-[9px]">Lumora Studio</p>
                  <h1 className="mt-0.5 font-serif text-[22px] leading-none">{currentNavTitle}</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Role Switcher Pill */}
                <div className="flex items-center gap-2">
                  <span className="label-caps text-[9px] hidden sm:inline">Acting as</span>
                  <select
                    value={activeRole}
                    onChange={(e) => switchRole(e.target.value)}
                    className="h-8 rounded-none border border-border bg-card px-2.5 text-[12px] capitalize cursor-pointer focus:outline-none"
                  >
                    {personas.map(p => (
                      <option key={p.role} value={p.role}>{p.title} ({p.name})</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => go('submit')}
                  className="btn btn-primary h-8 rounded-none px-3 text-[12px] cursor-pointer"
                >
                  <FilePlus2 className="mr-1.5 size-3.5" strokeWidth={1.6} />
                  Submit content
                </button>
              </div>
            </div>

            {/* Mobile horizontal nav */}
            <nav className="flex gap-1 overflow-x-auto border-t border-border/60 px-3 py-2 lg:hidden">
              {[
                { id: 'queue', label: 'Queue' },
                { id: 'submit', label: 'Submit' },
                { id: 'rulebook', label: 'Rulebook' },
                { id: 'rules', label: 'Drift' },
                { id: 'audit', label: 'Audit' },
                { id: 'api', label: 'API' },
                { id: 'reliability', label: 'Reliability' },
                { id: 'visual', label: 'Visual' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  className={`whitespace-nowrap px-2.5 py-1 text-[11px] cursor-pointer ${
                    page === t.id ? "bg-foreground text-background" : "text-muted-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </header>

          <main className="px-4 py-6 sm:px-7 sm:py-8">
            {/* Page Header Note */}
            <div className="mb-6 hidden border-b border-border/70 pb-4 lg:block">
              <p className="prose-note max-w-2xl">{currentNavNote}</p>
            </div>

            {/* TAB: REVIEW QUEUE (AppDashboard) */}
            {page === 'queue' && (
              <div className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
                <div className="min-w-0">
                  <section className="border border-border bg-card">
                    <div className="flex flex-col gap-4 border-b border-border/80 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="label-caps">Lumora Studio · live queue</p>
                        <h2 className="mt-2 font-serif text-[30px] leading-none">The gate, this morning</h2>
                        <p className="mt-2 max-w-[52ch] text-[12px] leading-5 text-muted-foreground">
                          Open a submission to work its findings. The whole loop runs on seeded Lumora data, with live model review.
                        </p>
                      </div>
                      <button
                        onClick={() => go('submit')}
                        className="btn btn-primary h-9 rounded-none px-4 text-[12px] cursor-pointer"
                      >
                        <FilePlus2 className="mr-2 size-3.5" /> New submission
                      </button>
                    </div>

                    {/* 4 Counters Grid */}
                    <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                      {[
                        ["Awaiting review", drafts.filter(d => d.status === 'In review').length],
                        ["Findings", drafts.reduce((acc, d) => acc + d.findingCount, 0)],
                        ["Decided", drafts.filter(d => d.status === 'Changes requested').length],
                        ["Approved", drafts.filter(d => d.status === 'Approved').length]
                      ].map(([s, t]) => (
                        <div key={s} className="bg-card px-4 py-4">
                          <p className="font-serif text-[28px] leading-none">{String(t)}</p>
                          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-muted-foreground">{s}</p>
                        </div>
                      ))}
                    </div>

                    {/* Filter bar */}
                    <div className="flex items-center justify-between border-y border-border/80 px-5 py-2.5">
                      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Submissions</p>
                      <div className="flex gap-1">
                        {["all", "open"].map(s => (
                          <button
                            key={s}
                            onClick={() => setQueueFilter(s)}
                            className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] cursor-pointer ${
                              queueFilter === s
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {s === 'all' ? 'All' : 'Open'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submissions List */}
                    <div>
                      {drafts
                        .filter(d => queueFilter === 'all' ? true : d.status !== 'Approved')
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => { setSelectedId(s.id); go('review'); }}
                            className="group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border/60 px-5 py-4 transition-colors last:border-b-0 hover:bg-background cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-serif text-[18px] leading-tight">{s.title}</p>
                                {s.legalFlag && (
                                  <span className="border border-[#8F2F24]/50 px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-[0.14em] text-[#8F2F24]">
                                    Legal
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">
                                {s.channel} · v{s.version} · {s.creatorName} · {s.updatedAt}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="hidden text-right sm:block">
                                <p className="font-serif text-[18px] leading-none">{s.findingCount}</p>
                                <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">findings</p>
                              </div>
                              <span className={`tag ${s.status === 'Approved' ? 'tag-green' : s.status === 'In review' ? 'tag-amber' : 'tag-subtle'}`}>
                                {s.status}
                              </span>
                              <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>

                  {/* Two Minute Path */}
                  <section className="mt-6 border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border/80 px-5 py-3">
                      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">The two-minute path</p>
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                        Creator → Reviewer → Approver
                      </span>
                    </div>
                    <div className="grid gap-px bg-border sm:grid-cols-4">
                      {[
                        ["01", "Submit", "Load the Lumora caption. Fast lane flags issues immediately."],
                        ["02", "Review", "Specialist reviewers report. The verifier suppresses anything unsupported."],
                        ["03", "Decide", "Accept, edit or reject. Approve with the Approver role."],
                        ["04", "Receipt", "Export the PDF. Check the audit chain from the sidebar."]
                      ].map(([s, t, i]) => (
                        <div key={s} className="bg-card px-4 py-4">
                          <p className="font-mono text-[9px] text-muted-foreground">{s}</p>
                          <p className="mt-2 font-serif text-[17px]">{t}</p>
                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{i}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Right Column / Brand Pack Side Panel */}
                <aside className="space-y-6">
                  <section className="border border-border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <p className="label-caps">Active brand pack</p>
                      <span className="border border-[#6F7D66]/50 px-1.5 py-[2px] font-mono text-[8px] uppercase tracking-[0.14em] text-[#4F5C47]">
                        Published
                      </span>
                    </div>
                    <p className="mt-3 font-serif text-[26px] leading-none">Lumora</p>
                    <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">Edition 4 · Q4 2026</p>
                    <div className="mt-4 flex gap-1.5">
                      {["#1C1917", "#8F2F24", "#A9552F", "#4F5C47", "#D4C7B5"].map(hex => (
                        <div key={hex} className="h-7 flex-1 border border-black/10" style={{ backgroundColor: hex }} title={hex} />
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-px bg-border">
                      {[["Rules", 14], ["Claims", 6], ["Expiring / expired", 1], ["Model calls", 42]].map(([s, t]) => (
                        <div key={s} className="bg-card px-3 py-2.5">
                          <p className="font-serif text-[19px] leading-none">{String(t)}</p>
                          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">{s}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => go('rulebook')}
                      className="mt-4 inline-flex items-center gap-1.5 border-b border-foreground/25 pb-0.5 font-mono text-[9px] uppercase tracking-[0.13em] cursor-pointer"
                    >
                      Open the rulebook <ArrowRight className="size-3" />
                    </button>
                  </section>

                  {/* Shortcuts Panel */}
                  <section className="border border-border bg-card p-5">
                    <p className="label-caps">Shortcuts</p>
                    <div className="mt-3 divide-y divide-border/70">
                      {[
                        ['audit', 'Audit trail', 'Verify the hash chain', History],
                        ['rules', 'Rule health', 'Override rates by rule', Activity],
                        ['reliability', 'Reliability', 'Calls, verifier, eval', Cpu]
                      ].map(([route, title, desc, Icon]) => (
                        <button
                          key={route}
                          onClick={() => go(route)}
                          className="group flex w-full items-center gap-3 py-3 text-left cursor-pointer"
                        >
                          <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
                          <div className="flex-1">
                            <p className="text-[12px] leading-4">{title}</p>
                            <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-foreground">{desc}</p>
                          </div>
                          <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Dark Institutional Quote Card */}
                  <section className="border border-border bg-[#1F1D1A] p-5 text-[#F4EFE6]">
                    <BrandLogo compact={true} />
                    <p className="mt-4 border-t border-[#F4EFE6]/20 pt-4 font-serif text-[19px] leading-[1.35]">
                      “A finding that cannot show its evidence never reaches a human.”
                    </p>
                    <p className="mt-3 text-[10.5px] leading-5 text-[#F4EFE6]/60">
                      Suppressed findings stay counted. The report tells you what the verifier removed and why.
                    </p>
                  </section>
                </aside>
              </div>
            )}

            {/* TAB: REVIEW DETAIL WORKSPACE */}
            {page === 'review' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-border/80 pb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => go('queue')}
                      className="btn btn-outline h-8 rounded-none px-2.5 text-[11px] cursor-pointer"
                    >
                      ← Back to queue
                    </button>
                    <div>
                      <h2 className="font-serif text-[24px] leading-none">{currentDraft.title}</h2>
                      <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                        {currentDraft.channel} · Version {currentDraft.version} · Author: {currentDraft.creatorName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentDraft.status === 'Approved' && (
                      <button
                        onClick={() => setReceiptModal(currentDraft)}
                        className="btn btn-outline h-8 rounded-none text-[12px] cursor-pointer"
                      >
                        <Award className="mr-1.5 size-3.5" /> Official Receipt
                      </button>
                    )}
                    <button
                      onClick={handleApproveDraft}
                      disabled={currentDraft.status === 'Approved'}
                      className="btn btn-primary h-8 rounded-none text-[12px] cursor-pointer"
                    >
                      <CheckCheck className="mr-1.5 size-3.5" />
                      {currentDraft.status === 'Approved' ? 'Signed & Approved' : 'Sign and approve'}
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  {/* Left: Content Editor */}
                  <div className="paper p-5">
                    <div className="flex items-center justify-between border-b border-border/70 pb-3">
                      <span className="label-caps">Draft content · live fast lane</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                        ⚡ {findings.length} findings detected
                      </span>
                    </div>

                    <div className="mt-4">
                      <textarea
                        value={currentDraft.content}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDrafts(prev => prev.map(d => d.id === currentDraft.id ? { ...d, content: val } : d));
                        }}
                        rows={6}
                        className="w-full border border-border bg-background p-3 font-serif text-[18px] leading-relaxed focus:outline-none"
                      />
                    </div>

                    <div className="mt-4 border-t border-border/70 pt-4">
                      <p className="label-caps">Highlighted findings in context</p>
                      <div className="mt-2 rounded bg-card p-3 font-serif text-[18px] leading-relaxed border border-border/60">
                        {currentDraft.content}
                      </div>
                    </div>
                  </div>

                  {/* Right: Findings Panel */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/70 pb-2">
                      <span className="label-caps">Evidence-backed findings ({findings.length})</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#4F5C47]">
                        ✓ All grounded
                      </span>
                    </div>

                    {findings.map(f => (
                      <div key={f.id} className="paper p-4 border border-border/80">
                        <div className="flex items-center justify-between">
                          <span className={`tag ${f.severity === 'Critical' ? 'tag-critical' : 'tag-amber'}`}>
                            {f.severity}
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                            {f.type}
                          </span>
                        </div>
                        <p className="mt-2.5 text-[13px] leading-5 font-medium">{f.why}</p>
                        <div className="mt-2.5 border-l-2 border-border pl-3 py-0.5">
                          <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-foreground">Rulebook Excerpt</p>
                          <p className="mt-0.5 text-[11.5px] italic text-muted-foreground">{f.excerpt}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                          <div className="font-mono text-[11px]">
                            <span className="text-[#8F2F24] line-through">{f.phrase}</span> → <span className="text-[#4F5C47]">{f.fix}</span>
                          </div>
                          <span className="font-mono text-[9px] text-muted-foreground">intent {f.intentScore}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => handleAcceptFinding(f)}
                            className="btn btn-outline h-7 px-2.5 text-[11px] rounded-none cursor-pointer"
                          >
                            <Check className="mr-1 size-3" /> Accept fix
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: RULEBOOK & CLAIMS LEDGER */}
            {page === 'rulebook' && (
              <div className="space-y-8">
                <KnowledgeBaseRAG tenantId="lumora-tenant" role={activeRole} />
                <ClaimsLedger role={activeRole} />
              </div>
            )}

            {/* TAB: DRIFT & RULE HEALTH */}
            {page === 'rules' && (
              <div>
                <RuleHealthDashboard />
              </div>
            )}

            {/* TAB: RELIABILITY & RED-TEAM EVAL */}
            {page === 'reliability' && (
              <div>
                <ReliabilityDashboard />
              </div>
            )}

            {/* TAB: API & WEBHOOKS */}
            {page === 'api' && (
              <div>
                <ApiIntegrations />
              </div>
            )}

            {/* TAB: AUDIT CHAIN */}
            {page === 'audit' && (
              <div>
                <AuditChainView />
              </div>
            )}

            {/* TAB: VISUAL STUDIO */}
            {page === 'visual' && (
              <div>
                <VisualGovernanceStudio />
              </div>
            )}

            {/* TAB: NEW SUBMISSION */}
            {page === 'submit' && (
              <div>
                <SubmissionPage goTo={go} />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Official Publication Receipt Modal */}
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
