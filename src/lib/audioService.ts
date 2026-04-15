/**
 * Audio service for Japanese Text-to-Speech
 * Uses browser's built-in Web Speech API
 */

export class AudioService {
  private synth: SpeechSynthesis | null = null;
  private japaneseVoice: SpeechSynthesisVoice | null = null;
  private isInitialized = false;
  private sequenceId = 0;
  // Holds the resolve() of the currently-awaited utterance promise so that
  // stop() can forcefully unblock it even when cancel() doesn't fire onerror
  // (a known Chrome/WebKit bug with SpeechSynthesis.cancel()).
  private currentResolve: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
    }
  }

  private initVoices() {
    if (!this.synth) return;

    const setVoice = () => {
      const voices = this.synth!.getVoices();
      // Try to find Japanese voice (ja-JP)
      this.japaneseVoice = voices.find(voice => voice.lang.startsWith('ja')) || null;
      this.isInitialized = true;
    };

    // Voices might load asynchronously
    if (this.synth.getVoices().length > 0) {
      setVoice();
    } else {
      this.synth.addEventListener('voiceschanged', setVoice);
    }
  }

  /**
   * Speak a single Japanese text
   */
  speak(text: string, rate: number = 0.85): void {
    if (!this.synth || !text) return;

    this.stop(); // Stop any ongoing speech or sequence

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = rate; // Slightly slower for learning
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Use Japanese voice if available
    if (this.japaneseVoice) {
      utterance.voice = this.japaneseVoice;
    }

    this.synth.speak(utterance);
  }

  /**
   * Play a sequence of items with delays between them
   */
  async playSequence(items: { text: string; pauseAfter: number }[], rate: number = 0.85): Promise<void> {
    if (!this.synth) return;
    
    this.stop();
    const currentSeqId = ++this.sequenceId;

    for (const item of items) {
      if (!item.text) continue;
      if (currentSeqId !== this.sequenceId) break;

      await new Promise<void>((resolve) => {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          this.currentResolve = null;
          clearTimeout(fallbackTimer);
          resolve();
        };

        this.currentResolve = settle;

        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = 'ja-JP';
        utterance.rate = rate;
        
        if (this.japaneseVoice) {
          utterance.voice = this.japaneseVoice;
        }

        utterance.onend = settle;
        utterance.onerror = settle;

        // Safety-net: if onend/onerror never fire (e.g. browser bug),
        // resolve after a generous timeout so the caller is never stuck.
        const estimatedMs = Math.min(30000, Math.max(5000, (item.text.length / rate) * 150));
        const fallbackTimer = setTimeout(settle, estimatedMs);

        this.synth!.speak(utterance);
      });

      if (currentSeqId !== this.sequenceId) break;

      if (item.pauseAfter > 0) {
        await new Promise(res => setTimeout(res, item.pauseAfter));
      }
    }
  }

  /**
   * Stop any ongoing speech
   */
  stop(): void {
    this.sequenceId++; // Invalidate any ongoing sequence
    // Forcefully resolve any in-flight utterance promise.
    // speechSynthesis.cancel() does not reliably fire onend/onerror in all
    // browsers (known Chrome/WebKit bug), so we unblock the awaiter ourselves.
    const resolve = this.currentResolve;
    this.currentResolve = null;
    if (resolve) resolve();
    if (this.synth) {
      this.synth.cancel();
    }
  }

  /**
   * Check if TTS is supported
   */
  isSupported(): boolean {
    return this.synth !== null;
  }

  /**
   * Check if Japanese voice is available
   */
  hasJapaneseVoice(): boolean {
    return this.japaneseVoice !== null;
  }
}

// Singleton instance
export const audioService = new AudioService();
