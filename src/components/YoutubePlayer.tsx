import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Thin wrapper around the YouTube IFrame Player API for Reader's video
 * passages. No npm dependency — the API is loaded once via its own script
 * tag, matching the project's existing preference for native browser APIs
 * over a wrapper library (see audioService.ts's use of the raw Web Speech API).
 */

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: any) => YTPlayerInstance;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
}

let apiLoadPromise: Promise<void> | null = null;

/** Loads the IFrame API script exactly once, however many players are on screen. */
function loadYoutubeIframeApi(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise(resolve => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });

  return apiLoadPromise;
}

export interface YoutubePlayerHandle {
  play(): void;
  pause(): void;
  /** Seek to an absolute position in milliseconds. */
  seekTo(ms: number): void;
  /** Current position in milliseconds. */
  getCurrentTimeMs(): number;
  isPlaying(): boolean;
}

interface YoutubePlayerProps {
  videoId: string;
  onReady?: () => void;
  /** Fires whenever the player transitions in/out of the PLAYING state — driven by the
   * player's own state (native controls, buffering, end-of-video), not just our own calls. */
  onPlayingChange?: (playing: boolean) => void;
}

const YoutubePlayer = forwardRef<YoutubePlayerHandle, YoutubePlayerProps>(({ videoId, onReady, onPlayingChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadYoutubeIframeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0 },
        events: {
          onReady: () => onReady?.(),
          onStateChange: (e: { data: number }) => onPlayingChange?.(e.data === window.YT?.PlayerState.PLAYING),
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    seekTo: (ms: number) => playerRef.current?.seekTo(ms / 1000, true),
    getCurrentTimeMs: () => (playerRef.current?.getCurrentTime() ?? 0) * 1000,
    isPlaying: () => playerRef.current?.getPlayerState() === window.YT?.PlayerState.PLAYING,
  }));

  return <div style={styles.wrapper}><div ref={containerRef} style={styles.player} /></div>;
});

YoutubePlayer.displayName = 'YoutubePlayer';

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: '720px',
    aspectRatio: '16 / 9',
    margin: '0 auto',
    backgroundColor: '#000',
  },
  player: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
};

export default YoutubePlayer;
