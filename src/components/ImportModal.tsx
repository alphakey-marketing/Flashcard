import React, { useState, CSSProperties } from 'react';
import { parseCSV, validateCSV } from '../lib/csvParser';
import { createNewSet, saveSet, FlashcardSet } from '../lib/storage';

interface ImportModalProps {
  onClose: () => void;
  onImportSuccess: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImportSuccess }) => {
  const [csvText, setCsvText] = useState('');
  const [setTitle, setSetTitle] = useState('');
  const [setDescription, setSetDescription] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [previewCount, setPreviewCount] = useState(0);
  const [importing, setImporting] = useState(false);

  const handleValidate = () => {
    const validation = validateCSV(csvText);
    
    if (!validation.valid) {
      setError(validation.error || 'Invalid CSV format');
      return;
    }

    setError('');
    setPreviewCount(validation.preview || 0);
    setStep('preview');
  };

  const handleImport = () => {
    if (!setTitle.trim()) {
      setError('Please enter a title for your flashcard set');
      return;
    }

    const cards = parseCSV(csvText);
    if (cards.length === 0) {
      setError('No valid cards found');
      return;
    }

    const newSet = createNewSet(
      setTitle.trim(),
      setDescription.trim(),
      cards
    );

    saveSet(newSet);
    onImportSuccess();
    onClose();
  };

  const validateFlashcardSet = (set: any): set is FlashcardSet => {
    return (
      set &&
      typeof set.id === 'string' &&
      typeof set.title === 'string' &&
      Array.isArray(set.cards) &&
      set.cards.every((card: any) => 
        card &&
        typeof card.id === 'string' &&
        typeof card.front === 'string' &&
        typeof card.back === 'string'
      )
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setImporting(true);

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const data = JSON.parse(text);
          
          if (!Array.isArray(data)) {
            setError('Invalid backup format. Expected an array of flashcard sets.');
            setImporting(false);
            return;
          }

          let importedCount = 0;
          let skippedCount = 0;

          data.forEach((set: any) => {
            if (validateFlashcardSet(set)) {
              // Ensure timestamps are numbers
              const validSet: FlashcardSet = {
                ...set,
                createdAt: typeof set.createdAt === 'number' ? set.createdAt : Date.now(),
                updatedAt: typeof set.updatedAt === 'number' ? set.updatedAt : Date.now(),
                tags: Array.isArray(set.tags) ? set.tags : [],
                description: set.description || ''
              };
              saveSet(validSet);
              importedCount++;
            } else {
              skippedCount++;
              console.warn('Skipped invalid set:', set);
            }
          });

          setImporting(false);
          
          if (importedCount > 0) {
            alert(`Successfully imported ${importedCount} flashcard set(s)!${skippedCount > 0 ? ` (${skippedCount} invalid sets were skipped)` : ''}`);
            onImportSuccess();
            onClose();
          } else {
            setError(`No valid flashcard sets found in the backup file. ${skippedCount} invalid sets were detected.`);
          }
        } catch (err) {
          console.error('JSON parse error:', err);
          setError(`Failed to parse JSON file: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setImporting(false);
        }
      };
      
      reader.onerror = () => {
        setError('Failed to read file. Please try again.');
        setImporting(false);
      };
      
      reader.readAsText(file);
      return;
    }

    // Handle CSV files
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      setImporting(false);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
      setImporting(false);
    };
    reader.readAsText(file);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {step === 'input' ? '📥 Import CSV or Backup' : '👀 Preview Import'}
          </h2>
          <button
            style={styles.closeButton}
            onClick={onClose}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            ✕
          </button>
        </div>

        {step === 'input' ? (
          <>
            <div style={styles.content}>
              <div style={styles.helpBox}>
                <strong>📝 Supported Formats:</strong>
                <ul style={styles.helpList}>
                  <li><strong>JSON Backup:</strong> Upload a <code>.json</code> file from "💾 Backup All" to restore all your flashcard sets</li>
                  <li><strong>CSV Format:</strong> Each line = one flashcard</li>
                  <li>CSV Example: <code>Front,Back</code> or <code>Front,Back,Example</code></li>
                  <li>CSV Example: <code>学校,がっこう,school</code></li>
                </ul>
              </div>

              <div style={styles.uploadSection}>
                <label style={{
                  ...styles.fileLabel,
                  opacity: importing ? 0.5 : 1,
                  cursor: importing ? 'not-allowed' : 'pointer'
                }}>
                  {importing ? '⏳ Loading...' : '📂 Upload File'}
                  <input
                    type="file"
                    accept=".csv,.txt,.json,application/json"
                    onChange={handleFileUpload}
                    style={styles.fileInput}
                    disabled={importing}
                  />
                </label>
                <span style={styles.orText}>or paste CSV text below</span>
              </div>

              <textarea
                placeholder="Paste your CSV here...\n\nExample:\n勉強,べんきょう - study\n学校,がっこう - school\n先生,せんせい - teacher"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                style={styles.textarea}
                rows={12}
                disabled={importing}
              />

              {error && <div style={styles.error}>{error}</div>}
            </div>

            <div style={styles.footer}>
              <button
                style={styles.cancelButton}
                onClick={onClose}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                disabled={importing}
              >
                Cancel
              </button>
              <button
                style={styles.nextButton}
                onClick={handleValidate}
                disabled={!csvText.trim() || importing}
                onMouseEnter={(e) => (!csvText.trim() || importing) ? null : (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={styles.content}>
              <div style={styles.successBox}>
                ✅ Found {previewCount} valid cards
              </div>

              <input
                type="text"
                placeholder="Set Title (e.g., 'My Japanese Vocabulary')"
                value={setTitle}
                onChange={(e) => setSetTitle(e.target.value)}
                style={styles.input}
                autoFocus
              />

              <textarea
                placeholder="Description (optional)"
                value={setDescription}
                onChange={(e) => setSetDescription(e.target.value)}
                style={styles.descriptionInput}
                rows={3}
              />

              {error && <div style={styles.error}>{error}</div>}
            </div>

            <div style={styles.footer}>
              <button
                style={styles.cancelButton}
                onClick={() => setStep('input')}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
              >
                ← Back
              </button>
              <button
                style={styles.importButton}
                onClick={handleImport}
                disabled={!setTitle.trim()}
                onMouseEnter={(e) => !setTitle.trim() ? null : (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Import {previewCount} Cards
              </button>
            </div>
          </>
        )}
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
    padding: '20px'
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px 8px',
    transition: 'opacity 0.2s'
  },
  content: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1
  },
  helpBox: {
    backgroundColor: '#f1f5f9',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#334155'
  },
  helpList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px',
    lineHeight: '1.6'
  },
  uploadSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  fileLabel: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'opacity 0.2s'
  },
  fileInput: {
    display: 'none'
  },
  orText: {
    fontSize: '14px',
    color: '#94a3b8'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'monospace',
    resize: 'vertical',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  descriptionInput: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  successBox: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'center'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '12px',
    fontSize: '14px',
    lineHeight: '1.5'
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
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
    transition: 'background-color 0.2s'
  },
  nextButton: {
    padding: '10px 24px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  importButton: {
    padding: '10px 24px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#22c55e',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  }
};

export default ImportModal;
