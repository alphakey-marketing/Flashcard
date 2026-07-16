import React, { useState, useEffect, useMemo, useRef, CSSProperties } from 'react';
import { ensurePassagesHydrated, getPassage, deletePassage } from '../lib/reader/passageStore';
import { ensureVocabHydrated, getVocabMap, recordWordsSeen, getStatusColor } from '../lib/reader/vocabStore';
import { recordDailySnapshotIfNeeded } from '../lib/reader/vocabHistory';
import { getSentenceForTokenIndex, splitSentences } from '../lib/reader/textUtils';
import { hasKanji } from '../lib/furigana';
import { audioService } from '../lib/audioService';
import type { Passage } from '../lib/reader/types';
import WordPopup from '../components/WordPopup';
import ImportPassageModal from '../components/ImportPassageModal';
import YoutubePlayer, { YoutubePlayerHandle } from '../components/YoutubePlayer';

/** mm:ss for a millisecond timestamp — used to label manual Set A/Set B markers. */
function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface ReaderProps {
  passageId: string;
  onExit: () => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

const Reader: React.FC<ReaderProps> = ({ passageId, onExit }) => {
  const [passage, setPassage] = useState<Passage | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showFurigana, setShowFurigana] = useState(true);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [playingRange, setPlayingRange] = useState<{ start: number; end: number } | null>(null);
  // Bumped after a status change so token colors re-read the vocab map without
  // rebuilding it on every render.
  const [vocabTick, setVocabTick] = useState(0);

  // A-B sentence loop (shadowing/repeat practice) — indices into `sentences`.
  const [showLoopPanel, setShowLoopPanel] = useState(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [isLoopPlaying, setIsLoopPlaying] = useState(false);
  // Checked after each lap of the loop so `runLoopSegment`'s while-loop stops
  // relaunching once the user hits Stop/Clear — a plain state var wouldn't be
  // visible to the async loop between awaits. Also doubles as the "is a video
  // A-B loop active" flag for video passages (see the polling effect below).
  const loopActiveRef = useRef(false);

  // Video playback (YouTube passages) — separate from the TTS engine above.
  // loopStart/loopEnd (indices) are reused for caption-cue-based looping;
  // loopStartMs/loopEndMs are the fallback for videos with no captions.
  const videoRef = useRef<YoutubePlayerHandle>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoLoopPlaying, setIsVideoLoopPlaying] = useState(false);
  const [loopStartMs, setLoopStartMs] = useState<number | null>(null);
  const [loopEndMs, setLoopEndMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setShowLoopPanel(false);
    setLoopStart(null);
    setLoopEnd(null);
    setLoopStartMs(null);
    setLoopEndMs(null);
    setVideoReady(false);
    setIsVideoPlaying(false);
    setIsVideoLoopPlaying(false);

    Promise.all([ensureVocabHydrated(), ensurePassagesHydrated()]).then(() => {
      if (cancelled) return;
      const p = getPassage(passageId);
      setPassage(p);
      setLoading(false);
      if (p) recordWordsSeen(p.tokens, p.id);
      recordDailySnapshotIfNeeded(getVocabMap());
      setVocabTick(t => t + 1); // pick up any times_seen/new-word rows just written
    });

    return () => {
      cancelled = true;
    };
  }, [passageId]);

  // Stop any in-flight speech/video playback when leaving the passage or unmounting.
  useEffect(() => {
    return () => {
      loopActiveRef.current = false;
      audioService.stop();
      videoRef.current?.pause();
    };
  }, [passageId]);

  const sentences = useMemo(() => (passage ? splitSentences(passage.tokens) : []), [passage]);

  const handlePlayToggle = async () => {
    if (isLoopPlaying) {
      loopActiveRef.current = false;
      setIsLoopPlaying(false);
    }

    if (isPlaying) {
      audioService.stop();
      setIsPlaying(false);
      setPlayingRange(null);
      return;
    }

    if (!audioService.isSupported() || sentences.length === 0) return;

    setIsPlaying(true);
    const items = sentences.map(s => ({ text: s.text, pauseAfter: 350 }));
    await audioService.playSequence(items, speechRate, index => {
      setPlayingRange({ start: sentences[index].start, end: sentences[index].end });
    });
    setIsPlaying(false);
    setPlayingRange(null);
  };

  const handleSpeedCycle = () => {
    const nextIndex = (SPEEDS.indexOf(speechRate) + 1) % SPEEDS.length;
    setSpeechRate(SPEEDS[nextIndex]);
  };

  // Tapping a sentence tick sets the loop's start (A), then its end (B).
  // Tapping the same sentence twice loops just that one sentence. Tapping a
  // third time starts a fresh A/B selection.
  const handleTickClick = (index: number) => {
    if (isPlaying || isLoopPlaying || isVideoLoopPlaying) return;

    if (loopStart === null) {
      setLoopStart(index);
      setLoopEnd(null);
    } else if (loopEnd === null) {
      if (index < loopStart) setLoopStart(index);
      else setLoopEnd(index);
    } else {
      setLoopStart(index);
      setLoopEnd(null);
    }
  };

  const handleClearLoop = () => {
    loopActiveRef.current = false;
    if (isLoopPlaying) audioService.stop();
    setIsLoopPlaying(false);
    if (isVideoLoopPlaying) videoRef.current?.pause();
    setIsVideoLoopPlaying(false);
    setLoopStart(null);
    setLoopEnd(null);
    setLoopStartMs(null);
    setLoopEndMs(null);
    setPlayingRange(null);
  };

  const runLoopSegment = async (start: number, end: number) => {
    const segment = sentences.slice(start, end + 1);
    const items = segment.map(s => ({ text: s.text, pauseAfter: 350 }));

    while (loopActiveRef.current) {
      await audioService.playSequence(items, speechRate, index => {
        setPlayingRange({ start: segment[index].start, end: segment[index].end });
      });
      if (!loopActiveRef.current) break;
      await new Promise(resolve => setTimeout(resolve, 500)); // brief pause before repeating
    }

    setPlayingRange(null);
  };

  const handleToggleLoopPlayback = () => {
    if (isLoopPlaying) {
      loopActiveRef.current = false;
      audioService.stop();
      setIsLoopPlaying(false);
      setPlayingRange(null);
      return;
    }

    if (loopStart === null || loopEnd === null || !audioService.isSupported()) return;

    if (isPlaying) {
      audioService.stop();
      setIsPlaying(false);
    }

    loopActiveRef.current = true;
    setIsLoopPlaying(true);
    runLoopSegment(loopStart, loopEnd);
  };

  const isVideoPassage = !!passage?.videoId;
  const cues = passage?.captionCues ?? [];
  const hasCaptionCues = cues.length > 0;

  // Single poll loop drives both the "now speaking" token highlight (for
  // captioned videos) and A-B loop enforcement (for both captioned and
  // caption-less videos) — the YouTube IFrame API has no timeupdate event, so
  // getCurrentTime() has to be sampled. Runs only while the video is actually
  // playing (tracked via onPlayingChange, not our own play()/pause() calls,
  // since the embed's native controls can change state too).
  useEffect(() => {
    if (!isVideoPassage || !isVideoPlaying) return;

    const interval = window.setInterval(() => {
      const player = videoRef.current;
      if (!player) return;
      const t = player.getCurrentTimeMs();

      if (hasCaptionCues) {
        const cue = cues.find(c => t >= c.startMs && t < c.startMs + c.durMs);
        if (cue) {
          setPlayingRange(prev =>
            prev?.start === cue.tokenStart && prev?.end === cue.tokenEnd
              ? prev
              : { start: cue.tokenStart, end: cue.tokenEnd }
          );
        }
      }

      if (loopActiveRef.current) {
        const startMs = hasCaptionCues ? (loopStart !== null ? cues[loopStart].startMs : null) : loopStartMs;
        const endMs = hasCaptionCues
          ? loopEnd !== null
            ? cues[loopEnd].startMs + cues[loopEnd].durMs
            : null
          : loopEndMs;
        if (startMs !== null && endMs !== null && t >= endMs) {
          player.seekTo(startMs);
        }
      }
    }, 200);

    return () => window.clearInterval(interval);
  }, [isVideoPassage, isVideoPlaying, hasCaptionCues, cues, loopStart, loopEnd, loopStartMs, loopEndMs]);

  const handleVideoPlayToggle = () => {
    const player = videoRef.current;
    if (!player) return;
    if (isVideoPlaying) player.pause();
    else player.play();
  };

  const handleSetLoopA = () => {
    const t = videoRef.current?.getCurrentTimeMs();
    if (t !== undefined) setLoopStartMs(t);
  };

  const handleSetLoopB = () => {
    const t = videoRef.current?.getCurrentTimeMs();
    if (t !== undefined) setLoopEndMs(t);
  };

  const handleStartVideoLoop = () => {
    const player = videoRef.current;
    if (!player) return;
    const startMs = hasCaptionCues ? (loopStart !== null ? cues[loopStart].startMs : null) : loopStartMs;
    const endMs = hasCaptionCues ? (loopEnd !== null ? cues[loopEnd].startMs : null) : loopEndMs;
    if (startMs === null || endMs === null) return;

    loopActiveRef.current = true;
    setIsVideoLoopPlaying(true);
    player.seekTo(startMs);
    player.play();
  };

  const handleStopVideoLoop = () => {
    loopActiveRef.current = false;
    setIsVideoLoopPlaying(false);
    videoRef.current?.pause();
  };

  const handleDelete = async () => {
    if (!passage) return;
    if (!window.confirm(`Delete "${passage.title}"? This cannot be undone.`)) return;
    audioService.stop();
    videoRef.current?.pause();
    await deletePassage(passage.id);
    onExit();
  };

  const vocabMap = useMemo(() => getVocabMap(), [vocabTick]);

  const handleStatusChange = () => setVocabTick(t => t + 1);

  // Memoized independent of selectedTokenIndex — opening/closing the popup
  // shouldn't rebuild up to 5,000 token spans (NFR-01). playingRange changes
  // only once per sentence during playback, so including it here is cheap.
  const tokenSpans = useMemo(() => {
    if (!passage) return null;

    return passage.tokens.map((token, index) => {
      const isSpeaking = !!playingRange && index >= playingRange.start && index < playingRange.end;
      const highlightStyle = isSpeaking ? styles.speaking : undefined;

      if (!token.isWord) {
        return (
          <span key={index} style={highlightStyle}>
            {token.surface}
          </span>
        );
      }

      const status = vocabMap.get(token.dictionaryForm)?.status ?? 0;
      const colors = getStatusColor(status);
      const showRuby = showFurigana && hasKanji(token.surface) && !!token.reading;

      return (
        <span
          key={index}
          onClick={() => setSelectedTokenIndex(index)}
          style={{
            ...styles.token,
            backgroundColor: colors.background,
            color: colors.color,
            ...highlightStyle,
          }}
        >
          {showRuby ? (
            <ruby>
              {token.surface}
              <rt style={styles.rt}>{token.reading}</rt>
            </ruby>
          ) : (
            token.surface
          )}
        </span>
      );
    });
  }, [passage, vocabMap, showFurigana, playingRange]);

  if (loading) {
    return <div style={styles.centered}>Loading passage…</div>;
  }

  if (!passage) {
    return (
      <div style={styles.centered}>
        <p>Passage not found.</p>
        <button style={styles.backLink} onClick={onExit}>← Back to Reader</button>
      </div>
    );
  }

  const selectedToken = selectedTokenIndex !== null ? passage.tokens[selectedTokenIndex] : null;
  const selectedSentence =
    selectedTokenIndex !== null ? getSentenceForTokenIndex(passage.tokens, selectedTokenIndex) : '';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.iconButton} onClick={onExit}>←</button>
        <h1 style={styles.title}>{passage.title}</h1>
        <div style={styles.headerActions}>
          <button
            style={{ ...styles.iconButton, ...(showFurigana ? styles.iconButtonActive : {}) }}
            onClick={() => setShowFurigana(f => !f)}
            title="Toggle furigana"
          >
            あ
          </button>
          <button style={styles.iconButton} onClick={() => setShowEditModal(true)} title="Edit passage">
            ✏️
          </button>
          <button style={styles.iconButton} onClick={handleDelete} title="Delete passage">
            🗑️
          </button>
        </div>
      </header>

      {isVideoPassage && passage.videoId && (
        <YoutubePlayer
          ref={videoRef}
          videoId={passage.videoId}
          onReady={() => setVideoReady(true)}
          onPlayingChange={setIsVideoPlaying}
        />
      )}

      {isVideoPassage && (
        <div style={styles.playBar}>
          <button style={styles.playButton} onClick={handleVideoPlayToggle} disabled={!videoReady} title={isVideoPlaying ? 'Pause' : 'Play'}>
            {isVideoPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            style={{ ...styles.speedButton, ...(showLoopPanel ? styles.iconButtonActive : {}) }}
            onClick={() => setShowLoopPanel(v => !v)}
            title="Repeat a segment for shadowing (A-B loop)"
          >
            🔁 Loop
          </button>
        </div>
      )}

      {isVideoPassage && showLoopPanel && hasCaptionCues && (
        <div style={styles.loopPanel}>
          <p style={styles.loopHint}>
            Tap a caption line to set the loop start, tap another to set the end — tap the same one twice to loop just that line.
          </p>

          <div style={styles.loopTicks}>
            {cues.map((cue, index) => {
              const inRange = loopStart !== null && loopEnd !== null && index >= loopStart && index <= loopEnd;
              const isEndpoint = index === loopStart || index === loopEnd;
              return (
                <button
                  key={index}
                  style={{
                    ...styles.loopTick,
                    ...(inRange ? styles.loopTickActive : {}),
                    ...(isEndpoint ? styles.loopTickEndpoint : {}),
                  }}
                  onClick={() => handleTickClick(index)}
                  disabled={isVideoLoopPlaying}
                  title={cue.text}
                />
              );
            })}
          </div>

          {(loopStart !== null || loopEnd !== null) && (
            <div style={styles.loopPreview}>
              {loopStart !== null && <div>A: {cues[loopStart].text}</div>}
              {loopEnd !== null && <div>B: {cues[loopEnd].text}</div>}
            </div>
          )}

          <div style={styles.loopActions}>
            <button
              style={{ ...styles.loopPlayButton, opacity: loopStart === null || loopEnd === null ? 0.5 : 1 }}
              onClick={isVideoLoopPlaying ? handleStopVideoLoop : handleStartVideoLoop}
              disabled={loopStart === null || loopEnd === null}
            >
              {isVideoLoopPlaying ? '⏹ Stop Loop' : '🔁 Play Loop'}
            </button>
            {(loopStart !== null || loopEnd !== null) && (
              <button style={styles.loopClearButton} onClick={handleClearLoop}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}

      {isVideoPassage && showLoopPanel && !hasCaptionCues && (
        <div style={styles.loopPanel}>
          <p style={styles.loopHint}>
            No captions to snap to — play the video, tap "Set A" where you want the loop to start, then "Set B" where it should end.
          </p>

          <div style={styles.loopActions}>
            <button style={styles.loopClearButton} onClick={handleSetLoopA} disabled={isVideoLoopPlaying}>
              Set A{loopStartMs !== null ? ` (${formatMs(loopStartMs)})` : ''}
            </button>
            <button style={styles.loopClearButton} onClick={handleSetLoopB} disabled={isVideoLoopPlaying}>
              Set B{loopEndMs !== null ? ` (${formatMs(loopEndMs)})` : ''}
            </button>
            <button
              style={{ ...styles.loopPlayButton, opacity: loopStartMs === null || loopEndMs === null ? 0.5 : 1 }}
              onClick={isVideoLoopPlaying ? handleStopVideoLoop : handleStartVideoLoop}
              disabled={loopStartMs === null || loopEndMs === null}
            >
              {isVideoLoopPlaying ? '⏹ Stop Loop' : '🔁 Play Loop'}
            </button>
            {(loopStartMs !== null || loopEndMs !== null) && (
              <button style={styles.loopClearButton} onClick={handleClearLoop}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}

      {!isVideoPassage && audioService.isSupported() && (
        <div style={styles.playBar}>
          <button style={styles.playButton} onClick={handlePlayToggle} title={isPlaying ? 'Stop' : 'Read aloud'}>
            {isPlaying ? '⏹ Stop' : '▶ Play'}
          </button>
          <button style={styles.speedButton} onClick={handleSpeedCycle} title="Playback speed">
            {speechRate}×
          </button>
          {sentences.length > 1 && (
            <button
              style={{ ...styles.speedButton, ...(showLoopPanel ? styles.iconButtonActive : {}) }}
              onClick={() => setShowLoopPanel(v => !v)}
              title="Repeat one sentence or passage (A-B loop)"
            >
              🔁 Loop
            </button>
          )}
        </div>
      )}

      {!isVideoPassage && audioService.isSupported() && showLoopPanel && sentences.length > 1 && (
        <div style={styles.loopPanel}>
          <p style={styles.loopHint}>
            Tap a sentence to set the loop start, tap another to set the end — tap the same one twice to loop just that sentence.
          </p>

          <div style={styles.loopTicks}>
            {sentences.map((_, index) => {
              const inRange = loopStart !== null && loopEnd !== null && index >= loopStart && index <= loopEnd;
              const isEndpoint = index === loopStart || index === loopEnd;
              return (
                <button
                  key={index}
                  style={{
                    ...styles.loopTick,
                    ...(inRange ? styles.loopTickActive : {}),
                    ...(isEndpoint ? styles.loopTickEndpoint : {}),
                  }}
                  onClick={() => handleTickClick(index)}
                  disabled={isPlaying || isLoopPlaying}
                  title={sentences[index].text}
                />
              );
            })}
          </div>

          {(loopStart !== null || loopEnd !== null) && (
            <div style={styles.loopPreview}>
              {loopStart !== null && <div>A: {sentences[loopStart].text}</div>}
              {loopEnd !== null && <div>B: {sentences[loopEnd].text}</div>}
            </div>
          )}

          <div style={styles.loopActions}>
            <button
              style={{ ...styles.loopPlayButton, opacity: loopStart === null || loopEnd === null ? 0.5 : 1 }}
              onClick={handleToggleLoopPlayback}
              disabled={loopStart === null || loopEnd === null}
            >
              {isLoopPlaying ? '⏹ Stop Loop' : '🔁 Play Loop'}
            </button>
            {(loopStart !== null || loopEnd !== null) && (
              <button style={styles.loopClearButton} onClick={handleClearLoop}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}

      {(!isVideoPassage || hasCaptionCues) && <div style={styles.textContainer}>{tokenSpans}</div>}

      {isVideoPassage && !hasCaptionCues && (
        <p style={styles.videoOnlyNote}>
          No Japanese captions were found for this video — it plays here for shadowing practice only, with no
          text, vocab lookup, or tracking.
        </p>
      )}

      {selectedToken && (
        <WordPopup
          token={selectedToken}
          sentence={selectedSentence}
          passageId={passage.id}
          onClose={() => setSelectedTokenIndex(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {showEditModal && (
        <ImportPassageModal
          editingPassage={passage}
          onClose={() => setShowEditModal(false)}
          onCreated={updated => {
            setPassage(updated);
            setVocabTick(t => t + 1);
          }}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
  },
  centered: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    gap: '12px',
  },
  videoOnlyNote: {
    maxWidth: '720px',
    margin: '16px auto 0',
    padding: '0 24px',
    fontSize: '13px',
    color: '#64748b',
    textAlign: 'center',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    fontSize: '14px',
    cursor: 'pointer',
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  iconButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#64748b',
    width: '40px',
    borderRadius: '8px',
    padding: '6px',
  },
  iconButtonActive: {
    backgroundColor: '#eff6ff',
    color: '#2563eb',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    flex: 1,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    maxWidth: '720px',
    margin: '16px auto 0',
    padding: '0 24px',
  },
  playButton: {
    padding: '8px 18px',
    border: 'none',
    borderRadius: '20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  speedButton: {
    padding: '8px 14px',
    border: '2px solid #e2e8f0',
    borderRadius: '20px',
    backgroundColor: '#fff',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  loopPanel: {
    maxWidth: '720px',
    margin: '10px auto 0',
    padding: '12px 24px',
  },
  loopHint: {
    fontSize: '12px',
    color: '#64748b',
    margin: '0 0 10px',
  },
  loopTicks: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '3px',
  },
  loopTick: {
    width: '16px',
    height: '22px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: '#e2e8f0',
    cursor: 'pointer',
    padding: 0,
  },
  loopTickActive: {
    backgroundColor: '#bfdbfe',
  },
  loopTickEndpoint: {
    backgroundColor: '#f59e0b',
  },
  loopPreview: {
    marginTop: '10px',
    padding: '10px 12px',
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#334155',
    lineHeight: 1.6,
  },
  loopActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
  },
  loopPlayButton: {
    padding: '8px 18px',
    border: 'none',
    borderRadius: '20px',
    backgroundColor: '#f59e0b',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  loopClearButton: {
    padding: '8px 18px',
    border: '2px solid #e2e8f0',
    borderRadius: '20px',
    backgroundColor: '#fff',
    color: '#475569',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  textContainer: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '32px 24px 80px',
    fontSize: '20px',
    lineHeight: 2.4,
    color: '#1e293b',
    whiteSpace: 'pre-wrap',
  },
  speaking: {
    borderBottom: '3px solid #f59e0b',
  },
  token: {
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '1px 1px',
    transition: 'opacity 0.15s',
  },
  rt: {
    fontSize: '11px',
    color: '#64748b',
    userSelect: 'none',
  },
};

export default Reader;
