/**
 * Client-side Japanese vocab extractor.
 * Tokenises pasted text into flashcard candidates using regex-based heuristics.
 * The `extractVocab` function is the regex fallback path.
 * The `extractVocabWithAI` function is the preferred AI-powered path.
 */

export type JlptLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'unknown';

/** A single vocabulary candidate extracted from a paragraph of Japanese text. */
export interface ExtractedVocab {
  /** Stable unique identifier for this candidate within the current extraction. */
  id: string;
  /** Raw extracted word/token as it appears in the text. */
  word: string;
  /** Furigana reading — empty until populated by the Generate API. */
  reading: string;
  /** English meaning — empty until populated by the Generate API. */
  meaning: string;
  /** The original sentence from the pasted text that contains this word. */
  exampleSentence: string;
  /** Generated card front (reading[kana] + "\n\n" + example) — empty until generated. */
  front: string;
  /** Generated card back (meaning + "\n\n" + translation) — empty until generated. */
  back: string;
  /** Whether this is a common function/grammar word (hidden by default). */
  isCommon: boolean;
  /** Whether the Generate API has been called successfully for this word. */
  isGenerated: boolean;
  /** JLPT level for this word — only populated when extracted by AI. */
  jlptLevel?: JlptLevel;
  /** True when this vocab item was extracted via the AI endpoint (vs regex fallback). */
  extractedByAI?: boolean;
}

// ---------------------------------------------------------------------------
// Common Japanese function / grammar words that add little vocabulary value.
// Shown only when the "Show common words" toggle is enabled.
// ---------------------------------------------------------------------------
const COMMON_WORDS = new Set([
  // Particles / postpositions
  'から', 'まで', 'より', 'ほど', 'だけ', 'しか', 'ばかり', 'など',
  'ので', 'のに', 'けど', 'けれど', 'ても', 'だって',
  // Conjunctions
  'そして', 'しかし', 'また', 'または', 'あるいは', 'ただし',
  'ところで', 'ちなみに', 'なぜなら', 'だから', 'したがって', 'それで',
  // Grammatical auxiliaries / light verbs
  'する', 'ある', 'いる', 'なる', 'くる', 'いく', 'もらう', 'くれる', 'あげる',
  'できる', 'みる', 'おく', 'しまう', 'いただく', 'ください',
  // Demonstrative pronouns
  'これ', 'それ', 'あれ', 'どれ', 'ここ', 'そこ', 'あそこ', 'どこ',
  'こんな', 'そんな', 'あんな', 'どんな', 'こう', 'そう', 'ああ', 'どう',
  // Formal/abstract nouns (highly grammaticalised)
  'こと', 'もの', 'とき', 'ため', 'ところ', 'わけ', 'はず', 'つもり',
  'ほう', 'よう', 'かた', 'ごと', 'たち', 'ひと',
  // Common greetings / exclamations
  'こんにちは', 'ありがとう', 'すみません', 'おはよう', 'こんばんは', 'さようなら',
  'ごめんなさい',
  // Verb conjugation endings that appear as standalone hiragana runs
  'ます', 'ました', 'ません', 'ませんでした',
  'です', 'でした', 'ではない', 'ではありません',
  'ている', 'ていた', 'ていない', 'ています', 'ていました', 'いています', 'いていた',
  'します', 'しました', 'している', 'していた', 'していない',
  'います', 'いました', 'ありました', 'なりました',
  'てから', 'てもいい', 'てください', 'てみる', 'てみた',
  'だった', 'だろう', 'でしょう', 'らしい', 'らしかった',
  'ながら', 'みながら', 'けれども', 'それから', 'それでは', 'ところが',
  // Adjective conjugations
  'かった', 'かったです', 'くない', 'くなかった',
  // Common adverbs / intensifiers (hiragana-only, not vocab targets)
  'とても', 'もっと', 'すごく', 'ちょっと', 'ちゃんと', 'きっと', 'やはり',
  'もちろん', 'たぶん', 'ほんとう', 'ほんとうに', 'やっぱり', 'なんとなく',
  // Common connective / trailing hiragana phrases
  'はとても', 'ように', 'ために', 'について', 'とおり', 'みたい',
  'らしく', 'だから', 'ところ', 'ながらも', 'かもしれない', 'かもしれません',
]);

// ---------------------------------------------------------------------------
// Regex for extracting meaningful Japanese tokens.
//   1. Pure kanji runs  (今日, 図書館, 勉強, 日本語, 帰宅)
//   2. Pure katakana words  2+ chars  (コーヒー, テレビ)
//   3. Pure hiragana words  3+ chars  (ありがとう, もちろん)
// ---------------------------------------------------------------------------
const WORD_RE = /[\u4e00-\u9faf\u3400-\u4dbf]+|[\u30a0-\u30ff]{2,}|[\u3040-\u309f]{3,}/g;

/** Split a block of text into individual sentences on Japanese punctuation / newlines. */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buf += ch;
    if (ch === '。' || ch === '！' || ch === '？' || ch === '\n') {
      const trimmed = buf.trim();
      if (trimmed.length > 0) sentences.push(trimmed);
      buf = '';
    }
  }
  if (buf.trim().length > 0) sentences.push(buf.trim());
  return sentences;
}

/**
 * Extract vocabulary candidates from a block of Japanese text using regex heuristics.
 * This is the fallback path used when the AI endpoint is unavailable.
 *
 * Returns a deduplicated list ordered by first appearance, with
 * non-common words first, followed by common/function words.
 */
export function extractVocab(text: string): ExtractedVocab[] {
  const sentences = splitSentences(text);

  // Map: word → first sentence it appeared in (preserves insertion order = appearance order)
  const wordToSentence = new Map<string, string>();

  for (const sentence of sentences) {
    const matches = sentence.match(new RegExp(WORD_RE.source, 'g')) ?? [];
    for (const word of matches) {
      if (!wordToSentence.has(word)) {
        wordToSentence.set(word, sentence);
      }
    }
  }

  const all: ExtractedVocab[] = Array.from(wordToSentence.entries()).map(
    ([word, sentence]) => ({
      id: crypto.randomUUID(),
      word,
      reading: '',
      meaning: '',
      exampleSentence: sentence,
      front: '',
      back: '',
      isCommon: COMMON_WORDS.has(word),
      isGenerated: false,
      extractedByAI: false,
    })
  );

  // Sort: non-common words first (preserving relative order), then common words
  return [
    ...all.filter(v => !v.isCommon),
    ...all.filter(v => v.isCommon),
  ];
}

/**
 * Extract vocabulary candidates using the AI endpoint.
 * Returns words with JLPT levels, dictionary forms, readings, and meanings pre-filled.
 * Throws on any failure — callers should catch and fall back to extractVocab().
 */
export async function extractVocabWithAI(text: string): Promise<ExtractedVocab[]> {
  const response = await fetch('/api/extract-vocab', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  // Treat both 429 and 500 (extraction_failed) as fallback triggers
  if (!response.ok) {
    const err = await response.json().catch(() => ({} as Record<string, string>));
    throw new Error(err.error ?? `HTTP ${response.status}`);
  }

  const { words } = await response.json() as {
    words: { word: string; reading?: string; meaning?: string; jlptLevel?: string }[];
  };

  // Build sentence map from original text to attach exampleSentence
  const sentences = splitSentences(text);
  const findSentence = (word: string) =>
    sentences.find(s => s.includes(word)) ?? sentences[0] ?? '';

  return words.map(w => ({
    id: crypto.randomUUID(),
    word: w.word,
    reading: w.reading ?? '',
    meaning: w.meaning ?? '',
    exampleSentence: findSentence(w.word),
    front: '',
    back: '',
    isCommon: false,      // AI already filtered; nothing is "common" in its output
    isGenerated: false,
    extractedByAI: true,
  }));
}
