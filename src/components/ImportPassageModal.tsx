import React, { useState, useEffect, CSSProperties } from 'react';
import { createPassage, updatePassage, movePassageToCollection } from '../lib/reader/passageStore';
import { ensureCollectionsHydrated, getAllCollections, createCollection } from '../lib/reader/collectionStore';
import type { Collection, Passage } from '../lib/reader/types';
import { authHeader } from '../lib/authHeader';

/**
 * Pulls a YouTube video ID straight out of the URL in the browser — no server
 * request at all. Deliberately duplicated from server.js's extractYoutubeVideoId
 * (kept there for the dormant caption-import endpoints) rather than shared,
 * since client and server code don't share a module boundary in this project.
 *
 * The video embeds and plays via YouTube's own official iframe player, which
 * is never blocked — unlike scraping the watch page or caption XML server-side,
 * which depends on the *server's* IP not being rate-limited/blocked by YouTube.
 * That's unreliable on shared-IP hosts (e.g. Replit), so this path avoids it
 * entirely: paste a link, get a working player + A/B loop, no fetch involved.
 */
function extractYoutubeVideoId(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }

  if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;

  if (u.hostname.endsWith('youtube.com')) {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const shortsMatch = u.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch) return shortsMatch[1];
  }

  return null;
}

interface ImportPassageModalProps {
  onClose: () => void;
  onCreated: (passage: Passage) => void;
  collectionId?: string;
  /** When set, the modal edits this passage's title/text instead of creating a new one. */
  editingPassage?: Passage;
}

const NEW_COLLECTION_OPTION = '__new__';

type SourceTab = 'text' | 'url' | 'youtube';

const ImportPassageModal: React.FC<ImportPassageModalProps> = ({ onClose, onCreated, collectionId, editingPassage }) => {
  const isEditing = !!editingPassage;
  const [tab, setTab] = useState<SourceTab>('text');
  const [title, setTitle] = useState(editingPassage?.title ?? '');
  const [rawText, setRawText] = useState(editingPassage?.rawText ?? '');
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState(editingPassage?.collectionId ?? collectionId ?? '');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    ensureCollectionsHydrated().then(() => setCollections(getAllCollections()));
  }, []);

  const handleCollectionChange = (value: string) => {
    if (value === NEW_COLLECTION_OPTION) {
      const name = window.prompt('Collection name (e.g. "NHK News", "Textbook Ch. 3"):');
      if (!name?.trim()) return;
      const created = createCollection(name.trim());
      setCollections(getAllCollections());
      setSelectedCollectionId(created.id);
      return;
    }
    setSelectedCollectionId(value);
  };
  // Seeded from editingPassage so editing a video passage's title doesn't
  // trip the "no content" guard in handleCreate — a video-only passage has
  // an empty rawText by design, videoId is what makes it valid.
  const [videoId, setVideoId] = useState<string | undefined>(editingPassage?.videoId);
  const [videoStatus, setVideoStatus] = useState('');

  const handleFetchUrl = async () => {
    if (!sourceUrl.trim()) {
      setError(tab === 'youtube' ? 'Enter a YouTube URL first.' : 'Enter a URL first.');
      return;
    }
    setError('');
    setVideoStatus('');
    setVideoId(undefined);

    if (tab === 'youtube') {
      const id = extractYoutubeVideoId(sourceUrl.trim());
      if (!id) {
        setError('Could not parse a YouTube video ID from this URL.');
        return;
      }
      setVideoId(id);

      // oEmbed is a public, CORS-enabled YouTube endpoint — hit directly from
      // the browser so title capture stays as server-free as the video link
      // itself. Best-effort: if it fails (network hiccup, CORS policy change),
      // just leave the title for the user to type themselves.
      let capturedTitle = false;
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl.trim())}&format=json`);
        if (res.ok) {
          const data = await res.json();
          if (data.title) {
            setTitle(data.title);
            capturedTitle = true;
          }
        }
      } catch {
        // ignored — fall through to the no-title-captured status message
      }

      setVideoStatus(
        capturedTitle
          ? '✅ Video linked, title captured — playback and A/B shadowing loop will work. No captions are fetched, so there\'s no text or vocab tracking.'
          : '✅ Video linked — playback and A/B shadowing loop will work. No captions are fetched, so there\'s no text or vocab tracking; add your own title above.'
      );
      return;
    }

    setFetching(true);
    try {
      const res = await fetch('/api/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ url: sourceUrl.trim() }),
      });

      // A non-JSON body usually means the request never reached the API route
      // (e.g. the backend isn't running, or a stale dev server is missing this
      // route) and we got an HTML error page back instead — surface that
      // clearly instead of letting JSON.parse blow up with a cryptic error.
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          res.status === 404
            ? 'Import API not found — the backend server may need to be restarted.'
            : `Import failed: server returned an unexpected response (HTTP ${res.status}). Is the backend running?`
        );
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to fetch: HTTP ${res.status}`);
      setTitle(data.title || '');
      setRawText(data.text || '');
    } catch (err: any) {
      setError(err.message || 'Failed to import. Please try again.');
    } finally {
      setFetching(false);
    }
  };

  const handleCreate = async () => {
    if (!rawText.trim() && !videoId) {
      setError(tab === 'text' ? 'Paste some Japanese text first.' : 'Fetch content first.');
      return;
    }

    setError('');
    setCreating(true);
    try {
      let passage: Passage;
      if (editingPassage) {
        if (selectedCollectionId !== (editingPassage.collectionId ?? '')) {
          movePassageToCollection(editingPassage.id, selectedCollectionId || undefined);
        }
        passage = await updatePassage(editingPassage.id, title, rawText.trim());
      } else {
        passage = await createPassage(
          title,
          rawText.trim(),
          tab === 'text' ? 'text' : tab,
          tab === 'text' ? undefined : sourceUrl.trim(),
          selectedCollectionId || undefined,
          videoId
        );
      }
      onCreated(passage);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{isEditing ? '✏️ Edit Passage' : '📖 New Passage'}</h2>
          <button style={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        {!isEditing && (
          <div style={styles.tabRow}>
            <button
              style={{ ...styles.tabButton, ...(tab === 'text' ? styles.tabButtonActive : {}) }}
              onClick={() => setTab('text')}
              disabled={creating || fetching}
            >
              Paste Text
            </button>
            <button
              style={{ ...styles.tabButton, ...(tab === 'url' ? styles.tabButtonActive : {}) }}
              onClick={() => setTab('url')}
              disabled={creating || fetching}
            >
              Import URL
            </button>
            <button
              style={{ ...styles.tabButton, ...(tab === 'youtube' ? styles.tabButtonActive : {}) }}
              onClick={() => setTab('youtube')}
              disabled={creating || fetching}
            >
              YouTube
            </button>
          </div>
        )}

        <div style={styles.content}>
          {!isEditing && (tab === 'url' || tab === 'youtube') && (
            <div style={styles.urlRow}>
              <input
                type="text"
                placeholder={tab === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com/article'}
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                style={styles.urlInput}
                disabled={creating || fetching}
              />
              <button
                style={{ ...styles.fetchButton, opacity: fetching || !sourceUrl.trim() ? 0.6 : 1 }}
                onClick={handleFetchUrl}
                disabled={fetching || !sourceUrl.trim()}
              >
                {fetching ? '⏳ Fetching…' : tab === 'youtube' ? 'Link Video' : 'Fetch'}
              </button>
            </div>
          )}

          <input
            type="text"
            placeholder="Title (e.g. 'NHK News — 2026-07-01')"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={styles.input}
            disabled={creating}
          />

          <select
            value={selectedCollectionId}
            onChange={e => handleCollectionChange(e.target.value)}
            style={styles.input}
            disabled={creating}
          >
            <option value="">No collection</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value={NEW_COLLECTION_OPTION}>+ New collection…</option>
          </select>

          {videoStatus && <div style={styles.videoStatus}>{videoStatus}</div>}

          <textarea
            placeholder={
              !isEditing && tab === 'url'
                ? 'Fetched article text will appear here — edit if needed.'
                : !isEditing && tab === 'youtube'
                ? 'Optional — paste a transcript here yourself if you want vocab tracking; not required for playback/looping.'
                : 'Paste any Japanese text here — an article, a subtitle transcript, a chapter…'
            }
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            style={styles.textarea}
            rows={12}
            disabled={creating}
          />

          {error && <div style={styles.error}>{error}</div>}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button
            style={{ ...styles.createButton, opacity: creating || (!rawText.trim() && !videoId) ? 0.6 : 1 }}
            onClick={handleCreate}
            disabled={creating || (!rawText.trim() && !videoId)}
          >
            {creating ? '⏳ Saving…' : isEditing ? 'Save Changes' : 'Create Lesson →'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#64748b',
  },
  tabRow: {
    display: 'flex',
    gap: '8px',
    padding: '16px 24px 0',
  },
  tabButton: {
    padding: '8px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#fff',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
  },
  urlRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  urlInput: {
    flex: 1,
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  fetchButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  content: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '12px',
    fontSize: '14px',
  },
  videoStatus: {
    backgroundColor: '#f0fdf4',
    color: '#166534',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '12px',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '10px 20px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#fff',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  createButton: {
    padding: '10px 24px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default ImportPassageModal;
