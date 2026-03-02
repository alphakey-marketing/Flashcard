import { FlashcardSet } from '../lib/storage';

const currentTimestamp = Date.now();

export const jlptTemplates: FlashcardSet[] = [
  {
    id: 'jlpt-n5-vocab',
    title: 'JLPT N5 Vocabulary',
    description: 'Essential vocabulary for JLPT N5 level',
    jlptLevel: 'N5',
    tags: ['JLPT', 'N5', 'vocabulary'],
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
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
      },
      {
        id: 'n5-4',
        front: 'おはよう',
        back: 'Good morning',
        example: 'おはようございます。(Good morning.)'
      },
      {
        id: 'n5-5',
        front: 'さようなら',
        back: 'Goodbye',
        example: 'さようなら、また明日。(Goodbye, see you tomorrow.)'
      }
    ]
  },
  {
    id: 'jlpt-n4-vocab',
    title: 'JLPT N4 Vocabulary',
    description: 'Essential vocabulary for JLPT N4 level',
    jlptLevel: 'N4',
    tags: ['JLPT', 'N4', 'vocabulary'],
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
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
      },
      {
        id: 'n4-4',
        front: '危険（きけん）',
        back: 'Dangerous',
        example: 'ここは危険です。(This place is dangerous.)'
      },
      {
        id: 'n4-5',
        front: '静か（しずか）',
        back: 'Quiet',
        example: '図書館は静かです。(The library is quiet.)'
      }
    ]
  },
  {
    id: 'jlpt-n3-vocab',
    title: 'JLPT N3 Vocabulary',
    description: 'Essential vocabulary for JLPT N3 level',
    jlptLevel: 'N3',
    tags: ['JLPT', 'N3', 'vocabulary'],
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
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
      },
      {
        id: 'n3-4',
        front: '承知（しょうち）',
        back: 'Acknowledgment / Understanding',
        example: '承知しました。(I understand / Acknowledged.)'
      },
      {
        id: 'n3-5',
        front: '解決（かいけつ）',
        back: 'Solution / Resolution',
        example: '問題を解決しました。(I solved the problem.)'
      }
    ]
  }
];

export default jlptTemplates;
