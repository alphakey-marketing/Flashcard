// src/hooks/useGenerateSentence.ts
import { useState } from 'react';

export interface GeneratedCard {
  front: string;  // reading + "\n\n" + japaneseSentence
  back: string;   // meaning + "\n\n" + englishTranslation
}

export function useGenerateSentence() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(word: string): Promise<GeneratedCard | null> {
    if (!word.trim()) return null;

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word.trim() }),
      });

      // If the response is not JSON (e.g. the server is not running and a
      // static host returned an HTML page), surface a clearer message.
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setError('Auto-fill service is unavailable. This feature requires the server to be running with OPENROUTER_API_KEY configured.');
        return null;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Generation failed. Please try again.');
        return null;
      }

      return { front: data.front, back: data.back };

    } catch (err) {
      // fetch() itself throws only for true network-level failures (offline,
      // DNS failure, CORS block, etc.).
      setError('Network error — please check your connection and try again.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }

  return { generate, isGenerating, error };
}
