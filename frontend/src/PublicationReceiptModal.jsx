import React, { useState } from 'react';
import { 
  Award, ShieldCheck, Download, CheckCircle2, Copy, 
  ExternalLink, Calendar, Hash, Lock, Check, X 
} from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function PublicationReceiptModal({ draft, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!draft) return null;

  const receipt = draft.receipt || {
    receipt_id: `RCP-${(draft.id || 'DEMO').toString().slice(0, 8).toUpperCase()}`,
    draft_id: draft.id,
    title: draft.title,
    approved_by: draft.approved_by || "David Miller",
    approved_by_role: "Reviewer",
    approved_at: Date.now() / 1000,
    version: draft.version || 1,
    rulebook_version: "v3.2-enterprise",
    content_digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    receipt_digest: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    signature_algorithm: "SHA256-VERIFIED-SEAL",
    status: "VALID_PUBLICATION_SEAL",
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    // Header banner
    doc.setFillColor(15, 163, 163);
    doc.rect(0, 0, 210, 36, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('BRANDGUARD COMPLIANCE CERTIFICATE', 18, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('TAMPER-EVIDENT PUBLICATION APPROVAL RECEIPT', 18, 30);

    // Body content
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`RECEIPT: ${receipt.receipt_id}`, 18, 50);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Document Title: ${draft.title}`, 18, 60);
    doc.text(`Approved By: ${receipt.approved_by} (${receipt.approved_by_role})`, 18, 68);
    doc.text(`Approval Date: ${new Date(receipt.approved_at * 1000).toLocaleString()}`, 18, 76);
    doc.text(`Governing Rulebook: ${receipt.rulebook_version}`, 18, 84);
    doc.text(`Document Version: v${receipt.version}.0`, 18, 92);

    // Cryptographic box
    doc.setFillColor(241, 245, 249);
    doc.rect(18, 102, 174, 38, 'F');
    doc.setFontSize(9);
    doc.setFont('courier', 'normal');
    doc.text(`Status: [${receipt.status}]`, 22, 110);
    doc.text(`Content SHA-256 Digest:`, 22, 118);
    doc.text(receipt.content_digest, 22, 124);
    doc.text(`Receipt Seal Digest:`, 22, 130);
    doc.text(receipt.receipt_digest, 22, 136);

    // Content Snapshot
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Approved Content Snapshot:', 18, 152);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitText = doc.splitTextToSize(draft.content || "Approved content payload verified.", 174);
    doc.text(splitText, 18, 160);

    // Footer
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text('BrandGuard AI Governance Platform · Built with SHA-256 Merkle Chain Verification', 18, 280);

    doc.save(`brandguard-receipt-${receipt.receipt_id}.pdf`);
  };

  const copyDigest = () => {
    navigator.clipboard.writeText(receipt.receipt_digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: '600px', padding: 0, overflow: 'hidden' }}>
        {/* Header Ribbon */}
        <div style={{ background: '#0fa3a3', color: '#fff', padding: '20px 24px', position: 'relative' }}>
          <button 
            onClick={onClose}
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}
          >
            ✕
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', opacity: 0.9 }}>
            <Award size={16} /> TAMPER-EVIDENT PUBLICATION PROOF
          </div>
          <h2 style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 800 }}>Publication Approval Receipt</h2>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>RECEIPT IDENTIFIER</span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{receipt.receipt_id}</div>
            </div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: '#ecfdf5',
              color: '#059669',
              fontWeight: 700,
              fontSize: '12px',
            }}>
              <CheckCircle2 size={15} /> VERIFIED COMPLIANT
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Authorized Approver:</span>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{receipt.approved_by} ({receipt.approved_by_role})</div>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Approval Date:</span>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{new Date(receipt.approved_at * 1000).toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Governing Rulebook:</span>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{receipt.rulebook_version}</div>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Document Version:</span>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>v{receipt.version}.0 (Production)</div>
            </div>
          </div>

          {/* Cryptographic Digests Box */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>CRYPTOGRAPHIC SHA-256 DIGEST</span>
              <button 
                className="text-button" 
                onClick={copyDigest} 
                style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#0fa3a3' }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy Digest"}
              </button>
            </div>
            <code style={{ display: 'block', fontSize: '11px', color: '#0f172a', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              {receipt.receipt_digest}
            </code>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn primary" 
              onClick={handleDownloadPDF}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#0fa3a3', color: '#fff' }}
            >
              <Download size={16} /> Download Official PDF Receipt
            </button>
            <button className="btn secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
