import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, Trash2, RefreshCw, Eye, CheckCircle2, AlertTriangle,
  Clock, Search, Layers, BookOpen, ShieldCheck, Database, Sparkles, X, ChevronRight
} from 'lucide-react';
import { API_BASE } from './brandguardApi';

export default function KnowledgeBaseRAG({ tenantId = 'default-tenant', role = 'Admin' }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [testingRAG, setTestingRAG] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const isAdmin = role === 'Admin' || role === 'Manager';

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/documents?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.warn('Failed to load documents from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const handleFileUpload = async (file) => {
    if (!file) return;
    const allowed = ['pdf', 'docx', 'doc', 'txt'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      alert('Supported formats: PDF, DOCX, TXT');
      return;
    }

    setUploading(true);
    setUploadProgress(15);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenant_id', tenantId);

    try {
      const pInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 300);

      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(pInterval);
      setUploadProgress(100);

      if (res.ok) {
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          loadDocuments();
        }, 600);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Upload error: ${err.detail || 'Could not process file'}`);
        setUploading(false);
      }
    } catch (error) {
      alert(`Network error during upload: ${error.message}`);
      setUploading(false);
    }
  };

  const handleDelete = async (docId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this guideline document and its vector embeddings?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/documents/${docId}?tenant_id=${tenantId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDocuments((docs) => docs.filter((d) => d.id !== docId));
        if (selectedDoc?.id === docId) setSelectedDoc(null);
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleReindex = async (docId, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/documents/${docId}/reindex?tenant_id=${tenantId}`, {
        method: 'POST',
      });
      if (res.ok) {
        loadDocuments();
      }
    } catch (err) {
      alert(`Re-index failed: ${err.message}`);
    }
  };

  const viewChunks = async (doc) => {
    setSelectedDoc(doc);
    setLoadingChunks(true);
    try {
      const res = await fetch(`${API_BASE}/api/documents/${doc.id}/chunks?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setChunks(data.chunks || []);
      }
    } catch (err) {
      console.warn('Error fetching chunks:', err);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleTestSearch = async (e) => {
    e.preventDefault();
    if (!testQuery.trim()) return;
    setTestingRAG(true);
    setTestResults(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/rag/search?query=${encodeURIComponent(testQuery)}&tenant_id=${tenantId}&top_k=4`
      );
      if (res.ok) {
        const data = await res.json();
        setTestResults(data.results || []);
      }
    } catch (err) {
      alert(`Search error: ${err.message}`);
    } finally {
      setTestingRAG(false);
    }
  };

  const filteredDocs = documents.filter((d) =>
    (d.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="rag-kb-container">
      {/* Header bar */}
      <div className="rag-header">
        <div>
          <span className="kicker">RAG VECTOR KNOWLEDGE BASE</span>
          <h2>Enterprise Guideline Ingestion</h2>
          <p>
            Upload official PDF and DOCX brand policies. Documents are chunked, embedded with Gemini, and indexed into PostgreSQL pgvector for grounded compliance reviews.
          </p>
        </div>
        <div className="rag-header-stats">
          <div className="stat-pill">
            <Database size={15} />
            <span>{documents.length} Documents</span>
          </div>
          <div className="stat-pill highlight">
            <Layers size={15} />
            <span>
              {documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0)} Vector Chunks
            </span>
          </div>
        </div>
      </div>

      {/* Upload Dropzone */}
      {isAdmin && (
        <div
          className={`rag-dropzone ${dragActive ? 'active' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            hidden
            accept=".pdf,.docx,.doc,.txt"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
          {uploading ? (
            <div className="upload-progress-box">
              <RefreshCw className="spin-icon" size={28} />
              <h4>Processing &amp; Chunking Guidelines...</h4>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <small>{uploadProgress}% completed — Parsing, Tokenizing, Gemini Embedding</small>
            </div>
          ) : (
            <div className="dropzone-prompt">
              <div className="upload-circle-icon">
                <Upload size={24} />
              </div>
              <h4>Drag &amp; drop brand guidelines here, or browse files</h4>
              <p>Supports enterprise PDF, Word DOCX, and TXT guidelines (up to 25MB)</p>
              <span className="badge-chip">Automated ~600 token sliding-window chunking</span>
            </div>
          )}
        </div>
      )}

      {/* Interactive Vector Search & Retrieval Tester */}
      <div className="rag-search-tester">
        <div className="tester-header">
          <div>
            <h4><Sparkles size={16} /> Test Semantic Retrieval (Grounded Search)</h4>
            <p>Query the pgvector index to inspect real-time chunk retrieval before review.</p>
          </div>
        </div>
        <form onSubmit={handleTestSearch} className="tester-form">
          <input
            type="text"
            placeholder="e.g., What are our policies on guarantees and zero data loss?"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
          />
          <button type="submit" className="btn primary small" disabled={testingRAG || !testQuery.trim()}>
            {testingRAG ? 'Searching…' : 'Retrieve Chunks'}
          </button>
        </form>

        {testResults && (
          <div className="test-results-list">
            <h5>Top {testResults.length} Grounded Matches:</h5>
            {testResults.length === 0 ? (
              <p className="muted-text">No relevant chunks passed the similarity threshold.</p>
            ) : (
              testResults.map((r, i) => (
                <div key={i} className="test-chunk-card">
                  <div className="test-chunk-meta">
                    <span className="chunk-heading"><BookOpen size={13} /> {r.heading || 'Section'}</span>
                    <span className="chunk-score">Cosine Score: {(r.score * 100).toFixed(1)}%</span>
                  </div>
                  <p className="chunk-content">{r.content}</p>
                  <small className="chunk-foot">Document: {r.document_name} · Page {r.page || 1}</small>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Documents Table List */}
      <div className="rag-table-wrapper">
        <div className="table-search-row">
          <div className="searchbox small">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search uploaded documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="iconbtn" onClick={loadDocuments} title="Refresh document list">
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
          </button>
        </div>

        <table className="rag-table">
          <thead>
            <tr>
              <th>DOCUMENT</th>
              <th>TYPE</th>
              <th>CHUNKS</th>
              <th>PARSE STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-table-cell">
                  {loading ? 'Loading documents...' : 'No brand guideline documents ingested yet.'}
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="doc-name-cell">
                      <FileText size={18} className="file-icon" />
                      <div>
                        <strong>{doc.filename}</strong>
                        <small>{(doc.file_size / 1024).toFixed(1)} KB</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="type-badge">{doc.file_type.toUpperCase()}</span>
                  </td>
                  <td>
                    <strong>{doc.chunk_count} chunks</strong>
                    {doc.token_count > 0 && <small> (~{doc.token_count} tokens)</small>}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        doc.status === 'indexed'
                          ? 'success'
                          : doc.status === 'failed'
                          ? 'error'
                          : 'progress'
                      }`}
                    >
                      {doc.status === 'indexed' ? (
                        <CheckCircle2 size={12} />
                      ) : doc.status === 'failed' ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <Clock size={12} />
                      )}
                      {doc.parse_status || doc.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="action-btn"
                        onClick={() => viewChunks(doc)}
                        title="View Extracted Chunks"
                      >
                        <Eye size={15} /> Chunks
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            className="action-btn"
                            onClick={(e) => handleReindex(doc.id, e)}
                            title="Re-index document"
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            className="action-btn danger"
                            onClick={(e) => handleDelete(doc.id, e)}
                            title="Delete document"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Drawer for Viewing Extracted Chunks */}
      {selectedDoc && (
        <div className="modal-backdrop" onClick={() => setSelectedDoc(null)}>
          <div className="modal-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="kicker">VECTOR CHUNK INSPECTOR</span>
                <h3>{selectedDoc.filename}</h3>
                <small>{chunks.length} chunks indexed in vector store</small>
              </div>
              <button className="iconbtn" onClick={() => setSelectedDoc(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="drawer-body">
              {loadingChunks ? (
                <div className="drawer-loading">
                  <RefreshCw className="spin-icon" size={24} />
                  <p>Loading document chunks...</p>
                </div>
              ) : chunks.length === 0 ? (
                <p className="muted-text">No chunks found for this document.</p>
              ) : (
                <div className="chunks-list">
                  {chunks.map((c, i) => (
                    <div key={c.id || i} className="chunk-preview-card">
                      <div className="chunk-header">
                        <span className="chunk-index">Chunk #{i + 1}</span>
                        <span className="chunk-section">§ {c.section_heading}</span>
                        <span className="chunk-tokens">{c.token_count} tokens</span>
                      </div>
                      <p className="chunk-text">{c.content}</p>
                      <div className="chunk-meta-foot">
                        <span>Page {c.page_number || 1}</span>
                        <span>Tenant: {c.tenant_id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
