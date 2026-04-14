/**
 * Furigana utilities for displaying readings above kanji
 */

export interface FuriganaSegment {
  kanji: string;
  reading: string;
}

/**
 * Parse text with furigana notation
 * Format: 漢字[かんじ]
 * Example: "勉強[べんきょう]する" → [{kanji: "勉強", reading: "べんきょう"}, {kanji: "する", reading: ""}]
 */
export function parseFurigana(text: string): FuriganaSegment[] {
  const segments: FuriganaSegment[] = [];
  const regex = /([^\[\]]+)(\[([^\]]+)\])?/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const kanji = match[1];
    const reading = match[3] || '';
    
    if (kanji) {
      segments.push({ kanji, reading });
    }
  }

  return segments;
}

/**
 * Auto-detect if text might need furigana (contains kanji)
 */
export function hasKanji(text: string): boolean {
  // Unicode range for common kanji
  const kanjiRegex = /[\u4e00-\u9faf\u3400-\u4dbf]/;
  return kanjiRegex.test(text);
}

/**
 * Convert flashcard text to furigana-ready format
 * If back contains reading, extract it
 * Example: "べんきょう - study" → reading = "べんきょう"
 */
export function extractReading(backText: string): string {
  // Pattern: reading - meaning or reading (meaning)
  const match = backText.match(/^([ぁ-んァ-ヶー]+)\s*[-–—\(]/);
  return match ? match[1] : '';
}

/**
 * Create furigana notation from kanji and reading
 */
export function createFuriganaNotation(kanji: string, reading: string): string {
  if (!reading || !hasKanji(kanji)) return kanji;
  return `${kanji}[${reading}]`;
}
