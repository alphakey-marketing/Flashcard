/**
 * Vocab review queue (FR-06).
 * Per the Phase 1 SRS decision: vocab words ride the existing spacedRepetition.ts
 * engine as synthetic cards under this one virtual set ID — keyed by
 * (VOCAB_REVIEW_SET_ID, dictionaryForm) — rather than a parallel progress model.
 */

import { getAllPassages } from './passageStore';
import { getSentenceForTokenIndex } from './textUtils';
import type { VocabStatus } from './types';

export const VOCAB_REVIEW_SET_ID = 'vocab-review';

/** Words in an active learning stage are the only ones that enter the review queue. */
export function getReviewEligibleVocab(vocabMap: Map<string, VocabStatus>): VocabStatus[] {
  return Array.from(vocabMap.values()).filter(v => v.status >= 1 && v.status <= 4);
}

/** Finds the first sentence (across all locally-known passages) containing this word, for review context. */
export function findExampleForWord(dictionaryForm: string): string | undefined {
  const passages = getAllPassages();
  for (const passage of passages) {
    const index = passage.tokens.findIndex(t => t.isWord && t.dictionaryForm === dictionaryForm);
    if (index >= 0) {
      return getSentenceForTokenIndex(passage.tokens, index);
    }
  }
  return undefined;
}
