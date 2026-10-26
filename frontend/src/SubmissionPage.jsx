import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, ArrowRight, ArrowUpRight, Check, AlertTriangle, FileText,
  BookOpen, ScanSearch, ChartNoAxesCombined, History, Shield, Lock, Eye,
  Users, Sparkles, CheckCircle2, ExternalLink, Code, Globe, Cpu, Database,
  Layers, Zap, GitBranch, Target, Rocket, TrendingUp, Award, Star,
  Lightbulb, Wrench, BarChart3, Brain, Network, Workflow
} from 'lucide-react';

const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };
const stagger = { animate: { transition: { staggerChildren: 0.08 } } };


function FeatureCard({ icon: Icon, title, desc, status, color }) {
  return (
    <motion.div className="sub-feature-card" whileHover={{ y: -4 }} {...fadeIn}>
      <div className="sub-feature-header">
        <span className={'feature-icon ' + (color || 'teal')}><Icon size={20} /></span>
        <span className={'sub-status ' + (status === 'Complete' ? 'done' : status === 'In Progress' ? 'progress' : 'planned')}>
          {status === 'Complete' ? <CheckCircle2 size={11} /> : status === 'In Progress' ? <Zap size={11} /> : <Target size={11} />}
          {status}
        </span>
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </motion.div>
  );
}

function TimelineItem({ round, title, items, active }) {
  return (
    <div className={'sub-timeline-item' + (active ? ' active' : '')}>
      <div className="sub-timeline-marker">
        <span className="sub-timeline-dot" />
        <span className="sub-timeline-line" />
      </div>
      <div className="sub-timeline-content">
        <span className="sub-timeline-round">{round}</span>
        <h3>{title}</h3>
        <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </div>
    </div>
  );
}

export default function SubmissionPage({ goTo }) {
  return (
    <div className="submission-page">
      {/* ─── Hero ─── */}
      <section className="sub-hero">
        <div className="sub-hero-glow" />
        <motion.div className="sub-hero-content" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="sub-hero-badge">
            <Award size={14} /> INKLOOM AI HACKATHON — ROUND 3 COMPLETE
          </div>

          <h1>
            Brand<span className="gradient-text">Guard</span>
          </h1>
          <p className="sub-hero-tagline">
            AI-powered brand governance platform that catches off-brand content before publication — with explanations, source citations, and human oversight at every step.
          </p>
          <div className="sub-hero-stats">
            <div><strong>12</strong><span>Core Features</span></div>
            <div><strong>Gemini 3.8</strong><span>AI Integration</span></div>
            <div><strong>Full 6-Step</strong><span>Workflow</span></div>
            <div><strong>100%</strong><span>Human-led</span></div>
          </div>
          <div className="sub-hero-actions">
            <button className="btn primary" onClick={() => goTo('review')}>
              <ScanSearch size={17} /> Try Live Demo <ArrowRight size={16} />
            </button>
            <a className="btn secondary" href="https://github.com/akashrajput78616-maker/BrandGuard-AI-Integration" target="_blank" rel="noopener noreferrer">
              <GitBranch size={17} /> Source Code <ExternalLink size={14} />
            </a>
          </div>
        </motion.div>
      </section>

      {/* ─── Quick Links ─── */}
      <section className="sub-links-strip">
        <div className="container sub-links-inner">
          {[
            ['Working Demo', 'review', ScanSearch, 'Try the full workflow'],
            ['Dashboard', 'dashboard', ChartNoAxesCombined, 'Content pipeline overview'],
            ['Knowledge Base', 'knowledge', BookOpen, 'Brand rules & facts'],
            ['AI Transparency', 'transparency', Shield, 'Responsible AI details'],
          ].map(([label, page, Icon, desc]) => (
            <button key={page} className="sub-link-card" onClick={() => goTo(page)}>
              <Icon size={22} />
              <div>
                <strong>{label}</strong>
                <small>{desc}</small>
              </div>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      </section>

      {/* ─── Project Overview ─── */}
      <section className="section container">
        <div className="sub-section-header">
          <span className="kicker">PROJECT OVERVIEW</span>
          <h2>What is <span className="gradient-text">BrandGuard?</span></h2>
          <p>BrandGuard is an intelligent brand governance platform that reviews marketing content against approved brand guidelines using AI. It ensures every message is accurate, consistent, and on-brand — with full transparency and human control.</p>
        </div>

        <div className="sub-overview-grid">
          <div className="sub-overview-card problem">
            <AlertTriangle size={28} />
            <h3>The Problem</h3>
            <p>Brands publish thousands of pieces of content. Without automated review, off-brand language, unsupported claims, and inconsistent messaging slip through — damaging trust and creating compliance risk.</p>
          </div>
          <div className="sub-overview-card solution">
            <Sparkles size={28} />
            <h3>Our Solution</h3>
            <p>BrandGuard combines a deterministic rules engine with Gemini AI to flag issues, cite source rules, suggest intent-preserving fixes, and ensure every decision goes through a human approval gate.</p>
          </div>
          <div className="sub-overview-card approach">
            <Shield size={28} />
            <h3>Our Approach</h3>
            <p>Privacy-first, human-led, source-grounded. AI findings always cite an approved rule. No source? We flag it for human review instead of inventing one. No automatic publishing ever occurs.</p>
          </div>
        </div>
      </section>



      {/* ─── Core Workflow ─── */}
      <section className="section sub-workflow-section">
        <div className="container">
          <div className="sub-section-header">
            <span className="kicker">WORKING CORE WORKFLOW</span>
            <h2>End-to-end product <span className="gradient-text">journey</span></h2>
            <p>The main product workflow operates from start to finish across 6 integrated stages.</p>
          </div>

          <div className="sub-workflow-steps">
            {[
              ['01', 'Build Knowledge Base', 'Add brand rules, approved facts, terminology, and visual standards. Admin role can create, edit, and import guidelines.', BookOpen, 'teal'],
              ['02', 'Submit Content', 'Paste marketing copy, upload text files, or submit image drafts for review against brand policies.', FileText, 'purple'],
              ['03', 'Rule-Based Analysis', 'Deterministic engine checks content against all approved rules — claims, tone, terminology, accessibility.', ScanSearch, 'amber'],
              ['04', 'AI-Powered Review', 'Gemini AI analyzes content for deeper issues — exaggerated claims, misleading promises, brand consistency problems.', Brain, 'purple'],
              ['05', 'Human Decision Gate', 'Accept suggestions, edit manually, or dismiss with reason. Every action is logged. No auto-publishing.', Users, 'green'],
              ['06', 'Approve & Audit', 'Final approval by authorized roles. Full audit trail. PDF report export with findings and decisions.', CheckCircle2, 'teal'],
            ].map(([num, title, desc, Icon, color]) => (
              <motion.div className="sub-workflow-step" key={num} whileHover={{ y: -3 }}>
                <div className="sub-step-num-wrap">
                  <span className="sub-step-num">{num}</span>
                  <span className="sub-step-connector" />
                </div>
                <span className={'feature-icon ' + color}><Icon size={22} /></span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="sub-cta-inline">
            <button className="btn primary" onClick={() => goTo('review')}>
              <Rocket size={17} /> Experience the full workflow <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Completed Features ─── */}
      <section className="section container">
        <div className="sub-section-header">
          <span className="kicker">COMPLETED FEATURES</span>
          <h2>What we've <span className="gradient-text">built</span></h2>
          <p>Every feature listed below is fully functional and demonstrable in the live prototype.</p>
        </div>

        <motion.div className="sub-features-grid" {...stagger}>
          <FeatureCard icon={ScanSearch} title="Review Workspace" desc="Full content editor with inline phrase flagging, severity badges, confidence scores, suggested fixes, accept/edit/dismiss actions, and comment threads." status="Complete" color="teal" />
          <FeatureCard icon={BookOpen} title="Brand Knowledge Base" desc="Searchable repository of brand rules with categories, approved claims, colour palettes, terminology guides, and admin import/export." status="Complete" color="purple" />
          <FeatureCard icon={ChartNoAxesCombined} title="Insights Dashboard" desc="Interactive charts showing issues by type, draft pipeline status, guideline clarity analysis, and team performance trends." status="Complete" color="amber" />
          <FeatureCard icon={History} title="Audit Log" desc="Chronological record of every review action, approval decision, and content change — who did what, when, and why." status="Complete" color="green" />
          <FeatureCard icon={Shield} title="AI Transparency Panel" desc="Full disclosure of review engine type, data handling, external services, grounding methodology, and production readiness." status="Complete" color="teal" />
          <FeatureCard icon={Users} title="Role-Based Access" desc="Creator, Reviewer, Manager, and Admin roles with appropriate permissions. Approval gated to authorized roles only." status="Complete" color="purple" />
          <FeatureCard icon={Brain} title="Gemini AI Integration" desc="FastAPI backend with Google Gemini AI for deep content analysis. Structured output, confidence scores, and source-grounded findings." status="Complete" color="amber" />
          <FeatureCard icon={FileText} title="PDF Report Export" desc="Generate comprehensive review reports with findings, decisions, severity levels, and audit trail. One-click download." status="Complete" color="green" />
          <FeatureCard icon={Eye} title="Dark Mode & Responsive" desc="Full dark mode toggle, mobile-responsive layout, keyboard accessibility, and reduced-motion support." status="Complete" color="teal" />
          <FeatureCard icon={Layers} title="Landing Page" desc="Premium marketing-quality landing page with animated hero, feature showcase, capability demos, and responsible AI messaging." status="Complete" color="purple" />
          <FeatureCard icon={Sparkles} title="Dual Review Engine" desc="Deterministic client-side rules engine + server-side Gemini AI review, running independently with unified results display." status="Complete" color="amber" />
          <FeatureCard icon={Lock} title="Privacy Controls" desc="Sensitive data masking toggle, no automatic content sharing, API key isolation in backend .env, human-only publishing." status="Complete" color="green" />
        </motion.div>
      </section>

      {/* ─── Technology Stack ─── */}
      <section className="section sub-tech-section">
        <div className="container">
          <div className="sub-section-header">
            <span className="kicker light">TECHNOLOGY & IMPLEMENTATION</span>
            <h2>How it's <span>built</span></h2>
            <p>Modern stack, real AI integration, production-ready architecture patterns.</p>
          </div>

          <div className="sub-tech-grid">
            <div className="sub-tech-card">
              <div className="sub-tech-icon"><Globe size={24} /></div>
              <h3>Frontend</h3>
              <ul>
                <li><strong>React 18</strong> — Component architecture</li>
                <li><strong>Vite 5</strong> — Build tooling & HMR</li>
                <li><strong>Framer Motion</strong> — Animations</li>
                <li><strong>Recharts</strong> — Data visualization</li>
                <li><strong>Lucide React</strong> — Icon system</li>
                <li><strong>jsPDF</strong> — Report generation</li>
              </ul>
            </div>
            <div className="sub-tech-card">
              <div className="sub-tech-icon"><Cpu size={24} /></div>
              <h3>Backend API</h3>
              <ul>
                <li><strong>FastAPI</strong> — High-performance Python API</li>
                <li><strong>Pydantic</strong> — Request/response validation</li>
                <li><strong>Uvicorn</strong> — ASGI server</li>
                <li><strong>CORS</strong> — Secure cross-origin setup</li>
                <li><strong>python-dotenv</strong> — Env configuration</li>
              </ul>
            </div>
            <div className="sub-tech-card">
              <div className="sub-tech-icon"><Brain size={24} /></div>
              <h3>AI Integration</h3>
              <ul>
                <li><strong>Google Gemini 3.8 Flash</strong> — Content analysis</li>
                <li><strong>Structured Output</strong> — JSON schema validation</li>
                <li><strong>System Instructions</strong> — Brand review persona</li>
                <li><strong>Temperature 0.2</strong> — Consistent, reliable results</li>
                <li><strong>Source grounding</strong> — Cite or flag for human review</li>
              </ul>
            </div>
            <div className="sub-tech-card">
              <div className="sub-tech-icon"><Shield size={24} /></div>
              <h3>Architecture</h3>
              <ul>
                <li><strong>Dual review engine</strong> — Client + AI</li>
                <li><strong>Human-in-the-loop</strong> — No auto-publishing</li>
                <li><strong>API key isolation</strong> — Backend .env only</li>
                <li><strong>Role-based access</strong> — Permission-gated actions</li>
                <li><strong>Audit trail</strong> — Every decision logged</li>
              </ul>
            </div>
          </div>

          <div className="sub-arch-diagram">
            <h3>System Architecture</h3>
            <div className="sub-arch-flow">
              <div className="sub-arch-node user">
                <Users size={20} />
                <span>Content Creator</span>
              </div>
              <ArrowRight size={18} className="sub-arch-arrow" />
              <div className="sub-arch-node frontend">
                <Globe size={20} />
                <span>React Frontend</span>
                <small>Vite · Framer Motion</small>
              </div>
              <ArrowRight size={18} className="sub-arch-arrow" />
              <div className="sub-arch-node engine">
                <Layers size={20} />
                <span>Review Engines</span>
                <small>Rules + Gemini AI</small>
              </div>
              <ArrowRight size={18} className="sub-arch-arrow" />
              <div className="sub-arch-node backend">
                <Cpu size={20} />
                <span>FastAPI Backend</span>
                <small>Pydantic · CORS</small>
              </div>
              <ArrowRight size={18} className="sub-arch-arrow" />
              <div className="sub-arch-node ai">
                <Brain size={20} />
                <span>Gemini AI</span>
                <small>Structured Output</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Progress from Round 1 ─── */}
      <section className="section container">
        <div className="sub-section-header">
          <span className="kicker">PROGRESS FROM ROUND 1</span>
          <h2>Evolution from <span className="gradient-text">proposal to product</span></h2>
          <p>Clear development trajectory from initial concept to working prototype with AI integration.</p>
        </div>

        <div className="sub-timeline">
          <TimelineItem
            round="ROUND 1"
            title="Initial Proposal"
            items={[
              'Concept: AI-powered brand content review platform',
              'Identified problem: brands lack automated content governance',
              'Proposed solution: rule-based + AI review with human oversight',
              'Defined core features: review workspace, knowledge base, audit log',
              'Selected tech stack: React, FastAPI, Gemini AI',
            ]}
          />
          <TimelineItem
            round="ROUND 2"
            title="Working Prototype"
            active
            items={[
              '✅ Full professional UI with landing page, dark mode, and responsive design',
              '✅ Complete review workspace with inline flagging, suggestions, and decisions',
              '✅ Brand knowledge base with CRUD operations and search',
              '✅ Insights dashboard with interactive Recharts visualizations',
              '✅ Audit log with chronological decision tracking',
              '✅ AI transparency panel with full disclosure',
              '✅ Role-based access control (Creator, Reviewer, Manager, Admin)',
              '✅ PDF report export with jsPDF',
              '✅ FastAPI backend with Gemini AI integration',
              '✅ Dual review engine — deterministic rules + AI analysis',
              '✅ Backend health check and connection status indicator',
            ]}
          />
          <TimelineItem
            round="ROUND 3"
            title="Enterprise Scaling & Multi-Modal Governance"
            active
            items={[
              '✅ Feature 1: RAG-Powered Knowledge Base & Document Ingestion (PDF/DOCX, sliding-window chunking, Gemini text-embedding-004, pluggable VectorStore)',
              '✅ Feature 2: Multi-User Collaboration & Enterprise Authentication (JWT httpOnly cookies, RBAC, WebSockets presence & co-editing, threaded inline comments, approval workflow, Slack/Teams webhooks, immutable audit trail)',
              '✅ Feature 3: Visual & Multi-Modal Brand Governance (CIEDE2000 ΔE₀₀ color distance, k-means palette clustering, WCAG 2.1 AA/AAA contrast checks, Gemini Vision logo integrity & bounding boxes)',
            ]}
          />
        </div>


        <div className="sub-changes-section">
          <h3><Wrench size={20} /> Changes from Original Plan</h3>
          <div className="sub-changes-grid">
            {[
              ['AI Model Upgrade', 'Switched to Google Gemini 3.8 Flash for superior structured output support, lower latency, and zero hallucinated schema.', 'Technical improvement'],
              ['Dual Engine Architecture', 'Added deterministic client-side rules engine alongside Gemini AI, ensuring the app works even without the AI backend.', 'Reliability improvement'],
              ['Frontend-First Approach', 'Built a complete, functional frontend before AI integration, ensuring the core workflow works independently.', 'Architecture decision'],
              ['Demo Data Strategy', 'Created comprehensive Acme CloudSync sample data instead of requiring real brand accounts during demo.', 'UX improvement'],
            ].map(([title, desc, tag]) => (
              <div className="sub-change-card" key={title}>
                <span className="tag subtle">{tag}</span>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Round 3 Improvements ─── */}
      <section className="section sub-r3-section">
        <div className="container">
          <div className="sub-section-header">
            <span className="kicker light">ALL THREE ROADMAP FEATURES DELIVERED</span>
            <h2>Round 3 <span>Completed Deliverables</span></h2>
            <p>Three production-ready features significantly elevating BrandGuard from prototype to enterprise-ready platform.</p>

          </div>

          <div className="sub-r3-grid">
            <motion.div className="sub-r3-card" whileHover={{ y: -5 }}>
              <div className="sub-r3-number">01</div>
              <div className="sub-r3-icon"><Database size={32} /></div>
              <h3>RAG-Powered Knowledge Base</h3>
              <p className="sub-r3-desc">
                Replace the static rules array with a Retrieval-Augmented Generation pipeline. Users upload brand guideline PDFs, style guides, and policy documents. The system chunks and embeds them with Gemini embeddings, stores vectors in a database, and retrieves relevant rules contextually during review — enabling accurate analysis against hundreds of real policies, not just demo rules.
              </p>
              <div className="sub-r3-tech">
                <span>Gemini Embeddings</span>
                <span>Vector DB</span>
                <span>PDF Parsing</span>
                <span>Semantic Search</span>
              </div>
              <div className="sub-r3-impact">
                <TrendingUp size={14} /> <strong>Impact:</strong> Transforms the product from a demo into a tool that works with any brand's actual policies
              </div>
            </motion.div>

            <motion.div className="sub-r3-card" whileHover={{ y: -5 }}>
              <div className="sub-r3-number">02</div>
              <div className="sub-r3-icon"><Network size={32} /></div>
              <h3>Multi-User Collaboration & Auth</h3>
              <p className="sub-r3-desc">
                Add real authentication (OAuth/JWT), persistent server-side storage (PostgreSQL), and multi-user collaboration. Team members can be assigned reviews, leave threaded comments, track review status across the organization, receive notifications, and maintain separate brand workspaces — moving from single-browser prototype to a production-ready multi-tenant platform.
              </p>
              <div className="sub-r3-tech">
                <span>OAuth 2.0</span>
                <span>PostgreSQL</span>
                <span>WebSocket</span>
                <span>Multi-tenant</span>
              </div>
              <div className="sub-r3-impact">
                <TrendingUp size={14} /> <strong>Impact:</strong> Enables real team usage with persistent data, proper security, and organizational workflows
              </div>
            </motion.div>

            <motion.div className="sub-r3-card" whileHover={{ y: -5 }}>
              <div className="sub-r3-number">03</div>
              <div className="sub-r3-icon"><Workflow size={32} /></div>
              <h3>Visual & Multi-Modal Review</h3>
              <p className="sub-r3-desc">
                Extend AI review beyond text to analyze images, social media graphics, and presentation slides. Gemini's multi-modal capabilities check logo usage, colour compliance, visual accessibility (contrast ratios, text readability), and image-text consistency — ensuring brand standards are maintained across all content formats, not just written copy.
              </p>
              <div className="sub-r3-tech">
                <span>Gemini Vision</span>
                <span>Image Analysis</span>
                <span>Color Detection</span>
                <span>WCAG Compliance</span>
              </div>
              <div className="sub-r3-impact">
                <TrendingUp size={14} /> <strong>Impact:</strong> Complete brand governance covering visual identity, not just written content
              </div>
            </motion.div>
          </div>
        </div>
      </section>



      {/* ─── Links Footer ─── */}
      <section className="sub-final-cta">
        <div className="container">
          <div className="sub-final-inner">
            <div className="sub-final-glow" />
            <span className="kicker light">READY TO EXPLORE</span>
            <h2>Experience BrandGuard</h2>
            <p>Click below to explore the full working product or view the source code.</p>
            <div className="sub-final-buttons">
              <button className="btn white" onClick={() => goTo('review')}>
                <ScanSearch size={17} /> Open Live Demo <ArrowRight size={16} />
              </button>
              <a className="btn secondary" href="https://github.com/akashrajput78616-maker/BrandGuard-AI-Integration" target="_blank" rel="noopener noreferrer" style={{ background: 'transparent', color: '#fff', borderColor: '#ffffff40' }}>
                <GitBranch size={17} /> GitHub Repository <ExternalLink size={14} />
              </a>
            </div>
            <div className="sub-final-meta">
              <span>Built by Akash Rajput</span>
              <span>•</span>
              <span>Inkloom AI Hackathon 2026</span>
              <span>•</span>
              <span>React · FastAPI · Gemini AI</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
