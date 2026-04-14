/**
 * Text-to-Speech for Japanese using Web Speech API
 */

export function speakJapanese(text: string, rate: number = 1.0): void {
  // Check if browser supports speech synthesis
  if (!('speechSynthesis' in window)) {
    console.warn('Text-to-speech not supported in this browser');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Extract only Japanese text (remove English translations)
  const japaneseOnly = extractJapaneseText(text);
  
  if (!japaneseOnly) return;

  const utterance = new SpeechSynthesisUtterance(japaneseOnly);
  utterance.lang = 'ja-JP';
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to find a Japanese voice
  const voices = window.speechSynthesis.getVoices();
  const japaneseVoice = voices.find(voice => voice.lang.startsWith('ja'));
  
  if (japaneseVoice) {
    utterance.voice = japaneseVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Extract Japanese text from mixed content
 * Example: "べんきょう - study" → "べんきょう"
 */
function extractJapaneseText(text: string): string {
  // Split by common separators
  const parts = text.split(/[-–—]/)[0].trim();
  return parts;
}

/**
 * Check if browser supports TTS
 */
export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * Load voices (some browsers require this)
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
      resolve(voices);
    };
  });
}
