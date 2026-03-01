/**
 * Audio service for Japanese Text-to-Speech
 * Uses browser's built-in Web Speech API
 */

export class AudioService {
  private synth: SpeechSynthesis | null = null;
  private japaneseVoice: SpeechSynthesisVoice | null = null;
  private isInitialized = false;

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
   * Speak Japanese text
   */
  speak(text: string, rate: number = 0.85): void {
    if (!this.synth || !text) return;

    // Cancel any ongoing speech
    this.synth.cancel();

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
   * Stop any ongoing speech
   */
  stop(): void {
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
