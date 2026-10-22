# BrandGuard — Professional Brand Governance Prototype

A responsive React + Vite hackathon prototype for reviewing content against approved brand rules. Includes a premium landing page, dashboard, brand knowledge base, review workspace, insights charts, audit log, AI transparency panel, role switcher, dark mode, sample Acme CloudSync drafts, and PDF report export.

## Requirements
- Node.js 18 or newer
- npm

## Run on Windows (PowerShell)
1. Extract the ZIP.
2. Open the **inner `brandguard` folder** in VS Code. This is the folder containing `package.json`.
3. Open Terminal → New Terminal. Confirm the terminal path ends with `BrandGuard-Professional\brandguard` (or just `brandguard`).
4. Run:

```powershell
npm.cmd install
npm.cmd run dev
```

5. Open the local URL Vite prints, usually `http://localhost:5173/`.

If PowerShell is in the outer folder, enter the project folder first:

```powershell
cd .\brandguard
```

## Demo walkthrough
- Landing page: explore the brand governance concept and features.
- Open workspace: switch between Dashboard, Knowledge base, Review workspace, Insights, Audit log and AI transparency.
- In Review workspace, select one of the Acme CloudSync sample drafts, inspect findings and source rules, accept/edit/dismiss findings, add comments, and export a PDF report.
- Switch roles using the role selector. Approval is limited to Reviewer, Manager and Admin roles; findings must be resolved before approval.
- Use Admin role to add/edit guideline entries.

## Libraries
- React 18 / React DOM
- Vite 5
- Framer Motion
- Lucide React
- Recharts
- jsPDF

## AI / hackathon disclosure
This version uses a deterministic client-side demo rules engine and fictional Acme CloudSync sample data. It does not call an external LLM or send content to external AI services. The findings and confidence values are demonstration values, not validated model outputs. No real authentication, tenant isolation, server-side storage, encryption service, or production RAG backend is included. Local browser storage is used for prototype persistence. Human approval remains part of the demo workflow; it does not publish content externally.
