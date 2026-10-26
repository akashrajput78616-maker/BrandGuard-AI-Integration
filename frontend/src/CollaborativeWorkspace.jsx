import React, { useState, useEffect, useRef } from 'react';
import {
  Users, MessageSquare, CheckCircle2, XCircle, Clock, Send, Check, AlertTriangle,
  Radio, Shield, Bell, Settings, CornerDownRight, Plus, RefreshCw, X
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { API_BASE, getWebSocketUrl } from './brandguardApi';

export default function CollaborativeWorkspace({ draft, onUpdateContent, onStatusChange }) {
  const { user, token, isReviewer, isEditor, isViewer } = useAuth();
  const [collaborators, setCollaborators] = useState([]);
  const [comments, setComments] = useState([]);
  const [filterResolved, setFilterResolved] = useState(false);
  const [selectedTextRange, setSelectedTextRange] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTexts, setReplyTexts] = useState({});
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [webhooksModalOpen, setWebhooksModalOpen] = useState(false);
  const [webhooks, setWebhooks] = useState([]);
  const [newWebhookPlatform, setNewWebhookPlatform] = useState('slack');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [serverWakingUp, setServerWakingUp] = useState(false);
  const wsRef = useRef(null);
  const editorRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const healthPingIntervalRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

  const draftId = draft?.id || 'draft-1';

  // 1. Establish real-time WebSocket connection with exponential backoff & cold-start wake-up
  useEffect(() => {
    let isMounted = true;

    const triggerHealthPing = () => {
      if (healthPingIntervalRef.current) return;
      const ping = async () => {
        try {
          const res = await fetch(`${API_BASE}/health`, { credentials: 'include' });
          if (res.ok && isMounted) {
            setServerWakingUp(false);
            if (healthPingIntervalRef.current) {
              clearInterval(healthPingIntervalRef.current);
              healthPingIntervalRef.current = null;
            }
          }
        } catch (_) {
          // Container still spinning up
        }
      };
      ping();
      healthPingIntervalRef.current = setInterval(ping, 5000);
    };

    const connectWebSocket = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      const path = `/ws/drafts/${draftId}?token=${encodeURIComponent(token || '')}`;
      const wsUrl = getWebSocketUrl(path);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // If connection takes > 3.5s, backend is likely cold-starting on Render free tier
        const coldStartTimer = setTimeout(() => {
          if (isMounted && ws.readyState !== WebSocket.OPEN) {
            setServerWakingUp(true);
            triggerHealthPing();
          }
        }, 3500);

        ws.onopen = () => {
          clearTimeout(coldStartTimer);
          if (!isMounted) return;
          setWsConnected(true);
          setServerWakingUp(false);
          reconnectAttemptRef.current = 0;
          if (healthPingIntervalRef.current) {
            clearInterval(healthPingIntervalRef.current);
            healthPingIntervalRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'presence') {
              setCollaborators(msg.users || []);
            } else if (msg.type === 'content_change') {
              if (msg.content && msg.content !== draft?.content) {
                onUpdateContent(msg.content);
              }
            } else if (msg.type === 'status_change') {
              if (msg.status && onStatusChange) {
                onStatusChange(msg.status);
              }
            } else if (msg.type === 'comment_event') {
              loadComments();
            }
          } catch (e) {
            console.warn('WS message parse error:', e);
          }
        };

        ws.onerror = () => {
          if (isMounted && reconnectAttemptRef.current > 0) {
            setServerWakingUp(true);
            triggerHealthPing();
          }
        };

        ws.onclose = () => {
          clearTimeout(coldStartTimer);
          if (!isMounted) return;
          setWsConnected(false);

          // Exponential backoff: 1.5s, 3s, 6s, 12s, capped at 15s
          reconnectAttemptRef.current += 1;
          const delay = Math.min(1500 * Math.pow(2, reconnectAttemptRef.current - 1), 15000);
          if (reconnectAttemptRef.current >= 2) {
            setServerWakingUp(true);
            triggerHealthPing();
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) connectWebSocket();
          }, delay);
        };
      } catch (e) {
        console.warn('WebSocket connection error:', e);
        if (isMounted) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 4000);
        }
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (healthPingIntervalRef.current) clearInterval(healthPingIntervalRef.current);
    };
  }, [draftId, token]);

  // 2. Load threaded comments
  const loadComments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/drafts/${draftId}/comments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (e) {
      console.warn('Error loading comments:', e);
    }
  };

  useEffect(() => {
    loadComments();
  }, [draftId]);

  // 3. Load Webhooks
  const loadWebhooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/webhooks`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks || []);
      }
    } catch (e) {
      console.warn('Error loading webhooks:', e);
    }
  };

  // 4. Handle text selection to anchor inline comments
  const handleEditorMouseUp = (e) => {
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (end > start && end - start > 2) {
      const selected = textarea.value.substring(start, end);
      setSelectedTextRange({
        startOffset: start,
        endOffset: end,
        selectedText: selected,
      });
    } else {
      setSelectedTextRange(null);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedTextRange) return;

    try {
      const res = await fetch(`${API_BASE}/api/drafts/${draftId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          start_offset: selectedTextRange.startOffset,
          end_offset: selectedTextRange.endOffset,
          selected_text: selectedTextRange.selectedText,
          comment: newCommentText,
        }),
      });

      if (res.ok) {
        setNewCommentText('');
        setSelectedTextRange(null);
        loadComments();
      }
    } catch (err) {
      alert(`Comment failed: ${err.message}`);
    }
  };

  const handleAddReply = async (commentId) => {
    const text = replyTexts[commentId];
    if (!text?.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/drafts/${draftId}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ comment: text }),
      });
      if (res.ok) {
        setReplyTexts((prev) => ({ ...prev, [commentId]: '' }));
        loadComments();
      }
    } catch (e) {
      alert(`Reply error: ${e.message}`);
    }
  };

  const handleToggleResolve = async (commentId) => {
    try {
      const res = await fetch(`${API_BASE}/api/drafts/${draftId}/comments/${commentId}/resolve`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        loadComments();
      }
    } catch (e) {
      alert(`Resolve toggle failed: ${e.message}`);
    }
  };

  // 5. State transitions (Approval Queues)
  const handleTransition = async (status, reason = null) => {
    try {
      const res = await fetch(`${API_BASE}/api/drafts/${draftId}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        if (onStatusChange) onStatusChange(status);
        setRejectModalOpen(false);
        setRejectionReason('');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Status change failed: ${err.detail || 'Unauthorized'}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleRegisterWebhook = async (e) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          platform: newWebhookPlatform,
          url: newWebhookUrl,
        }),
      });
      if (res.ok) {
        setNewWebhookUrl('');
        loadWebhooks();
      }
    } catch (e) {
      alert(`Webhook registration failed: ${e.message}`);
    }
  };

  const visibleComments = comments.filter((c) => (filterResolved ? true : !c.resolved));

  return (
    <div className="collaborative-workspace-container">
      {serverWakingUp && (
        <div
          className="server-wakeup-banner"
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#1e40af',
            fontSize: '0.85rem',
            lineHeight: 1.4,
          }}
        >
          <RefreshCw size={15} className="spin-icon" style={{ flexShrink: 0, color: '#2563eb' }} />
          <div>
            <strong>Waking up backend server...</strong> Render free tier spins down after inactivity (~30–50s cold start). Reconnecting automatically in background.
          </div>
        </div>
      )}
      {/* ── Real-time Top Bar (Presence & Approval Queues) ── */}
      <div className="collab-top-bar">
        {/* Presence Indicators */}
        <div className="presence-avatars-wrap">
          <span className="presence-label">
            <Radio size={14} className={wsConnected ? 'spin-icon' : ''} style={{ color: wsConnected ? '#10b981' : '#64748b' }} />
            {wsConnected ? 'LIVE COLLABORATION' : 'LOCAL MODE'}
          </span>
          <div className="presence-stack">
            {collaborators.length > 0 ? (
              collaborators.map((c, i) => (
                <div
                  key={c.user_id || i}
                  className="collab-avatar-pill"
                  title={`${c.name} (${c.role})`}
                >
                  <div className="avatar-circle" style={{ backgroundColor: c.color || '#0fa3a3' }}>
                    {c.name ? c.name[0] : 'U'}
                  </div>
                  <span className="online-dot" />
                </div>
              ))
            ) : (
              <div className="collab-avatar-pill" title={`${user?.name || 'You'} (${user?.role || 'Admin'})`}>
                <div className="avatar-circle" style={{ backgroundColor: '#0fa3a3' }}>
                  {user?.name ? user.name[0] : 'A'}
                </div>
                <span className="online-dot" />
              </div>
            )}
          </div>
          <small className="muted-text">
            Logged in as <strong>{user?.name}</strong> ({user?.role})
          </small>
        </div>

        {/* Role-Based Approval Queue Controls */}
        <div className="workflow-queue-box">
          <span
            className={`queue-badge ${
              draft.status === 'Approved'
                ? 'approved'
                : draft.status === 'Rejected'
                ? 'rejected'
                : draft.status === 'In Review'
                ? 'in-review'
                : 'draft'
            }`}
          >
            {draft.status === 'Approved' ? (
              <CheckCircle2 size={13} />
            ) : draft.status === 'Rejected' ? (
              <XCircle size={13} />
            ) : (
              <Clock size={13} />
            )}
            Status: {draft.status}
          </span>

          <div className="queue-actions">
            {draft.status === 'Draft' && (
              <button
                className="btn primary small"
                disabled={isViewer}
                onClick={() => handleTransition('In Review')}
              >
                Submit for Review
              </button>
            )}

            {draft.status === 'In Review' && (
              <>
                <button
                  className="btn primary small"
                  style={{ background: '#2e9e6b' }}
                  disabled={!isReviewer}
                  title={!isReviewer ? 'Only Reviewer or Admin can approve' : ''}
                  onClick={() => handleTransition('Approved')}
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  className="btn secondary small"
                  style={{ borderColor: '#d64545', color: '#d64545' }}
                  disabled={!isReviewer}
                  title={!isReviewer ? 'Only Reviewer or Admin can reject' : ''}
                  onClick={() => setRejectModalOpen(true)}
                >
                  <X size={14} /> Reject
                </button>
              </>
            )}

            {draft.status === 'Approved' && (
              <span className="tag green">✓ Publication Authorized</span>
            )}

            {/* Webhook Notifications Config Button */}
            <button
              className="iconbtn"
              onClick={() => {
                loadWebhooks();
                setWebhooksModalOpen(true);
              }}
              title="Configure Slack & Microsoft Teams Webhooks"
            >
              <Bell size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Selection Action: Floating Inline Comment Trigger ── */}
      {selectedTextRange && (
        <div className="floating-comment-btn" onClick={() => {}}>
          <MessageSquare size={13} /> Anchor comment to “{selectedTextRange.selectedText.substring(0, 20)}...”
        </div>
      )}

      {/* ── Threaded Inline Review Comments Panel ── */}
      <div className="comments-panel-wrap">
        <div className="comments-panel-header">
          <div>
            <strong>Threaded Review Comments</strong>
            <small style={{ display: 'block', color: '#64748b' }}>
              Select any phrase in the editor to anchor an inline review thread.
            </small>
          </div>
          <div className="comments-filter-tabs">
            <button
              className={`filter-tab ${!filterResolved ? 'active' : ''}`}
              onClick={() => setFilterResolved(false)}
            >
              Open ({comments.filter((c) => !c.resolved).length})
            </button>
            <button
              className={`filter-tab ${filterResolved ? 'active' : ''}`}
              onClick={() => setFilterResolved(true)}
            >
              All ({comments.length})
            </button>
          </div>
        </div>

        {/* Anchored comment composer if text is selected */}
        {selectedTextRange && (
          <form onSubmit={handleAddComment} className="comment-composer">
            <blockquote className="comment-quoted-text">
              “{selectedTextRange.selectedText}”
            </blockquote>
            <input
              type="text"
              placeholder={`Add an anchored comment as ${user?.name}...`}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setSelectedTextRange(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary small"
                disabled={!newCommentText.trim()}
              >
                Post Comment
              </button>
            </div>
          </form>
        )}

        {/* Comments List */}
        <div className="comments-list">
          {visibleComments.length === 0 ? (
            <p className="muted-text" style={{ fontSize: 13 }}>
              {filterResolved ? 'No comments on this draft.' : 'No open comments. Highlight text in the draft to anchor a comment.'}
            </p>
          ) : (
            visibleComments.map((c) => (
              <div key={c.id} className={`threaded-comment-card ${c.resolved ? 'resolved' : ''}`}>
                <div className="comment-author-row">
                  <div className="author-info">
                    <strong>{c.author_name}</strong>
                    <span className="author-role-badge">{c.author_role}</span>
                  </div>
                  {c.resolved && <span className="tag green">Resolved</span>}
                </div>

                <blockquote className="comment-quoted-text">
                  “{c.selected_text}”
                </blockquote>

                <p className="comment-body-text">{c.comment}</p>

                {/* Replies */}
                {c.replies?.length > 0 && (
                  <div className="comment-replies-list">
                    {c.replies.map((r, ri) => (
                      <div key={r.id || ri} className="reply-card">
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <strong>{r.author_name}</strong>
                          <span className="author-role-badge">{r.author_role}</span>
                        </div>
                        <p style={{ margin: '4px 0 0', color: '#334155' }}>{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply composer */}
                {!c.resolved && (
                  <div className="reply-input-row">
                    <input
                      type="text"
                      placeholder="Write a reply..."
                      value={replyTexts[c.id] || ''}
                      onChange={(e) =>
                        setReplyTexts((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddReply(c.id);
                      }}
                    />
                    <button
                      className="iconbtn"
                      onClick={() => handleAddReply(c.id)}
                      disabled={!replyTexts[c.id]?.trim()}
                      title="Send Reply"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                )}

                <div className="comment-actions-bar">
                  <span>{new Date(c.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <button
                    className="resolve-btn"
                    onClick={() => handleToggleResolve(c.id)}
                  >
                    <Check size={12} /> {c.resolved ? 'Reopen Thread' : 'Resolve Thread'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Rejection Modal ── */}
      {rejectModalOpen && (
        <div className="modal-backdrop" onClick={() => setRejectModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h2>Reject Draft with Governance Feedback</h2>
              <button className="iconbtn" onClick={() => setRejectModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Please specify the brand guideline or policy violation that requires revision.
            </p>
            <textarea
              style={{ width: '100%', minHeight: 90, marginTop: 8 }}
              placeholder="e.g. Unsubstantiated performance claims violate Claims Policy §3.2..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn secondary" onClick={() => setRejectModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                style={{ background: '#d64545' }}
                onClick={() => handleTransition('Rejected', rejectionReason)}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Webhooks Modal (Slack & Microsoft Teams) ── */}
      {webhooksModalOpen && (
        <div className="modal-backdrop" onClick={() => setWebhooksModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h2>Slack &amp; Microsoft Teams Webhooks</h2>
              <button className="iconbtn" onClick={() => setWebhooksModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Receive instant channel notifications for review requests, inline comments, and approval decisions. Includes exponential backoff retries.
            </p>

            <form onSubmit={handleRegisterWebhook} style={{ marginTop: 14, display: 'flex', gap: 8, flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={newWebhookPlatform}
                  onChange={(e) => setNewWebhookPlatform(e.target.value)}
                  style={{ width: 140 }}
                >
                  <option value="slack">Slack</option>
                  <option value="teams">MS Teams</option>
                </select>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/... or https://outlook.office.com/webhook/..."
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
              </div>
              <button type="submit" className="btn primary small" style={{ alignSelf: 'flex-start' }}>
                <Plus size={14} /> Add Webhook
              </button>
            </form>

            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4>Configured Webhook Channels ({webhooks.length})</h4>
              {webhooks.length === 0 ? (
                <p className="muted-text">No webhook integrations configured for this organization.</p>
              ) : (
                webhooks.map((w) => (
                  <div key={w.id} className="webhook-card">
                    <div>
                      <span className={`webhook-platform-pill ${w.platform}`}>{w.platform}</span>
                      <small style={{ marginLeft: 8, color: '#64748b' }}>{w.url.substring(0, 45)}...</small>
                    </div>
                    <span className="tag green">Active (Retries Enabled)</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
