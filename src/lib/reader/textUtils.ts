import type { Token } from './types';

const SENTENCE_END_RE = /[。！？\n]/;

/**
 * Reconstruct the sentence a given token index belongs to by scanning outward
 * to the nearest sentence-ending punctuation (or the passage boundaries).
 * Kuromoji's flat token stream doesn't preserve sentence boundaries itself.
 */
export function getSentenceForTokenIndex(tokens: Token[], index: number): string {
  let start = index;
  while (start > 0 && !SENTENCE_END_RE.test(tokens[start - 1].surface)) {
    start--;
  }

  let end = index;
  while (end < tokens.length - 1 && !SENTENCE_END_RE.test(tokens[end].surface)) {
    end++;
  }
  end++; // slice() end is exclusive — include the token at `end` (terminator or last token)

  return tokens
    .slice(start, end)
    .map(t => t.surface)
    .join('')
    .trim();
}

/** Count of distinct content-word tokens in a passage (used for word_count). */
export function countContentWords(tokens: Token[]): number {
  return tokens.filter(t => t.isWord).length;
}

export interface SentenceSpan {
  text: string;
  /** Token index range covering this sentence, [start, end) — used for playback highlighting. */
  start: number;
  end: number;
}

/** Split a token stream into sentences, tracking each one's token index range. */
export function splitSentences(tokens: Token[]): SentenceSpan[] {
  const sentences: SentenceSpan[] = [];
  let start = 0;

  for (let i = 0; i < tokens.length; i++) {
    const isBoundary = SENTENCE_END_RE.test(tokens[i].surface) || i === tokens.length - 1;
    if (!isBoundary) continue;

    const text = tokens.slice(start, i + 1).map(t => t.surface).join('').trim();
    if (text) sentences.push({ text, start, end: i + 1 });
    start = i + 1;
  }

  return sentences;
}
