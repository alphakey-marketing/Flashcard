/**
 * Shared types for the Reader feature (tokenised text, vocab state, passages).
 */

export interface Token {
  /** Raw form as it appears in the text (e.g. 食べた). */
  surface: string;
  /** Dictionary/lemma form used as the vocab_status key (e.g. 食べる). */
  dictionaryForm: string;
  /** Hiragana reading. */
  reading: string;
  /** Kuromoji part-of-speech major category (e.g. 名詞, 動詞, 助詞). */
  pos: string;
  /** True for content words worth vocab-tracking (nouns/verbs/adjectives/adverbs). */
  isWord: boolean;
}

/** 0=unknown, 1-4=learning stages, 5=known, 99=ignored. Mirrors vocab_status.status. */
export type VocabStatusValue = 0 | 1 | 2 | 3 | 4 | 5 | 99;

export interface VocabStatus {
  id?: string;
  dictionaryForm: string;
  surface: string;
  reading: string;
  status: VocabStatusValue;
  note?: string;
  timesSeen: number;
  sourcePassageId?: string;
  updatedAt: number;
}

/** One caption cue's timing plus the token range it covers, for video-synced playback/looping. */
export interface CaptionCue {
  text: string;
  startMs: number;
  durMs: number;
  /** Index range into Passage.tokens, [tokenStart, tokenEnd). */
  tokenStart: number;
  tokenEnd: number;
}

export interface Passage {
  id: string;
  title: string;
  sourceType: 'text' | 'url' | 'youtube';
  sourceUrl?: string;
  /** YouTube video ID — present when sourceType === 'youtube' and a video should be embedded. */
  videoId?: string;
  /** Per-cue timing for video-synced A/B looping. Absent when no Japanese captions were found. */
  captionCues?: CaptionCue[];
  collectionId?: string;
  rawText: string;
  tokens: Token[];
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}
