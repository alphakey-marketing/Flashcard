// Sentence builder utility for language learning

export interface Word {
  id: string;
  text: string;
  translation?: string;
  partOfSpeech?: string;
}

export interface SentencePattern {
  id: string;
  pattern: string;
  example: string;
  slots: string[];
}

export interface BuiltSentence {
  text: string;
  words: Word[];
  pattern?: SentencePattern;
}

/**
 * Build a sentence from an array of words
 */
export function buildSentence(words: Word[]): BuiltSentence {
  const text = words.map((word) => word.text).join(' ');
  return {
    text,
    words,
  };
}

/**
 * Build a sentence from a pattern and word slots
 */
export function buildFromPattern(
  pattern: SentencePattern,
  wordMap: Record<string, Word>
): BuiltSentence {
  let text = pattern.pattern;
  const usedWords: Word[] = [];

  pattern.slots.forEach((slot) => {
    const word = wordMap[slot];
    if (word) {
      text = text.replace(`{${slot}}`, word.text);
      usedWords.push(word);
    }
  });

  return {
    text,
    words: usedWords,
    pattern,
  };
}

/**
 * Validate if a sentence follows a pattern
 */
export function validateSentencePattern(
  sentence: string,
  pattern: SentencePattern
): boolean {
  const regex = new RegExp(
    pattern.pattern.replace(/\{\w+\}/g, '\\w+')
  );
  return regex.test(sentence);
}

/**
 * Split sentence into words
 */
export function tokenizeSentence(sentence: string): string[] {
  return sentence
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Join words into a sentence with proper spacing
 */
export function joinWords(words: string[]): string {
  return words.join(' ').trim();
}
