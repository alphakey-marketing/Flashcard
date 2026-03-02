export interface FlashcardSet {
  id: string;
  name: string;
  description: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  example?: string;
}

const currentDate = new Date().toISOString();

export const jlptTemplates: FlashcardSet[] = [
  {
    id: 'jlpt-n5-vocab',
    name: 'JLPT N5 Vocabulary',
    description: 'Essential vocabulary for JLPT N5 level',
    createdAt: currentDate,
    updatedAt: currentDate,
    cards: [
      {
        id: 'n5-1',
        front: 'こんにちは',
        back: 'Hello / Good afternoon',
        example: 'こんにちは、元気ですか。(Hello, how are you?)'
      },
      {
        id: 'n5-2',
        front: 'ありがとう',
        back: 'Thank you',
        example: 'ありがとうございます。(Thank you very much.)'
      },
      {
        id: 'n5-3',
        front: 'すみません',
        back: 'Excuse me / Sorry',
        example: 'すみません、トイレはどこですか。(Excuse me, where is the toilet?)'
      }
    ]
  },
  {
    id: 'jlpt-n4-vocab',
    name: 'JLPT N4 Vocabulary',
    description: 'Essential vocabulary for JLPT N4 level',
    createdAt: currentDate,
    updatedAt: currentDate,
    cards: [
      {
        id: 'n4-1',
        front: '便利（べんり）',
        back: 'Convenient',
        example: 'この町は便利です。(This town is convenient.)'
      },
      {
        id: 'n4-2',
        front: '楽しい（たのしい）',
        back: 'Fun / Enjoyable',
        example: '日本語の勉強は楽しいです。(Studying Japanese is fun.)'
      },
      {
        id: 'n4-3',
        front: '残念（ざんねん）',
        back: 'Regrettable / Too bad',
        example: '残念ですが、行けません。(Unfortunately, I cannot go.)'
      }
    ]
  },
  {
    id: 'jlpt-n3-vocab',
    name: 'JLPT N3 Vocabulary',
    description: 'Essential vocabulary for JLPT N3 level',
    createdAt: currentDate,
    updatedAt: currentDate,
    cards: [
      {
        id: 'n3-1',
        front: '提出（ていしゅつ）',
        back: 'Submission',
        example: 'レポートの提出は明日です。(The report submission is tomorrow.)'
      },
      {
        id: 'n3-2',
        front: '増加（ぞうか）',
        back: 'Increase',
        example: '人口が増加している。(The population is increasing.)'
      },
      {
        id: 'n3-3',
        front: '設置（せっち）',
        back: 'Installation / Establishment',
        example: '駅に自動販売機を設置した。(They installed a vending machine at the station.)'
      }
    ]
  }
];

export default jlptTemplates;
