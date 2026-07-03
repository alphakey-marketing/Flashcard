/**
 * Bridges Reader vocabulary tracking to the flashcard deck system, so words
 * a user is "learning" in Reader show up as a real, ordinary FlashcardSet —
 * reviewable through Swipe/LearnMode/etc., not just the dedicated VocabReview
 * page. One auto-managed deck (id = VOCAB_REVIEW_SET_ID, reusing the same id
 * VocabReview already accumulates review history under) is kept in sync with
 * vocab_status: a card exists for a word exactly while its status is in the
 * 1-4 "Learning" range.
 */

import { getAllSets, saveSet } from '../storage';
import type { FlashcardSet, Card } from '../storage';
import { VOCAB_REVIEW_SET_ID, findExampleForWord } from './vocabReview';
import type { VocabStatus } from './types';

const READER_DECK_TITLE = '📖 Reader Vocabulary';
const READER_DECK_DESCRIPTION =
  "Words you're learning in Reader — kept in sync automatically. Change a word's status in Reader to update this deck.";

function getReaderDeck(): FlashcardSet | undefined {
  return getAllSets().find(s => s.id === VOCAB_REVIEW_SET_ID);
}

function ensureReaderDeckExists(): FlashcardSet {
  const existing = getReaderDeck();
  if (existing) return existing;

  const now = Date.now();
  const deck: FlashcardSet = {
    id: VOCAB_REVIEW_SET_ID,
    title: READER_DECK_TITLE,
    description: READER_DECK_DESCRIPTION,
    cards: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  saveSet(deck);
  return deck;
}

/** Keep the auto-managed Reader Vocabulary deck's cards in sync with one word's status. */
export function syncReaderDeckCard(word: VocabStatus): void {
  const inLearningRange = word.status >= 1 && word.status <= 4;
  const deck = inLearningRange ? ensureReaderDeckExists() : getReaderDeck();
  if (!deck) return;

  const existingCard = deck.cards.find(c => c.id === word.dictionaryForm);

  if (!inLearningRange) {
    if (!existingCard) return;
    saveSet({ ...deck, cards: deck.cards.filter(c => c.id !== word.dictionaryForm) });
    return;
  }

  if (existingCard) return; // already tracked — definition was already cached when first added

  const newCard: Card = {
    id: word.dictionaryForm,
    front: word.reading ? `${word.surface}（${word.reading}）` : word.surface,
    back: '…',
    example: findExampleForWord(word.dictionaryForm),
    source: 'Reader',
  };
  saveSet({ ...deck, cards: [...deck.cards, newCard] });

  fetchAndCacheDefinition(word.dictionaryForm);
}

/** One-time background fetch — the deck stores a static definition rather than looking it up on every review. */
async function fetchAndCacheDefinition(dictionaryForm: string): Promise<void> {
  try {
    const res = await fetch('/api/dictionary/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: dictionaryForm }),
    });
    const data = await res.json();
    if (!data?.found || !Array.isArray(data.senses) || data.senses.length === 0) return;

    const definition = data.senses
      .slice(0, 3)
      .map((s: { englishDefinitions: string[] }) => s.englishDefinitions.join('; '))
      .join(' / ');
    if (!definition) return;

    const deck = getReaderDeck();
    if (!deck) return;
    const cardIndex = deck.cards.findIndex(c => c.id === dictionaryForm);
    if (cardIndex < 0) return; // word may have been un-tracked while the lookup was in flight

    saveSet({ ...deck, cards: deck.cards.map((c, i) => (i === cardIndex ? { ...c, back: definition } : c)) });
  } catch (err) {
    console.error('❌ [READER-DECK] Failed to cache definition:', err);
  }
}
