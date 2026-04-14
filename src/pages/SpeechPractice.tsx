import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { FlashcardSet } from '../lib/storage';
import { AudioRecorder, saveRecording, getLatestRecording, deleteRecordingsForCard } from '../lib/audioRecording';
import { audioService } from '../lib/audioService';
import { getSetReviewData } from '../lib/spacedRepetition';

interface SpeechPracticeProps {
  set: FlashcardSet;
  onExit: () => void;
}

const SpeechPractice: React.FC<SpeechPracticeProps> = ({ set, onExit }) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [savedRecordingUrl, setSavedRecordingUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackType, setPlaybackType] = useState<'user' | 'tts' | null>(null);
  const [hasPermission, setHasPermission] = useState(true);
  
  const recorderRef = useRef(new AudioRecorder());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // Get mastered cards using the correct status check
  const reviewData = getSetReviewData(set.id);
  const masteredCardIds = new Set(
    reviewData
      .filter(r => r.status === 'mastered')
      .map(r => r.cardId)
  );
  const masteredCards = set.cards.filter(card => masteredCardIds.has(card.id));

  const currentCard = masteredCards[currentCardIndex];

  useEffect(() => {
    checkMicrophonePermission();
    loadExistingRecording();
    
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (audioRef.current) audioRef.current.pause();
      if (savedRecordingUrl) URL.revokeObjectURL(savedRecordingUrl);
    };
  }, [currentCardIndex]);

  const checkMicrophonePermission = async () => {
    const hasAccess = await recorderRef.current.checkPermission();
    setHasPermission(hasAccess);
  };

  const loadExistingRecording = async () => {
    if (!currentCard) return;
    
    try {
      const recording = await getLatestRecording(set.id, currentCard.id);
      if (recording) {
        const url = URL.createObjectURL(recording.blob);
        setSavedRecordingUrl(url);
      } else {
        setSavedRecordingUrl(null);
      }
    } catch (error) {
      console.error('Error loading recording:', error);
    }
  };

  const startRecording = async () => {
    try {
      await recorderRef.current.startRecording();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to access microphone. Please check permissions.');
      setHasPermission(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const { blob, duration } = await recorderRef.current.stopRecording();
      setIsRecording(false);

      // Save to IndexedDB
      await saveRecording(set.id, currentCard.id, blob, duration);

      // Create playback URL
      if (savedRecordingUrl) {
        URL.revokeObjectURL(savedRecordingUrl);
      }
      const url = URL.createObjectURL(blob);
      setSavedRecordingUrl(url);
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
    }
  };

  const playUserRecording = () => {
    if (!savedRecordingUrl || !audioRef.current) return;
    
    setIsPlaying(true);
    setPlaybackType('user');
    audioRef.current.src = savedRecordingUrl;
    audioRef.current.play();
  };

  const playTTS = async () => {
    if (!currentCard) return;
    
    setIsPlaying(true);
    setPlaybackType('tts');
    
    // Parse the card front to extract vocab and example sentence
    const lines = currentCard.front.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      setIsPlaying(false);
      setPlaybackType(null);
      return;
    }

    // Build sequence: vocab, then example sentence with pauses
    const sequence: { text: string; pauseAfter: number }[] = [];
    
    // First line is typically the vocab word
    const vocabLine = lines[0].split('[')[0].trim(); // Remove furigana brackets
    sequence.push({ text: vocabLine, pauseAfter: 800 });
    
    // Additional lines are example sentences
    if (lines.length > 1) {
      for (let i = 1; i < lines.length; i++) {
        const sentence = lines[i].trim();
        if (sentence) {
          sequence.push({ text: sentence, pauseAfter: 500 });
        }
      }
    }

    // Use playSequence for better control and natural pauses
    await audioService.playSequence(sequence, 0.85);
    
    setIsPlaying(false);
    setPlaybackType(null);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaybackType(null);
  };

  const handleDeleteRecording = async () => {
    if (!currentCard) return;
    
    if (confirm('Delete this recording?')) {
      try {
        await deleteRecordingsForCard(set.id, currentCard.id);
        if (savedRecordingUrl) {
          URL.revokeObjectURL(savedRecordingUrl);
        }
        setSavedRecordingUrl(null);
      } catch (error) {
        console.error('Error deleting recording:', error);
      }
    }
  };

  const handleNext = () => {
    if (currentCardIndex < masteredCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setRecordingTime(0);
      if (savedRecordingUrl) URL.revokeObjectURL(savedRecordingUrl);
      setSavedRecordingUrl(null);
    }
  };

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setRecordingTime(0);
      if (savedRecordingUrl) URL.revokeObjectURL(savedRecordingUrl);
      setSavedRecordingUrl(null);
    }
  };

  if (masteredCards.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={onExit}>← Exit</button>
          <h2 style={styles.headerTitle}>Speech Practice</h2>
          <div style={{ width: '80px' }} />
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🎤</div>
          <p style={styles.emptyText}>Master some cards first to practice speaking!</p>
          <p style={styles.emptyHint}>Use Learn Mode and mark cards as "Mastered" to unlock this feature.</p>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  return (
    <div style={styles.container}>
      <audio ref={audioRef} onEnded={handleAudioEnded} style={{ display: 'none' }} />
      
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onExit}>← Exit</button>
        <h2 style={styles.headerTitle}>Speech Practice</h2>
        <div style={styles.progress}>
          {currentCardIndex + 1} / {masteredCards.length}
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Practice Speaking:</div>
          <div style={styles.cardText}>{currentCard.front}</div>
          <div style={styles.cardMeaning}>{currentCard.back}</div>

          <div style={styles.controls}>
            <button
              style={{
                ...styles.ttsButton,
                opacity: isPlaying && playbackType === 'tts' ? 0.6 : 1
              }}
              onClick={playTTS}
              disabled={isPlaying}
            >
              🔊 Listen to Native
            </button>
          </div>

          <div style={styles.recordingSection}>
            {!isRecording ? (
              <button
                style={styles.recordButton}
                onClick={startRecording}
                disabled={!hasPermission}
              >
                <div style={styles.micIcon}>🎤</div>
                <div style={styles.recordButtonText}>
                  {savedRecordingUrl ? 'Record Again' : 'Start Recording'}
                </div>
              </button>
            ) : (
              <button
                style={styles.stopButton}
                onClick={stopRecording}
              >
                <div style={styles.stopIcon}>⏹️</div>
                <div style={styles.recordingTime}>
                  Recording... {recordingTime}s
                </div>
              </button>
            )}

            {savedRecordingUrl && !isRecording && (
              <div style={styles.playbackSection}>
                <button
                  style={{
                    ...styles.playbackButton,
                    opacity: isPlaying && playbackType === 'user' ? 0.6 : 1
                  }}
                  onClick={playUserRecording}
                  disabled={isPlaying}
                >
                  ▶️ Play My Recording
                </button>
                <button
                  style={styles.deleteButton}
                  onClick={handleDeleteRecording}
                >
                  🗑️
                </button>
              </div>
            )}
          </div>

          <div style={styles.tips}>
            <div style={styles.tipsTitle}>💡 Tips:</div>
            <ul style={styles.tipsList}>
              <li>Listen to the vocab word and example sentence</li>
              <li>Record yourself saying both the word and sentence</li>
              <li>Compare your recording with the native audio</li>
              <li>Practice until you're confident!</li>
            </ul>
          </div>
        </div>

        <div style={styles.navigation}>
          <button
            style={{
              ...styles.navButton,
              opacity: currentCardIndex === 0 ? 0.5 : 1
            }}
            onClick={handlePrevious}
            disabled={currentCardIndex === 0}
          >
            ← Previous
          </button>
          <button
            style={{
              ...styles.navButton,
              opacity: currentCardIndex === masteredCards.length - 1 ? 0.5 : 1
            }}
            onClick={handleNext}
            disabled={currentCardIndex === masteredCards.length - 1}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  backButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px 16px',
    fontWeight: 600
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0
  },
  progress: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#3b82f6',
    minWidth: '80px',
    textAlign: 'right'
  },
  content: {
    flex: 1,
    padding: '32px 24px',
    maxWidth: '700px',
    margin: '0 auto',
    width: '100%'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '40px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    marginBottom: '24px'
  },
  cardLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '1px',
    marginBottom: '16px',
    textTransform: 'uppercase'
  },
  cardText: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '12px',
    textAlign: 'center',
    whiteSpace: 'pre-line'
  },
  cardMeaning: {
    fontSize: '18px',
    color: '#64748b',
    marginBottom: '32px',
    textAlign: 'center'
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '32px'
  },
  ttsButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  recordingSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px'
  },
  recordButton: {
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '120px',
    height: '120px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
  },
  stopButton: {
    backgroundColor: '#64748b',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '120px',
    height: '120px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    animation: 'pulse 1.5s infinite'
  },
  micIcon: {
    fontSize: '40px',
    marginBottom: '8px'
  },
  stopIcon: {
    fontSize: '40px',
    marginBottom: '8px'
  },
  recordButtonText: {
    fontSize: '12px',
    fontWeight: 600
  },
  recordingTime: {
    fontSize: '14px',
    fontWeight: 600
  },
  playbackSection: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  playbackButton: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  deleteButton: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '20px',
    cursor: 'pointer'
  },
  tips: {
    backgroundColor: '#f0f9ff',
    border: '2px solid #3b82f6',
    borderRadius: '12px',
    padding: '20px'
  },
  tipsTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1e40af',
    marginBottom: '12px'
  },
  tipsList: {
    margin: 0,
    paddingLeft: '24px',
    color: '#1e3a8a',
    lineHeight: '1.8',
    fontSize: '14px'
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px'
  },
  navButton: {
    flex: 1,
    backgroundColor: '#fff',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#0f172a'
  },
  emptyState: {
    textAlign: 'center',
    padding: '64px 24px'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#64748b',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '14px',
    color: '#94a3b8'
  }
};

export default SpeechPractice;
