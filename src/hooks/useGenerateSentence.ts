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

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Generation failed. Please try again.');
        return null;
      }

      return { front: data.front, back: data.back };

    } catch {
      setError('Network error — please check your connection and try again.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }

  return { generate, isGenerating, error };
}
