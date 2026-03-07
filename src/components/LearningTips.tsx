import React, { CSSProperties } from 'react';

interface LearningTipsProps {
  onClose: () => void;
}

const LearningTips: React.FC<LearningTipsProps> = ({ onClose }) => {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>🎯 Learning Phases Framework</h2>
          <button
            style={styles.closeButton}
            onClick={onClose}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            ✕
          </button>
        </div>

        <p style={styles.intro}>
          FlashMind uses scientifically-proven methods to help you master vocabulary efficiently.
          Follow these phases for optimal learning:
        </p>

        <div style={styles.phases}>
          {/* Phase 1 */}
          <div style={styles.phase}>
            <div style={styles.phaseHeader}>
              <div style={styles.phaseNumber}>1</div>
              <div>
                <h3 style={styles.phaseTitle}>Initial Learning</h3>
                <div style={styles.phaseSubtitle}>NEW cards</div>
              </div>
            </div>
            <div style={styles.phaseContent}>
              <div style={styles.method}>
                <span style={styles.arrow}>→</span>
                <span style={styles.methodText}>Multiple choice (recognition)</span>
              </div>
              <div style={styles.method}>
                <span style={styles.arrow}>→</span>
                <span style={styles.methodText}>Shadow reading (if audio available)</span>
              </div>
            </div>
            <div style={styles.tip}>
              <strong>Tip:</strong> Use <strong>Learn Mode</strong> to mix question types for better engagement.
            </div>
          </div>

          {/* Phase 2 */}
          <div style={styles.phase}>
            <div style={styles.phaseHeader}>
              <div style={styles.phaseNumber}>2</div>
              <div>
                <h3 style={styles.phaseTitle}>Strengthening</h3>
                <div style={styles.phaseSubtitle}>LEARNING cards</div>
              </div>
            </div>
            <div style={styles.phaseContent}>
              <div style={styles.method}>
                <span style={styles.arrow}>→</span>
                <span style={styles.methodText}>Typing practice (production)</span>
              </div>
              <div style={styles.method}>
                <span style={styles.arrow}>→</span>
                <span style={styles.methodText}>Standard flashcards</span>
              </div>
            </div>
            <div style={styles.tip}>
              <strong>Tip:</strong> Type-in questions force active recall, strengthening memory faster.
            </div>
          </div>

          {/* Phase 3 */}
          <div style={styles.phase}>
            <div style={styles.phaseHeader}>
              <div style={styles.phaseNumber}>3</div>
              <div>
                <h3 style={styles.phaseTitle}>Maintenance</h3>
                <div style={styles.phaseSubtitle}>REVIEWING cards</div>
              </div>
            </div>
            <div style={styles.phaseContent}>
              <div style={styles.method}>
                <span style={styles.arrow}>→</span>
                <span style={styles.methodText}>Quick flashcard reviews</span>
              </div>
              <div style={styles.method}>
                <span style={styles.arrow}>→</span>
                <span style={styles.methodText}>Due card reminders</span>
              </div>
            </div>
            <div style={styles.tip}>
              <strong>Tip:</strong> Consistency beats intensity. Review due cards daily to build long-term memory.
            </div>
          </div>

          {/* Phase 4 */}
          <div style={styles.phase}>
            <div style={styles.phaseHeader}>
              <div style={styles.phaseNumber}>4</div>
              <div>
                <h3 style={styles.phaseTitle}>Mastery</h3>
                <div style={styles.phaseSubtitle}>MASTERED cards</div>
              </div>
            </div>
            <div style={styles.phaseContent}>
              <div style={styles.method}>
                <span style={styles.arrow}>→</span>
                <span style={styles.methodText}>Long interval reviews only</span>
              </div>
              <div style={styles.method}>
                <span style={styles.arrow}>→</span>
                <span style={styles.methodText}>Shadow reading at native speed</span>
              </div>
            </div>
            <div style={styles.tip}>
              <strong>Tip:</strong> Mastered cards appear less frequently. Trust the spaced repetition algorithm!
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <div style={styles.science}>
            <strong>🔬 Science-backed:</strong> This framework combines <em>active recall</em>, 
            <em>spaced repetition</em>, and <em>varied practice</em> for optimal retention.
          </div>
          <button
            style={styles.gotItButton}
            onClick={onClose}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Got it! ✓
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
    padding: '24px'
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 24px 16px',
    borderBottom: '2px solid #f1f5f9'
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#64748b',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'opacity 0.2s'
  },
  intro: {
    padding: '20px 24px',
    fontSize: '16px',
    color: '#475569',
    lineHeight: '1.6',
    margin: 0,
    backgroundColor: '#f8fafc'
  },
  phases: {
    padding: '24px'
  },
  phase: {
    marginBottom: '24px',
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '2px solid #e2e8f0'
  },
  phaseHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px'
  },
  phaseNumber: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 700,
    flexShrink: 0
  },
  phaseTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    marginBottom: '4px'
  },
  phaseSubtitle: {
    fontSize: '12px',
    color: '#3b82f6',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  phaseContent: {
    marginBottom: '12px'
  },
  method: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    fontSize: '15px',
    color: '#334155'
  },
  arrow: {
    color: '#3b82f6',
    fontWeight: 700,
    fontSize: '16px'
  },
  methodText: {},
  tip: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#475569',
    borderLeft: '3px solid #3b82f6'
  },
  footer: {
    padding: '24px',
    borderTop: '2px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  science: {
    fontSize: '14px',
    color: '#475569',
    lineHeight: '1.6',
    padding: '16px',
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    border: '1px solid #fbbf24'
  },
  gotItButton: {
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: 600,
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    alignSelf: 'center'
  }
};

export default LearningTips;
