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
        front: 'こんにちは\nこんにちは、元気ですか。',
        back: 'Hello / Good afternoon\nHello, how are you?'
      },
      {
        id: 'n5-2',
        front: 'ありがとう\nありがとうございます。',
        back: 'Thank you\nThank you very much.'
      },
      {
        id: 'n5-3',
        front: 'すみません\nすみません、トイレはどこですか。',
        back: 'Excuse me / Sorry\nExcuse me, where is the toilet?'
      },
      {
        id: 'n5-4',
        front: 'おはよう\nおはようございます。',
        back: 'Good morning\nGood morning.'
      },
      {
        id: 'n5-5',
        front: 'さようなら\nさようなら、また明日。',
        back: 'Goodbye\nGoodbye, see you tomorrow.'
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
        front: '便利[べんり]\nこの町は便利です。',
        back: 'Convenient\nThis town is convenient.'
      },
      {
        id: 'n4-2',
        front: '楽しい[たのしい]\n日本語の勉強は楽しいです。',
        back: 'Fun / Enjoyable\nStudying Japanese is fun.'
      },
      {
        id: 'n4-3',
        front: '残念[ざんねん]\n残念ですが、行けません。',
        back: 'Regrettable / Too bad\nUnfortunately, I cannot go.'
      },
      {
        id: 'n4-4',
        front: '危険[きけん]\nここは危険です。',
        back: 'Dangerous\nThis place is dangerous.'
      },
      {
        id: 'n4-5',
        front: '静か[しずか]\n図書館は静かです。',
        back: 'Quiet\nThe library is quiet.'
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
        front: '提出[ていしゅつ]\nレポートの提出は明日です。',
        back: 'Submission\nThe report submission is tomorrow.'
      },
      {
        id: 'n3-2',
        front: '増加[ぞうか]\n人口が増加している。',
        back: 'Increase\nThe population is increasing.'
      },
      {
        id: 'n3-3',
        front: '設置[せっち]\n駅に自動販売機を設置した。',
        back: 'Installation / Establishment\nThey installed a vending machine at the station.'
      },
      {
        id: 'n3-4',
        front: '承知[しょうち]\n承知しました。',
        back: 'Acknowledgment / Understanding\nI understand / Acknowledged.'
      },
      {
        id: 'n3-5',
        front: '解決[かいけつ]\n問題を解決しました。',
        back: 'Solution / Resolution\nI solved the problem.'
      }
    ]
  }
];

export default jlptTemplates;
