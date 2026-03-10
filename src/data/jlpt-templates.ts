import { FlashcardSet } from '../lib/storage';
import { n4Sets } from './n4-sets-1-5';

const currentTimestamp = Date.now();

// N5 Complete Sets
const n5Sets: FlashcardSet[] = [
  {
    id: "n5-complete-1",
    title: "JLPT N5 - Greetings & Basic Expressions",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "1",
        front: "おはよう\n\nおはようございます。",
        back: "Good morning\n\nGood morning."
      },
      {
        id: "2",
        front: "こんにちは\n\nこんにちは、田中さん。",
        back: "Hello, Good afternoon\n\nHello, Mr. Tanaka."
      },
      {
        id: "3",
        front: "こんばんは\n\nこんばんは、みなさん。",
        back: "Good evening\n\nGood evening, everyone."
      },
      {
        id: "4",
        front: "さようなら\n\nさようなら、また明日。",
        back: "Goodbye\n\nGoodbye, see you tomorrow."
      },
      {
        id: "5",
        front: "ありがとう\n\nありがとうございます。",
        back: "Thank you\n\nThank you very much."
      },
      {
        id: "6",
        front: "すみません\n\nすみません、ちょっといいですか。",
        back: "Excuse me, Sorry\n\nExcuse me, may I have a moment?"
      },
      {
        id: "7",
        front: "ごめんなさい\n\n遅れてごめんなさい。",
        back: "I'm sorry\n\nI'm sorry for being late."
      },
      {
        id: "8",
        front: "いただきます\n\nいただきます。",
        back: "Let's eat (before meal)\n\nLet's eat. (said before eating)"
      },
      {
        id: "9",
        front: "ごちそうさま\n\nごちそうさまでした。",
        back: "Thank you for the meal\n\nThank you for the meal."
      },
      {
        id: "10",
        front: "おやすみなさい\n\nおやすみなさい、また明日。",
        back: "Good night\n\nGood night, see you tomorrow."
      },
      {
        id: "11",
        front: "はい\n\nはい、分かりました。",
        back: "Yes\n\nYes, I understood."
      },
      {
        id: "12",
        front: "いいえ\n\nいいえ、違います。",
        back: "No\n\nNo, that's not right."
      },
      {
        id: "13",
        front: "どうぞ\n\nどうぞ、入ってください。",
        back: "Please, Go ahead\n\nPlease come in."
      },
      {
        id: "14",
        front: "どうも\n\nどうもありがとう。",
        back: "Thanks (casual)\n\nThanks very much."
      },
      {
        id: "15",
        front: "お願いします[おねがいします]\n\nお願いします。",
        back: "Please (request)\n\nPlease (do this for me)."
      },
      {
        id: "16",
        front: "失礼します[しつれいします]\n\n失礼します。",
        back: "Excuse me (leaving)\n\nExcuse me. (when leaving)"
      },
      {
        id: "17",
        front: "いらっしゃいませ\n\nいらっしゃいませ。",
        back: "Welcome\n\nWelcome! (to a store)"
      },
      {
        id: "18",
        front: "また\n\nまた会いましょう。",
        back: "Again, See you\n\nLet's meet again."
      },
      {
        id: "19",
        front: "じゃあ\n\nじゃあ、行きましょう。",
        back: "Well then\n\nWell then, let's go."
      },
      {
        id: "20",
        front: "ちょっと\n\nちょっと待ってください。",
        back: "A little, Wait\n\nPlease wait a moment."
      }
    ]
  },
  {
    id: "n5-complete-2",
    title: "JLPT N5 - Numbers & Counting",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "21",
        front: "零[れい]/ゼロ\n\n零点です。",
        back: "Zero\n\nIt's zero points."
      },
      {
        id: "22",
        front: "一[いち]\n\n一つください。",
        back: "One\n\nOne, please."
      },
      {
        id: "23",
        front: "二[に]\n\n二人で行きます。",
        back: "Two\n\nTwo people will go."
      },
      {
        id: "24",
        front: "三[さん]\n\n三時に会いましょう。",
        back: "Three\n\nLet's meet at 3 o'clock."
      },
      {
        id: "25",
        front: "四[よん/し]\n\n四月に日本へ行きます。",
        back: "Four\n\nI'll go to Japan in April."
      },
      {
        id: "26",
        front: "五[ご]\n\n五千円です。",
        back: "Five\n\nIt's 5,000 yen."
      },
      {
        id: "27",
        front: "六[ろく]\n\n六時に起きます。",
        back: "Six\n\nI wake up at 6 o'clock."
      },
      {
        id: "28",
        front: "七[なな/しち]\n\n七月は暑いです。",
        back: "Seven\n\nJuly is hot."
      },
      {
        id: "29",
        front: "八[はち]\n\n八百円です。",
        back: "Eight\n\nIt's 800 yen."
      },
      {
        id: "30",
        front: "九[きゅう/く]\n\n九時に寝ます。",
        back: "Nine\n\nI go to bed at 9 o'clock."
      },
      {
        id: "31",
        front: "十[じゅう]\n\n十分です。",
        back: "Ten\n\nTen minutes is enough."
      },
      {
        id: "32",
        front: "百[ひゃく]\n\n百円のペンを買いました。",
        back: "Hundred\n\nI bought a 100 yen pen."
      },
      {
        id: "33",
        front: "千[せん]\n\n千円札をください。",
        back: "Thousand\n\nPlease give me a 1,000 yen bill."
      },
      {
        id: "34",
        front: "万[まん]\n\n一万円あります。",
        back: "Ten thousand\n\nI have 10,000 yen."
      },
      {
        id: "35",
        front: "何[なん/なに]\n\n何時ですか。",
        back: "What, How many\n\nWhat time is it?"
      },
      {
        id: "36",
        front: "いくつ\n\nいくつ欲しいですか。",
        back: "How many, How old\n\nHow many do you want?"
      },
      {
        id: "37",
        front: "いくら\n\nこれはいくらですか。",
        back: "How much\n\nHow much is this?"
      },
      {
        id: "38",
        front: "一つ[ひとつ]\n\n一つください。",
        back: "One (thing)\n\nGive me one please."
      },
      {
        id: "39",
        front: "二つ[ふたつ]\n\nりんごを二つ買いました。",
        back: "Two (things)\n\nI bought two apples."
      },
      {
        id: "40",
        front: "三つ[みっつ]\n\n三つあります。",
        back: "Three (things)\n\nThere are three."
      },
      {
        id: "41",
        front: "四つ[よっつ]\n\n四つ選んでください。",
        back: "Four (things)\n\nPlease choose four."
      },
      {
        id: "42",
        front: "五つ[いつつ]\n\n五つ見つけました。",
        back: "Five (things)\n\nI found five."
      },
      {
        id: "43",
        front: "六つ[むっつ]\n\n六つ持っています。",
        back: "Six (things)\n\nI have six."
      },
      {
        id: "44",
        front: "七つ[ななつ]\n\n七つ食べました。",
        back: "Seven (things)\n\nI ate seven."
      },
      {
        id: "45",
        front: "八つ[やっつ]\n\n八つ作りました。",
        back: "Eight (things)\n\nI made eight."
      },
      {
        id: "46",
        front: "九つ[ここのつ]\n\n九つ残っています。",
        back: "Nine (things)\n\nNine remain."
      },
      {
        id: "47",
        front: "十[とお]\n\n十全部ください。",
        back: "Ten (things)\n\nGive me all ten please."
      },
      {
        id: "48",
        front: "幾つ[いくつ]\n\n幾つ必要ですか。",
        back: "How many\n\nHow many do you need?"
      },
      {
        id: "49",
        front: "半分[はんぶん]\n\n半分食べました。",
        back: "Half\n\nI ate half."
      },
      {
        id: "50",
        front: "全部[ぜんぶ]\n\n全部終わりました。",
        back: "All, Everything\n\nI finished everything."
      }
    ]
  },
  {
    id: "n5-complete-3",
    title: "JLPT N5 - Time & Calendar",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "51",
        front: "今[いま]\n\n今、何時ですか。",
        back: "Now\n\nWhat time is it now?"
      },
      {
        id: "52",
        front: "今日[きょう]\n\n今日は暑いですね。",
        back: "Today\n\nIt's hot today, isn't it?"
      },
      {
        id: "53",
        front: "昨日[きのう]\n\n昨日、映画を見ました。",
        back: "Yesterday\n\nI watched a movie yesterday."
      },
      {
        id: "54",
        front: "明日[あした]\n\n明日、学校へ行きます。",
        back: "Tomorrow\n\nI'll go to school tomorrow."
      },
      {
        id: "55",
        front: "今朝[けさ]\n\n今朝、パンを食べました。",
        back: "This morning\n\nI ate bread this morning."
      },
      {
        id: "56",
        front: "今晩[こんばん]\n\n今晩、友達が来ます。",
        back: "Tonight\n\nMy friend will come tonight."
      },
      {
        id: "57",
        front: "毎日[まいにち]\n\n毎日、日本語を勉強します。",
        back: "Every day\n\nI study Japanese every day."
      },
      {
        id: "58",
        front: "毎朝[まいあさ]\n\n毎朝、コーヒーを飲みます。",
        back: "Every morning\n\nI drink coffee every morning."
      },
      {
        id: "59",
        front: "毎晩[まいばん]\n\n毎晩、本を読みます。",
        back: "Every night\n\nI read books every night."
      },
      {
        id: "60",
        front: "毎週[まいしゅう]\n\n毎週、映画を見ます。",
        back: "Every week\n\nI watch movies every week."
      },
      {
        id: "61",
        front: "先週[せんしゅう]\n\n先週、京都へ行きました。",
        back: "Last week\n\nI went to Kyoto last week."
      },
      {
        id: "62",
        front: "来週[らいしゅう]\n\n来週、試験があります。",
        back: "Next week\n\nI have an exam next week."
      },
      {
        id: "63",
        front: "今週[こんしゅう]\n\n今週は忙しいです。",
        back: "This week\n\nI'm busy this week."
      },
      {
        id: "64",
        front: "先月[せんげつ]\n\n先月、誕生日でした。",
        back: "Last month\n\nIt was my birthday last month."
      },
      {
        id: "65",
        front: "来月[らいげつ]\n\n来月、旅行します。",
        back: "Next month\n\nI'll travel next month."
      },
      {
        id: "66",
        front: "今月[こんげつ]\n\n今月は寒いです。",
        back: "This month\n\nIt's cold this month."
      },
      {
        id: "67",
        front: "去年[きょねん]\n\n去年、日本へ来ました。",
        back: "Last year\n\nI came to Japan last year."
      },
      {
        id: "68",
        front: "来年[らいねん]\n\n来年、結婚します。",
        back: "Next year\n\nI'll get married next year."
      },
      {
        id: "69",
        front: "今年[ことし]\n\n今年は楽しかったです。",
        back: "This year\n\nThis year was fun."
      },
      {
        id: "70",
        front: "朝[あさ]\n\n朝ご飯を食べます。",
        back: "Morning\n\nI eat breakfast."
      },
      {
        id: "71",
        front: "昼[ひる]\n\n昼ご飯は何ですか。",
        back: "Noon, Daytime\n\nWhat's for lunch?"
      },
      {
        id: "72",
        front: "晩[ばん]\n\n晩ご飯を作ります。",
        back: "Evening, Night\n\nI'll make dinner."
      },
      {
        id: "73",
        front: "夜[よる]\n\n夜、勉強します。",
        back: "Night\n\nI study at night."
      },
      {
        id: "74",
        front: "午前[ごぜん]\n\n午前十時に会議があります。",
        back: "Morning, AM\n\nThere's a meeting at 10 AM."
      },
      {
        id: "75",
        front: "午後[ごご]\n\n午後三時に帰ります。",
        back: "Afternoon, PM\n\nI'll go home at 3 PM."
      },
      {
        id: "76",
        front: "時[とき]\n\n子供の時、ここに住んでいました。",
        back: "Time, When\n\nI lived here when I was a child."
      },
      {
        id: "77",
        front: "時間[じかん]\n\n時間がありません。",
        back: "Time, Hour\n\nI don't have time."
      },
      {
        id: "78",
        front: "〜時[〜じ]\n\n三時です。",
        back: "O'clock\n\nIt's 3 o'clock."
      },
      {
        id: "79",
        front: "〜分[〜ふん/〜ぷん]\n\n十分待ってください。",
        back: "Minute\n\nPlease wait 10 minutes."
      },
      {
        id: "80",
        front: "半[はん]\n\n三時半に会いましょう。",
        back: "Half\n\nLet's meet at 3:30."
      },
      {
        id: "81",
        front: "月曜日[げつようび]\n\n月曜日は忙しいです。",
        back: "Monday\n\nMonday is busy."
      },
      {
        id: "82",
        front: "火曜日[かようび]\n\n火曜日に会議があります。",
        back: "Tuesday\n\nI have a meeting on Tuesday."
      },
      {
        id: "83",
        front: "水曜日[すいようび]\n\n水曜日は休みです。",
        back: "Wednesday\n\nWednesday is my day off."
      },
      {
        id: "84",
        front: "木曜日[もくようび]\n\n木曜日に買い物します。",
        back: "Thursday\n\nI'll go shopping on Thursday."
      },
      {
        id: "85",
        front: "金曜日[きんようび]\n\n金曜日は嬉しいです。",
        back: "Friday\n\nI'm happy on Friday."
      },
      {
        id: "86",
        front: "土曜日[どようび]\n\n土曜日に映画を見ます。",
        back: "Saturday\n\nI'll watch a movie on Saturday."
      },
      {
        id: "87",
        front: "日曜日[にちようび]\n\n日曜日は休みます。",
        back: "Sunday\n\nI rest on Sunday."
      },
      {
        id: "88",
        front: "何曜日[なんようび]\n\n今日は何曜日ですか。",
        back: "What day of the week\n\nWhat day is it today?"
      },
      {
        id: "89",
        front: "週[しゅう]\n\n一週間休みます。",
        back: "Week\n\nI'll rest for one week."
      },
      {
        id: "90",
        front: "週末[しゅうまつ]\n\n週末に旅行します。",
        back: "Weekend\n\nI'll travel on the weekend."
      }
    ]
  },
  {
    id: "n5-complete-4",
    title: "JLPT N5 - Family & People",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "91",
        front: "私[わたし]\n\n私は学生です。",
        back: "I, Me\n\nI am a student."
      },
      {
        id: "92",
        front: "あなた\n\nあなたは先生ですか。",
        back: "You\n\nAre you a teacher?"
      },
      {
        id: "93",
        front: "彼[かれ]\n\n彼は親切です。",
        back: "He, Boyfriend\n\nHe is kind."
      },
      {
        id: "94",
        front: "彼女[かのじょ]\n\n彼女は綺麗です。",
        back: "She, Girlfriend\n\nShe is beautiful."
      },
      {
        id: "95",
        front: "家族[かぞく]\n\n家族と旅行します。",
        back: "Family\n\nI'll travel with my family."
      },
      {
        id: "96",
        front: "父[ちち]\n\n父は医者です。",
        back: "Father (own)\n\nMy father is a doctor."
      },
      {
        id: "97",
        front: "母[はは]\n\n母は料理が上手です。",
        back: "Mother (own)\n\nMy mother is good at cooking."
      },
      {
        id: "98",
        front: "お父さん[おとうさん]\n\nお父さんは元気ですか。",
        back: "Father (someone else's)\n\nIs your father well?"
      },
      {
        id: "99",
        front: "お母さん[おかあさん]\n\nお母さんはどこですか。",
        back: "Mother (someone else's)\n\nWhere is your mother?"
      },
      {
        id: "100",
        front: "兄[あに]\n\n兄は会社員です。",
        back: "Older brother (own)\n\nMy older brother is an office worker."
      },
      {
        id: "101",
        front: "姉[あね]\n\n姉は東京に住んでいます。",
        back: "Older sister (own)\n\nMy older sister lives in Tokyo."
      },
      {
        id: "102",
        front: "お兄さん[おにいさん]\n\nお兄さんは何歳ですか。",
        back: "Older brother (someone else's)\n\nHow old is your older brother?"
      },
      {
        id: "103",
        front: "お姉さん[おねえさん]\n\nお姉さんは優しいですね。",
        back: "Older sister (someone else's)\n\nYour older sister is kind."
      },
      {
        id: "104",
        front: "弟[おとうと]\n\n弟は高校生です。",
        back: "Younger brother\n\nMy younger brother is a high school student."
      },
      {
        id: "105",
        front: "妹[いもうと]\n\n妹は可愛いです。",
        back: "Younger sister\n\nMy younger sister is cute."
      },
      {
        id: "106",
        front: "兄弟[きょうだい]\n\n兄弟がいますか。",
        back: "Siblings\n\nDo you have siblings?"
      },
      {
        id: "107",
        front: "子供[こども]\n\n子供が三人います。",
        back: "Child, Children\n\nI have three children."
      },
      {
        id: "108",
        front: "赤ちゃん[あかちゃん]\n\n赤ちゃんが泣いています。",
        back: "Baby\n\nThe baby is crying."
      },
      {
        id: "109",
        front: "男[おとこ]\n\n男の人が立っています。",
        back: "Man, Male\n\nA man is standing."
      },
      {
        id: "110",
        front: "女[おんな]\n\n女の人が歩いています。",
        back: "Woman, Female\n\nA woman is walking."
      },
      {
        id: "111",
        front: "男の子[おとこのこ]\n\n男の子が遊んでいます。",
        back: "Boy\n\nThe boy is playing."
      },
      {
        id: "112",
        front: "女の子[おんなのこ]\n\n女の子が歌っています。",
        back: "Girl\n\nThe girl is singing."
      },
      {
        id: "113",
        front: "人[ひと]\n\nたくさん人がいます。",
        back: "Person, People\n\nThere are many people."
      },
      {
        id: "114",
        front: "友達[ともだち]\n\n友達と遊びます。",
        back: "Friend\n\nI'll hang out with friends."
      },
      {
        id: "115",
        front: "先生[せんせい]\n\n先生は優しいです。",
        back: "Teacher\n\nThe teacher is kind."
      },
      {
        id: "116",
        front: "学生[がくせい]\n\n私は大学生です。",
        back: "Student\n\nI am a university student."
      },
      {
        id: "117",
        front: "大人[おとな]\n\n大人になりたいです。",
        back: "Adult\n\nI want to become an adult."
      },
      {
        id: "118",
        front: "名前[なまえ]\n\n名前は何ですか。",
        back: "Name\n\nWhat is your name?"
      },
      {
        id: "119",
        front: "誕生日[たんじょうび]\n\n誕生日おめでとう。",
        back: "Birthday\n\nHappy birthday."
      },
      {
        id: "120",
        front: "歳[さい]\n\n私は二十歳です。",
        back: "Years old\n\nI am 20 years old."
      }
    ]
  },
  {
    id: "n5-complete-5",
    title: "JLPT N5 - Food & Drink",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "121",
        front: "食べ物[たべもの]\n\n好きな食べ物は何ですか。",
        back: "Food\n\nWhat food do you like?"
      },
      {
        id: "122",
        front: "飲み物[のみもの]\n\n冷たい飲み物をください。",
        back: "Drink, Beverage\n\nPlease give me a cold drink."
      },
      {
        id: "123",
        front: "ご飯[ごはん]\n\nご飯を食べましょう。",
        back: "Rice, Meal\n\nLet's eat."
      },
      {
        id: "124",
        front: "パン\n\n朝、パンを食べます。",
        back: "Bread\n\nI eat bread in the morning."
      },
      {
        id: "125",
        front: "肉[にく]\n\n肉が好きです。",
        back: "Meat\n\nI like meat."
      },
      {
        id: "126",
        front: "魚[さかな]\n\n魚を食べますか。",
        back: "Fish\n\nDo you eat fish?"
      },
      {
        id: "127",
        front: "野菜[やさい]\n\n野菜は体にいいです。",
        back: "Vegetables\n\nVegetables are good for your body."
      },
      {
        id: "128",
        front: "果物[くだもの]\n\n果物を買いました。",
        back: "Fruit\n\nI bought fruit."
      },
      {
        id: "129",
        front: "卵[たまご]\n\n卵を二つください。",
        back: "Egg\n\nPlease give me two eggs."
      },
      {
        id: "130",
        front: "牛乳[ぎゅうにゅう]\n\n牛乳を飲みます。",
        back: "Milk\n\nI drink milk."
      },
      {
        id: "131",
        front: "水[みず]\n\n水をください。",
        back: "Water\n\nWater, please."
      },
      {
        id: "132",
        front: "お茶[おちゃ]\n\nお茶を飲みましょう。",
        back: "Tea\n\nLet's have tea."
      },
      {
        id: "133",
        front: "コーヒー\n\nコーヒーが好きです。",
        back: "Coffee\n\nI like coffee."
      },
      {
        id: "134",
        front: "ジュース\n\nオレンジジュースをください。",
        back: "Juice\n\nOrange juice, please."
      },
      {
        id: "135",
        front: "お酒[おさけ]\n\nお酒を飲みますか。",
        back: "Alcohol, Sake\n\nDo you drink alcohol?"
      },
      {
        id: "136",
        front: "ビール\n\nビールを一つください。",
        back: "Beer\n\nOne beer, please."
      },
      {
        id: "137",
        front: "朝ご飯[あさごはん]\n\n朝ご飯は何ですか。",
        back: "Breakfast\n\nWhat's for breakfast?"
      },
      {
        id: "138",
        front: "昼ご飯[ひるごはん]\n\n昼ご飯を食べましょう。",
        back: "Lunch\n\nLet's have lunch."
      },
      {
        id: "139",
        front: "晩ご飯[ばんごはん]\n\n晩ご飯を作ります。",
        back: "Dinner\n\nI'll make dinner."
      },
      {
        id: "140",
        front: "料理[りょうり]\n\n日本料理が好きです。",
        back: "Cooking, Cuisine\n\nI like Japanese cuisine."
      },
      {
        id: "141",
        front: "味[あじ]\n\nこの味が好きです。",
        back: "Taste, Flavor\n\nI like this taste."
      },
      {
        id: "142",
        front: "塩[しお]\n\n塩を取ってください。",
        back: "Salt\n\nPlease pass the salt."
      },
      {
        id: "143",
        front: "砂糖[さとう]\n\n砂糖を入れますか。",
        back: "Sugar\n\nDo you take sugar?"
      },
      {
        id: "144",
        front: "りんご\n\nりんごを食べます。",
        back: "Apple\n\nI'll eat an apple."
      },
      {
        id: "145",
        front: "みかん\n\nみかんが好きです。",
        back: "Mandarin orange\n\nI like mandarins."
      },
      {
        id: "146",
        front: "バナナ\n\nバナナは甘いです。",
        back: "Banana\n\nBananas are sweet."
      },
      {
        id: "147",
        front: "ぶどう\n\nぶどうを買いました。",
        back: "Grapes\n\nI bought grapes."
      },
      {
        id: "148",
        front: "いちご\n\nいちごが美味しいです。",
        back: "Strawberry\n\nStrawberries are delicious."
      },
      {
        id: "149",
        front: "トマト\n\nトマトが好きです。",
        back: "Tomato\n\nI like tomatoes."
      },
      {
        id: "150",
        front: "レタス\n\nレタスを買いました。",
        back: "Lettuce\n\nI bought lettuce."
      },
      {
        id: "151",
        front: "にんじん\n\nにんじんは体にいいです。",
        back: "Carrot\n\nCarrots are good for health."
      },
      {
        id: "152",
        front: "じゃがいも\n\nじゃがいもを煮ます。",
        back: "Potato\n\nI'll boil potatoes."
      },
      {
        id: "153",
        front: "玉ねぎ[たまねぎ]\n\n玉ねぎを切ります。",
        back: "Onion\n\nI'll cut onions."
      },
      {
        id: "154",
        front: "ケーキ\n\nケーキを作りました。",
        back: "Cake\n\nI made a cake."
      },
      {
        id: "155",
        front: "チョコレート\n\nチョコレートが好きです。",
        back: "Chocolate\n\nI like chocolate."
      },
      {
        id: "156",
        front: "クッキー\n\nクッキーを焼きました。",
        back: "Cookie\n\nI baked cookies."
      },
      {
        id: "157",
        front: "アイスクリーム\n\nアイスクリームを食べたいです。",
        back: "Ice cream\n\nI want to eat ice cream."
      },
      {
        id: "158",
        front: "ラーメン\n\nラーメンが食べたいです。",
        back: "Ramen\n\nI want to eat ramen."
      },
      {
        id: "159",
        front: "すし\n\nすしは美味しいです。",
        back: "Sushi\n\nSushi is delicious."
      },
      {
        id: "160",
        front: "天ぷら[てんぷら]\n\n天ぷらを作ります。",
        back: "Tempura\n\nI'll make tempura."
      },
      {
        id: "161",
        front: "カレー\n\nカレーが好きです。",
        back: "Curry\n\nI like curry."
      },
      {
        id: "162",
        front: "そば\n\nそばを食べました。",
        back: "Buckwheat noodles\n\nI ate soba."
      },
      {
        id: "163",
        front: "うどん\n\nうどんは美味しいです。",
        back: "Udon noodles\n\nUdon is delicious."
      },
      {
        id: "164",
        front: "レストラン\n\nレストランで食べましょう。",
        back: "Restaurant\n\nLet's eat at a restaurant."
      },
      {
        id: "165",
        front: "店[みせ]\n\nその店は有名です。",
        back: "Shop, Store\n\nThat store is famous."
      },
      {
        id: "166",
        front: "スーパー\n\nスーパーで買い物します。",
        back: "Supermarket\n\nI'll shop at the supermarket."
      },
      {
        id: "167",
        front: "メニュー\n\nメニューを見せてください。",
        back: "Menu\n\nPlease show me the menu."
      },
      {
        id: "168",
        front: "箸[はし]\n\n箸を使います。",
        back: "Chopsticks\n\nI use chopsticks."
      },
      {
        id: "169",
        front: "スプーン\n\nスプーンをください。",
        back: "Spoon\n\nPlease give me a spoon."
      },
      {
        id: "170",
        front: "フォーク\n\nフォークがありますか。",
        back: "Fork\n\nDo you have a fork?"
      }
    ]
  },
  {
    id: "n5-complete-6",
    title: "JLPT N5 - Verbs Part 1: Basic Actions",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "171",
        front: "行く[いく]\n\n学校へ行きます。",
        back: "To go\n\nI go to school."
      },
      {
        id: "172",
        front: "来る[くる]\n\n友達が来ます。",
        back: "To come\n\nMy friend will come."
      },
      {
        id: "173",
        front: "帰る[かえる]\n\n家に帰ります。",
        back: "To return, Go home\n\nI'll go home."
      },
      {
        id: "174",
        front: "食べる[たべる]\n\nご飯を食べます。",
        back: "To eat\n\nI eat rice."
      },
      {
        id: "175",
        front: "飲む[のむ]\n\n水を飲みます。",
        back: "To drink\n\nI drink water."
      },
      {
        id: "176",
        front: "見る[みる]\n\nテレビを見ます。",
        back: "To see, Watch\n\nI watch TV."
      },
      {
        id: "177",
        front: "聞く[きく]\n\n音楽を聞きます。",
        back: "To hear, Listen, Ask\n\nI listen to music."
      },
      {
        id: "178",
        front: "読む[よむ]\n\n本を読みます。",
        back: "To read\n\nI read books."
      },
      {
        id: "179",
        front: "書く[かく]\n\n手紙を書きます。",
        back: "To write\n\nI write letters."
      },
      {
        id: "180",
        front: "話す[はなす]\n\n日本語を話します。",
        back: "To speak, Talk\n\nI speak Japanese."
      },
      {
        id: "181",
        front: "する\n\n宿題をします。",
        back: "To do\n\nI do homework."
      },
      {
        id: "182",
        front: "買う[かう]\n\n服を買います。",
        back: "To buy\n\nI buy clothes."
      },
      {
        id: "183",
        front: "売る[うる]\n\n車を売ります。",
        back: "To sell\n\nI'll sell the car."
      },
      {
        id: "184",
        front: "ある\n\n机の上に本があります。",
        back: "To exist (inanimate)\n\nThere's a book on the desk."
      },
      {
        id: "185",
        front: "いる\n\n部屋に人がいます。",
        back: "To exist (animate)\n\nThere's a person in the room."
      },
      {
        id: "186",
        front: "分かる[わかる]\n\n日本語が分かります。",
        back: "To understand\n\nI understand Japanese."
      },
      {
        id: "187",
        front: "寝る[ねる]\n\n十時に寝ます。",
        back: "To sleep\n\nI go to bed at 10."
      },
      {
        id: "188",
        front: "起きる[おきる]\n\n朝六時に起きます。",
        back: "To wake up, Get up\n\nI wake up at 6 AM."
      },
      {
        id: "189",
        front: "勉強する[べんきょうする]\n\n毎日勉強します。",
        back: "To study\n\nI study every day."
      },
      {
        id: "190",
        front: "働く[はたらく]\n\n会社で働きます。",
        back: "To work\n\nI work at a company."
      },
      {
        id: "191",
        front: "休む[やすむ]\n\n日曜日は休みます。",
        back: "To rest, Take a break\n\nI rest on Sundays."
      },
      {
        id: "192",
        front: "待つ[まつ]\n\nここで待ちます。",
        back: "To wait\n\nI'll wait here."
      },
      {
        id: "193",
        front: "立つ[たつ]\n\nそこに立ってください。",
        back: "To stand\n\nPlease stand there."
      },
      {
        id: "194",
        front: "座る[すわる]\n\n椅子に座ります。",
        back: "To sit\n\nI'll sit on a chair."
      },
      {
        id: "195",
        front: "歩く[あるく]\n\n公園を歩きます。",
        back: "To walk\n\nI walk in the park."
      },
      {
        id: "196",
        front: "走る[はしる]\n\n毎朝走ります。",
        back: "To run\n\nI run every morning."
      },
      {
        id: "197",
        front: "泳ぐ[およぐ]\n\nプールで泳ぎます。",
        back: "To swim\n\nI swim in the pool."
      },
      {
        id: "198",
        front: "遊ぶ[あそぶ]\n\n友達と遊びます。",
        back: "To play\n\nI play with friends."
      },
      {
        id: "199",
        front: "会う[あう]\n\n駅で会いましょう。",
        back: "To meet\n\nLet's meet at the station."
      },
      {
        id: "200",
        front: "教える[おしえる]\n\n英語を教えます。",
        back: "To teach\n\nI teach English."
      },
      {
        id: "201",
        front: "習う[ならう]\n\nピアノを習います。",
        back: "To learn\n\nI learn piano."
      },
      {
        id: "202",
        front: "使う[つかう]\n\nパソコンを使います。",
        back: "To use\n\nI use a computer."
      },
      {
        id: "203",
        front: "貸す[かす]\n\n本を貸します。",
        back: "To lend\n\nI'll lend you a book."
      },
      {
        id: "204",
        front: "借りる[かりる]\n\nペンを借ります。",
        back: "To borrow\n\nI'll borrow a pen."
      },
      {
        id: "205",
        front: "あげる\n\nプレゼントをあげます。",
        back: "To give\n\nI'll give a present."
      },
      {
        id: "206",
        front: "もらう\n\nお土産をもらいました。",
        back: "To receive\n\nI received a souvenir."
      },
      {
        id: "207",
        front: "持つ[もつ]\n\n荷物を持ちます。",
        back: "To hold, Have\n\nI'll hold the luggage."
      },
      {
        id: "208",
        front: "置く[おく]\n\nここに置いてください。",
        back: "To put, Place\n\nPlease put it here."
      },
      {
        id: "209",
        front: "取る[とる]\n\n写真を取ります。",
        back: "To take\n\nI'll take a photo."
      },
      {
        id: "210",
        front: "入る[はいる]\n\n部屋に入ります。",
        back: "To enter\n\nI'll enter the room."
      },
      {
        id: "211",
        front: "出る[でる]\n\n家を出ます。",
        back: "To go out, Exit\n\nI'll leave home."
      },
      {
        id: "212",
        front: "開ける[あける]\n\n窓を開けます。",
        back: "To open\n\nI'll open the window."
      },
      {
        id: "213",
        front: "閉める[しめる]\n\nドアを閉めます。",
        back: "To close\n\nI'll close the door."
      },
      {
        id: "214",
        front: "始まる[はじまる]\n\n授業が始まります。",
        back: "To begin\n\nClass will begin."
      },
      {
        id: "215",
        front: "終わる[おわる]\n\n仕事が終わりました。",
        back: "To end\n\nWork has ended."
      },
      {
        id: "216",
        front: "作る[つくる]\n\n料理を作ります。",
        back: "To make\n\nI'll make food."
      },
      {
        id: "217",
        front: "洗う[あらう]\n\n手を洗います。",
        back: "To wash\n\nI wash my hands."
      },
      {
        id: "218",
        front: "着る[きる]\n\n服を着ます。",
        back: "To wear (clothes)\n\nI wear clothes."
      },
      {
        id: "219",
        front: "脱ぐ[ぬぐ]\n\n靴を脱ぎます。",
        back: "To take off\n\nI take off my shoes."
      },
      {
        id: "220",
        front: "降る[ふる]\n\n雨が降ります。",
        back: "To fall (rain/snow)\n\nIt rains."
      }
    ]
  },
  {
    id: "n5-complete-7",
    title: "JLPT N5 - Verbs Part 2: More Actions",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "221",
        front: "切る[きる]\n\n野菜を切ります。",
        back: "To cut\n\nI'll cut vegetables."
      },
      {
        id: "222",
        front: "貼る[はる]\n\n切手を貼ります。",
        back: "To stick, Paste\n\nI'll stick a stamp."
      },
      {
        id: "223",
        front: "引く[ひく]\n\nドアを引いてください。",
        back: "To pull\n\nPlease pull the door."
      },
      {
        id: "224",
        front: "押す[おす]\n\nボタンを押します。",
        back: "To push, Press\n\nI'll press the button."
      },
      {
        id: "225",
        front: "曲がる[まがる]\n\n右に曲がります。",
        back: "To turn\n\nI'll turn right."
      },
      {
        id: "226",
        front: "渡る[わたる]\n\n道を渡ります。",
        back: "To cross\n\nI'll cross the street."
      },
      {
        id: "227",
        front: "つける\n\n電気をつけます。",
        back: "To turn on\n\nI'll turn on the light."
      },
      {
        id: "228",
        front: "消す[けす]\n\n電気を消します。",
        back: "To turn off, Erase\n\nI'll turn off the light."
      },
      {
        id: "229",
        front: "吹く[ふく]\n\n風が吹いています。",
        back: "To blow\n\nThe wind is blowing."
      },
      {
        id: "230",
        front: "鳴る[なる]\n\n電話が鳴ります。",
        back: "To ring, Sound\n\nThe phone is ringing."
      },
      {
        id: "231",
        front: "歌う[うたう]\n\n歌を歌います。",
        back: "To sing\n\nI sing songs."
      },
      {
        id: "232",
        front: "踊る[おどる]\n\n音楽に合わせて踊ります。",
        back: "To dance\n\nI dance to music."
      },
      {
        id: "233",
        front: "撮る[とる]\n\n写真を撮ります。",
        back: "To take (photo)\n\nI take photos."
      },
      {
        id: "234",
        front: "吸う[すう]\n\nたばこを吸いますか。",
        back: "To smoke, Inhale\n\nDo you smoke?"
      },
      {
        id: "235",
        front: "呼ぶ[よぶ]\n\n名前を呼びます。",
        back: "To call\n\nI call the name."
      },
      {
        id: "236",
        front: "探す[さがす]\n\n鍵を探しています。",
        back: "To search\n\nI'm searching for keys."
      },
      {
        id: "237",
        front: "忘れる[わすれる]\n\n名前を忘れました。",
        back: "To forget\n\nI forgot the name."
      },
      {
        id: "238",
        front: "覚える[おぼえる]\n\n単語を覚えます。",
        back: "To remember, Memorize\n\nI memorize words."
      },
      {
        id: "239",
        front: "知る[しる]\n\n彼を知っています。",
        back: "To know\n\nI know him."
      },
      {
        id: "240",
        front: "思う[おもう]\n\nそう思います。",
        back: "To think\n\nI think so."
      },
      {
        id: "241",
        front: "笑う[わらう]\n\nみんなが笑いました。",
        back: "To laugh\n\nEveryone laughed."
      },
      {
        id: "242",
        front: "泣く[なく]\n\n赤ちゃんが泣いています。",
        back: "To cry\n\nThe baby is crying."
      },
      {
        id: "243",
        front: "怒る[おこる]\n\n先生が怒りました。",
        back: "To get angry\n\nThe teacher got angry."
      },
      {
        id: "244",
        front: "困る[こまる]\n\nお金がなくて困ります。",
        back: "To be troubled\n\nI'm troubled because I have no money."
      },
      {
        id: "245",
        front: "喜ぶ[よろこぶ]\n\nプレゼントを喜びました。",
        back: "To be glad\n\nI was glad about the present."
      },
      {
        id: "246",
        front: "疲れる[つかれる]\n\n仕事で疲れました。",
        back: "To get tired\n\nI got tired from work."
      },
      {
        id: "247",
        front: "痛い[いたい]\n\n頭が痛いです。",
        back: "To hurt, Painful\n\nMy head hurts."
      },
      {
        id: "248",
        front: "壊れる[こわれる]\n\n時計が壊れました。",
        back: "To break (intransitive)\n\nThe watch broke."
      },
      {
        id: "249",
        front: "壊す[こわす]\n\nおもちゃを壊しました。",
        back: "To break (transitive)\n\nI broke the toy."
      },
      {
        id: "250",
        front: "落とす[おとす]\n\nお金を落としました。",
        back: "To drop\n\nI dropped money."
      },
      {
        id: "251",
        front: "拾う[ひろう]\n\n財布を拾いました。",
        back: "To pick up\n\nI picked up a wallet."
      },
      {
        id: "252",
        front: "捨てる[すてる]\n\nゴミを捨てます。",
        back: "To throw away\n\nI'll throw away trash."
      },
      {
        id: "253",
        front: "選ぶ[えらぶ]\n\n好きな色を選びます。",
        back: "To choose\n\nI choose my favorite color."
      },
      {
        id: "254",
        front: "決める[きめる]\n\n予定を決めます。",
        back: "To decide\n\nI'll decide the schedule."
      },
      {
        id: "255",
        front: "変える[かえる]\n\n計画を変えます。",
        back: "To change\n\nI'll change the plan."
      },
      {
        id: "256",
        front: "比べる[くらべる]\n\n値段を比べます。",
        back: "To compare\n\nI compare prices."
      },
      {
        id: "257",
        front: "並ぶ[ならぶ]\n\n列に並びます。",
        back: "To line up\n\nI'll line up in the queue."
      },
      {
        id: "258",
        front: "集まる[あつまる]\n\n公園に集まります。",
        back: "To gather\n\nWe'll gather at the park."
      },
      {
        id: "259",
        front: "増える[ふえる]\n\n人口が増えます。",
        back: "To increase\n\nThe population increases."
      },
      {
        id: "260",
        front: "減る[へる]\n\nお金が減りました。",
        back: "To decrease\n\nMy money decreased."
      }
    ]
  },
  {
    id: "n5-complete-8",
    title: "JLPT N5 - Adjectives & Descriptions",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "261",
        front: "大きい[おおきい]\n\n大きい家です。",
        back: "Big, Large\n\nIt's a big house."
      },
      {
        id: "262",
        front: "小さい[ちいさい]\n\n小さい犬がいます。",
        back: "Small\n\nThere's a small dog."
      },
      {
        id: "263",
        front: "新しい[あたらしい]\n\n新しい車を買いました。",
        back: "New\n\nI bought a new car."
      },
      {
        id: "264",
        front: "古い[ふるい]\n\n古い本を読みます。",
        back: "Old\n\nI read old books."
      },
      {
        id: "265",
        front: "良い[いい/よい]\n\nいい天気ですね。",
        back: "Good\n\nIt's good weather, isn't it?"
      },
      {
        id: "266",
        front: "悪い[わるい]\n\n悪い人ではありません。",
        back: "Bad\n\nHe's not a bad person."
      },
      {
        id: "267",
        front: "高い[たかい]\n\nこの時計は高いです。",
        back: "Expensive, Tall, High\n\nThis watch is expensive."
      },
      {
        id: "268",
        front: "安い[やすい]\n\n安いレストランです。",
        back: "Cheap, Inexpensive\n\nIt's a cheap restaurant."
      },
      {
        id: "269",
        front: "低い[ひくい]\n\n机が低いです。",
        back: "Low, Short\n\nThe desk is low."
      },
      {
        id: "270",
        front: "長い[ながい]\n\n長い髪の女性です。",
        back: "Long\n\nShe's a woman with long hair."
      },
      {
        id: "271",
        front: "短い[みじかい]\n\n短いスカートです。",
        back: "Short\n\nIt's a short skirt."
      },
      {
        id: "272",
        front: "広い[ひろい]\n\n広い部屋です。",
        back: "Wide, Spacious\n\nIt's a spacious room."
      },
      {
        id: "273",
        front: "狭い[せまい]\n\n狭い道です。",
        back: "Narrow, Cramped\n\nIt's a narrow road."
      },
      {
        id: "274",
        front: "厚い[あつい]\n\n厚い本を読みます。",
        back: "Thick\n\nI read thick books."
      },
      {
        id: "275",
        front: "薄い[うすい]\n\n薄いシャツです。",
        back: "Thin\n\nIt's a thin shirt."
      },
      {
        id: "276",
        front: "重い[おもい]\n\n重い荷物です。",
        back: "Heavy\n\nIt's heavy luggage."
      },
      {
        id: "277",
        front: "軽い[かるい]\n\n軽いカバンです。",
        back: "Light (weight)\n\nIt's a light bag."
      },
      {
        id: "278",
        front: "強い[つよい]\n\n強い人です。",
        back: "Strong\n\nHe's a strong person."
      },
      {
        id: "279",
        front: "弱い[よわい]\n\n体が弱いです。",
        back: "Weak\n\nMy body is weak."
      },
      {
        id: "280",
        front: "暑い[あつい]\n\n今日は暑いです。",
        back: "Hot (weather)\n\nIt's hot today."
      },
      {
        id: "281",
        front: "寒い[さむい]\n\n冬は寒いです。",
        back: "Cold (weather)\n\nWinter is cold."
      },
      {
        id: "282",
        front: "暖かい[あたたかい]\n\n春は暖かいです。",
        back: "Warm\n\nSpring is warm."
      },
      {
        id: "283",
        front: "涼しい[すずしい]\n\n秋は涼しいです。",
        back: "Cool\n\nAutumn is cool."
      },
      {
        id: "284",
        front: "熱い[あつい]\n\nお茶が熱いです。",
        back: "Hot (to touch)\n\nThe tea is hot."
      },
      {
        id: "285",
        front: "冷たい[つめたい]\n\n水が冷たいです。",
        back: "Cold (to touch)\n\nThe water is cold."
      },
      {
        id: "286",
        front: "明るい[あかるい]\n\n明るい部屋です。",
        back: "Bright\n\nIt's a bright room."
      },
      {
        id: "287",
        front: "暗い[くらい]\n\n夜は暗いです。",
        back: "Dark\n\nNight is dark."
      },
      {
        id: "288",
        front: "速い[はやい]\n\n速い車です。",
        back: "Fast, Quick\n\nIt's a fast car."
      },
      {
        id: "289",
        front: "遅い[おそい]\n\n電車が遅いです。",
        back: "Slow, Late\n\nThe train is slow."
      },
      {
        id: "290",
        front: "早い[はやい]\n\n朝早く起きます。",
        back: "Early\n\nI wake up early in the morning."
      },
      {
        id: "291",
        front: "近い[ちかい]\n\n駅が近いです。",
        back: "Near, Close\n\nThe station is near."
      },
      {
        id: "292",
        front: "遠い[とおい]\n\n学校が遠いです。",
        back: "Far\n\nSchool is far."
      },
      {
        id: "293",
        front: "多い[おおい]\n\n人が多いです。",
        back: "Many, Much\n\nThere are many people."
      },
      {
        id: "294",
        front: "少ない[すくない]\n\n時間が少ないです。",
        back: "Few, Little\n\nThere's little time."
      },
      {
        id: "295",
        front: "難しい[むずかしい]\n\n日本語は難しいです。",
        back: "Difficult\n\nJapanese is difficult."
      },
      {
        id: "296",
        front: "易しい[やさしい]\n\nこの問題は易しいです。",
        back: "Easy\n\nThis problem is easy."
      },
      {
        id: "297",
        front: "優しい[やさしい]\n\n優しい人です。",
        back: "Kind, Gentle\n\nHe's a kind person."
      },
      {
        id: "298",
        front: "厳しい[きびしい]\n\n先生は厳しいです。",
        back: "Strict, Severe\n\nThe teacher is strict."
      },
      {
        id: "299",
        front: "美しい[うつくしい]\n\n美しい花です。",
        back: "Beautiful\n\nIt's a beautiful flower."
      },
      {
        id: "300",
        front: "汚い[きたない]\n\n部屋が汚いです。",
        back: "Dirty\n\nThe room is dirty."
      },
      {
        id: "301",
        front: "綺麗[きれい]\n\n綺麗な景色です。",
        back: "Beautiful, Clean\n\nIt's beautiful scenery."
      },
      {
        id: "302",
        front: "静か[しずか]\n\n静かな場所です。",
        back: "Quiet\n\nIt's a quiet place."
      },
      {
        id: "303",
        front: "賑やか[にぎやか]\n\n賑やかな街です。",
        back: "Lively, Bustling\n\nIt's a lively town."
      },
      {
        id: "304",
        front: "便利[べんり]\n\n便利な場所です。",
        back: "Convenient\n\nIt's a convenient location."
      },
      {
        id: "305",
        front: "不便[ふべん]\n\n不便な場所です。",
        back: "Inconvenient\n\nIt's an inconvenient location."
      },
      {
        id: "306",
        front: "簡単[かんたん]\n\n簡単な仕事です。",
        back: "Simple, Easy\n\nIt's simple work."
      },
      {
        id: "307",
        front: "複雑[ふくざつ]\n\n複雑な問題です。",
        back: "Complex\n\nIt's a complex problem."
      },
      {
        id: "308",
        front: "元気[げんき]\n\n元気な子供です。",
        back: "Healthy, Energetic\n\nHe's an energetic child."
      },
      {
        id: "309",
        front: "有名[ゆうめい]\n\n有名な歌手です。",
        back: "Famous\n\nHe's a famous singer."
      },
      {
        id: "310",
        front: "親切[しんせつ]\n\n親切な人です。",
        back: "Kind\n\nHe's a kind person."
      },
      {
        id: "311",
        front: "好き[すき]\n\n音楽が好きです。",
        back: "Like, Love\n\nI like music."
      },
      {
        id: "312",
        front: "嫌い[きらい]\n\n野菜が嫌いです。",
        back: "Dislike, Hate\n\nI dislike vegetables."
      },
      {
        id: "313",
        front: "上手[じょうず]\n\n料理が上手です。",
        back: "Skillful, Good at\n\nHe's good at cooking."
      },
      {
        id: "314",
        front: "下手[へた]\n\n運転が下手です。",
        back: "Unskillful, Bad at\n\nI'm bad at driving."
      },
      {
        id: "315",
        front: "同じ[おなじ]\n\n同じ学校です。",
        back: "Same\n\nIt's the same school."
      },
      {
        id: "316",
        front: "違う[ちがう]\n\n意見が違います。",
        back: "Different\n\nThe opinion is different."
      },
      {
        id: "317",
        front: "大切[たいせつ]\n\n大切な友達です。",
        back: "Important, Precious\n\nHe's an important friend."
      },
      {
        id: "318",
        front: "大丈夫[だいじょうぶ]\n\n大丈夫ですか。",
        back: "Okay, All right\n\nAre you okay?"
      },
      {
        id: "319",
        front: "特別[とくべつ]\n\n特別な日です。",
        back: "Special\n\nIt's a special day."
      },
      {
        id: "320",
        front: "暇[ひま]\n\n今日は暇です。",
        back: "Free time, Not busy\n\nI'm free today."
      }
    ]
  },
  {
    id: "n5-complete-9",
    title: "JLPT N5 - Places & Locations",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "321",
        front: "所[ところ]\n\nいい所ですね。",
        back: "Place\n\nIt's a nice place, isn't it?"
      },
      {
        id: "322",
        front: "家[いえ/うち]\n\n家に帰ります。",
        back: "House, Home\n\nI'll go home."
      },
      {
        id: "323",
        front: "部屋[へや]\n\n部屋を掃除します。",
        back: "Room\n\nI'll clean the room."
      },
      {
        id: "324",
        front: "学校[がっこう]\n\n学校へ行きます。",
        back: "School\n\nI go to school."
      },
      {
        id: "325",
        front: "大学[だいがく]\n\n大学で勉強します。",
        back: "University\n\nI study at university."
      },
      {
        id: "326",
        front: "図書館[としょかん]\n\n図書館で本を読みます。",
        back: "Library\n\nI read books at the library."
      },
      {
        id: "327",
        front: "駅[えき]\n\n駅で待っています。",
        back: "Station\n\nI'm waiting at the station."
      },
      {
        id: "328",
        front: "空港[くうこう]\n\n空港へ行きます。",
        back: "Airport\n\nI'll go to the airport."
      },
      {
        id: "329",
        front: "レストラン\n\nレストランで食べます。",
        back: "Restaurant\n\nI'll eat at a restaurant."
      },
      {
        id: "330",
        front: "喫茶店[きっさてん]\n\n喫茶店でコーヒーを飲みます。",
        back: "Coffee shop\n\nI drink coffee at a coffee shop."
      },
      {
        id: "331",
        front: "店[みせ]\n\nその店は有名です。",
        back: "Shop, Store\n\nThat shop is famous."
      },
      {
        id: "332",
        front: "スーパー\n\nスーパーで買い物します。",
        back: "Supermarket\n\nI shop at the supermarket."
      },
      {
        id: "333",
        front: "デパート\n\nデパートへ行きます。",
        back: "Department store\n\nI'll go to the department store."
      },
      {
        id: "334",
        front: "コンビニ\n\nコンビニで買いました。",
        back: "Convenience store\n\nI bought it at a convenience store."
      },
      {
        id: "335",
        front: "銀行[ぎんこう]\n\n銀行でお金を下ろします。",
        back: "Bank\n\nI withdraw money at the bank."
      },
      {
        id: "336",
        front: "郵便局[ゆうびんきょく]\n\n郵便局で手紙を出します。",
        back: "Post office\n\nI mail letters at the post office."
      },
      {
        id: "337",
        front: "病院[びょういん]\n\n病院へ行きます。",
        back: "Hospital\n\nI'll go to the hospital."
      },
      {
        id: "338",
        front: "薬局[やっきょく]\n\n薬局で薬を買います。",
        back: "Pharmacy\n\nI buy medicine at the pharmacy."
      },
      {
        id: "339",
        front: "ホテル\n\nホテルに泊まります。",
        back: "Hotel\n\nI'll stay at a hotel."
      },
      {
        id: "340",
        front: "会社[かいしゃ]\n\n会社で働きます。",
        back: "Company\n\nI work at a company."
      },
      {
        id: "341",
        front: "事務所[じむしょ]\n\n事務所にいます。",
        back: "Office\n\nI'm at the office."
      },
      {
        id: "342",
        front: "工場[こうじょう]\n\n工場で働いています。",
        back: "Factory\n\nI work at a factory."
      },
      {
        id: "343",
        front: "公園[こうえん]\n\n公園で遊びます。",
        back: "Park\n\nI play in the park."
      },
      {
        id: "344",
        front: "動物園[どうぶつえん]\n\n動物園へ行きました。",
        back: "Zoo\n\nI went to the zoo."
      },
      {
        id: "345",
        front: "映画館[えいがかん]\n\n映画館で映画を見ます。",
        back: "Movie theater\n\nI watch movies at the cinema."
      },
      {
        id: "346",
        front: "美術館[びじゅつかん]\n\n美術館を見学します。",
        back: "Art museum\n\nI visit the art museum."
      },
      {
        id: "347",
        front: "博物館[はくぶつかん]\n\n博物館へ行きます。",
        back: "Museum\n\nI'll go to the museum."
      },
      {
        id: "348",
        front: "寺[てら]\n\nお寺を見ます。",
        back: "Temple\n\nI'll see the temple."
      },
      {
        id: "349",
        front: "神社[じんじゃ]\n\n神社にお参りします。",
        back: "Shrine\n\nI'll visit the shrine."
      },
      {
        id: "350",
        front: "教会[きょうかい]\n\n日曜日に教会へ行きます。",
        back: "Church\n\nI go to church on Sunday."
      },
      {
        id: "351",
        front: "町[まち]\n\nこの町が好きです。",
        back: "Town, City\n\nI like this town."
      },
      {
        id: "352",
        front: "市[し]\n\n東京市に住んでいます。",
        back: "City\n\nI live in Tokyo city."
      },
      {
        id: "353",
        front: "村[むら]\n\n小さい村です。",
        back: "Village\n\nIt's a small village."
      },
      {
        id: "354",
        front: "国[くに]\n\nどこの国から来ましたか。",
        back: "Country\n\nWhich country are you from?"
      },
      {
        id: "355",
        front: "外国[がいこく]\n\n外国へ行きたいです。",
        back: "Foreign country\n\nI want to go abroad."
      },
      {
        id: "356",
        front: "道[みち]\n\nこの道をまっすぐ行きます。",
        back: "Road, Way\n\nGo straight on this road."
      },
      {
        id: "357",
        front: "橋[はし]\n\n橋を渡ります。",
        back: "Bridge\n\nI'll cross the bridge."
      },
      {
        id: "358",
        front: "交差点[こうさてん]\n\n交差点を右に曲がります。",
        back: "Intersection\n\nTurn right at the intersection."
      },
      {
        id: "359",
        front: "角[かど]\n\n角を左に曲がります。",
        back: "Corner\n\nTurn left at the corner."
      },
      {
        id: "360",
        front: "上[うえ]\n\n机の上に本があります。",
        back: "Above, On top\n\nThere's a book on the desk."
      },
      {
        id: "361",
        front: "下[した]\n\n椅子の下に猫がいます。",
        back: "Below, Under\n\nThere's a cat under the chair."
      },
      {
        id: "362",
        front: "中[なか]\n\n箱の中に何がありますか。",
        back: "Inside, In\n\nWhat's inside the box?"
      },
      {
        id: "363",
        front: "外[そと]\n\n外は寒いです。",
        back: "Outside\n\nIt's cold outside."
      },
      {
        id: "364",
        front: "前[まえ]\n\n駅の前で会いましょう。",
        back: "Front, Before\n\nLet's meet in front of the station."
      },
      {
        id: "365",
        front: "後ろ[うしろ]\n\n学校の後ろに公園があります。",
        back: "Behind, Back\n\nThere's a park behind the school."
      },
      {
        id: "366",
        front: "隣[となり]\n\n隣の部屋です。",
        back: "Next to\n\nIt's the room next door."
      },
      {
        id: "367",
        front: "間[あいだ]\n\n二つの間に座ります。",
        back: "Between\n\nI sit between the two."
      },
      {
        id: "368",
        front: "そば\n\n駅のそばに住んでいます。",
        back: "Near, Beside\n\nI live near the station."
      },
      {
        id: "369",
        front: "向こう[むこう]\n\n向こうに見えます。",
        back: "Over there, Opposite\n\nI can see it over there."
      },
      {
        id: "370",
        front: "こちら\n\nこちらへどうぞ。",
        back: "This way, Here\n\nThis way, please."
      }
    ]
  },
  {
    id: "n5-complete-10",
    title: "JLPT N5 - Objects & Things",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "371",
        front: "物[もの]\n\nいい物を買いました。",
        back: "Thing, Object\n\nI bought a good thing."
      },
      {
        id: "372",
        front: "本[ほん]\n\n本を読みます。",
        back: "Book\n\nI read books."
      },
      {
        id: "373",
        front: "雑誌[ざっし]\n\n雑誌を買います。",
        back: "Magazine\n\nI'll buy a magazine."
      },
      {
        id: "374",
        front: "新聞[しんぶん]\n\n新聞を読みます。",
        back: "Newspaper\n\nI read the newspaper."
      },
      {
        id: "375",
        front: "辞書[じしょ]\n\n辞書で調べます。",
        back: "Dictionary\n\nI look it up in a dictionary."
      },
      {
        id: "376",
        front: "ノート\n\nノートに書きます。",
        back: "Notebook\n\nI write in a notebook."
      },
      {
        id: "377",
        front: "鉛筆[えんぴつ]\n\n鉛筆で書きます。",
        back: "Pencil\n\nI write with a pencil."
      },
      {
        id: "378",
        front: "ペン\n\nペンを貸してください。",
        back: "Pen\n\nPlease lend me a pen."
      },
      {
        id: "379",
        front: "紙[かみ]\n\n紙をください。",
        back: "Paper\n\nPlease give me paper."
      },
      {
        id: "380",
        front: "消しゴム[けしゴム]\n\n消しゴムを使います。",
        back: "Eraser\n\nI'll use an eraser."
      },
      {
        id: "381",
        front: "鞄[かばん]\n\n新しい鞄を買いました。",
        back: "Bag\n\nI bought a new bag."
      },
      {
        id: "382",
        front: "財布[さいふ]\n\n財布を忘れました。",
        back: "Wallet\n\nI forgot my wallet."
      },
      {
        id: "383",
        front: "時計[とけい]\n\n時計を見ます。",
        back: "Clock, Watch\n\nI look at my watch."
      },
      {
        id: "384",
        front: "眼鏡[めがね]\n\n眼鏡をかけます。",
        back: "Glasses\n\nI wear glasses."
      },
      {
        id: "385",
        front: "傘[かさ]\n\n傘を持っていきます。",
        back: "Umbrella\n\nI'll take an umbrella."
      },
      {
        id: "386",
        front: "鍵[かぎ]\n\n鍵を閉めます。",
        back: "Key\n\nI'll lock with the key."
      },
      {
        id: "387",
        front: "帽子[ぼうし]\n\n帽子をかぶります。",
        back: "Hat, Cap\n\nI wear a hat."
      },
      {
        id: "388",
        front: "服[ふく]\n\n新しい服を買います。",
        back: "Clothes\n\nI'll buy new clothes."
      },
      {
        id: "389",
        front: "シャツ\n\n白いシャツを着ます。",
        back: "Shirt\n\nI wear a white shirt."
      },
      {
        id: "390",
        front: "ズボン\n\nズボンを履きます。",
        back: "Pants, Trousers\n\nI put on pants."
      },
      {
        id: "391",
        front: "靴[くつ]\n\n靴を脱ぎます。",
        back: "Shoes\n\nI take off my shoes."
      },
      {
        id: "392",
        front: "靴下[くつした]\n\n靴下を履きます。",
        back: "Socks\n\nI put on socks."
      },
      {
        id: "393",
        front: "テレビ\n\nテレビを見ます。",
        back: "Television\n\nI watch TV."
      },
      {
        id: "394",
        front: "ラジオ\n\nラジオを聞きます。",
        back: "Radio\n\nI listen to the radio."
      },
      {
        id: "395",
        front: "電話[でんわ]\n\n電話をかけます。",
        back: "Telephone\n\nI make a phone call."
      },
      {
        id: "396",
        front: "携帯[けいたい]\n\n携帯を忘れました。",
        back: "Mobile phone\n\nI forgot my mobile phone."
      },
      {
        id: "397",
        front: "パソコン\n\nパソコンを使います。",
        back: "Personal computer\n\nI use a computer."
      },
      {
        id: "398",
        front: "カメラ\n\nカメラで撮ります。",
        back: "Camera\n\nI take with a camera."
      },
      {
        id: "399",
        front: "写真[しゃしん]\n\n写真を撮ります。",
        back: "Photograph\n\nI take photos."
      },
      {
        id: "400",
        front: "机[つくえ]\n\n机の上に本があります。",
        back: "Desk\n\nThere's a book on the desk."
      },
      {
        id: "401",
        front: "椅子[いす]\n\n椅子に座ります。",
        back: "Chair\n\nI sit on a chair."
      },
      {
        id: "402",
        front: "ベッド\n\nベッドで寝ます。",
        back: "Bed\n\nI sleep in bed."
      },
      {
        id: "403",
        front: "窓[まど]\n\n窓を開けます。",
        back: "Window\n\nI open the window."
      },
      {
        id: "404",
        front: "ドア\n\nドアを閉めます。",
        back: "Door\n\nI close the door."
      },
      {
        id: "405",
        front: "壁[かべ]\n\n壁に絵があります。",
        back: "Wall\n\nThere's a picture on the wall."
      },
      {
        id: "406",
        front: "天井[てんじょう]\n\n天井が高いです。",
        back: "Ceiling\n\nThe ceiling is high."
      },
      {
        id: "407",
        front: "床[ゆか]\n\n床を掃除します。",
        back: "Floor\n\nI clean the floor."
      },
      {
        id: "408",
        front: "電気[でんき]\n\n電気をつけます。",
        back: "Light, Electricity\n\nI turn on the light."
      },
      {
        id: "409",
        front: "エアコン\n\nエアコンをつけます。",
        back: "Air conditioner\n\nI turn on the AC."
      },
      {
        id: "410",
        front: "冷蔵庫[れいぞうこ]\n\n冷蔵庫に入れます。",
        back: "Refrigerator\n\nI put it in the refrigerator."
      },
      {
        id: "411",
        front: "車[くるま]\n\n車で行きます。",
        back: "Car\n\nI'll go by car."
      },
      {
        id: "412",
        front: "自転車[じてんしゃ]\n\n自転車に乗ります。",
        back: "Bicycle\n\nI ride a bicycle."
      },
      {
        id: "413",
        front: "バス\n\nバスで行きます。",
        back: "Bus\n\nI'll go by bus."
      },
      {
        id: "414",
        front: "電車[でんしゃ]\n\n電車に乗ります。",
        back: "Train\n\nI take the train."
      },
      {
        id: "415",
        front: "地下鉄[ちかてつ]\n\n地下鉄で行きます。",
        back: "Subway\n\nI'll go by subway."
      },
      {
        id: "416",
        front: "新幹線[しんかんせん]\n\n新幹線は速いです。",
        back: "Bullet train\n\nThe bullet train is fast."
      },
      {
        id: "417",
        front: "飛行機[ひこうき]\n\n飛行機で来ました。",
        back: "Airplane\n\nI came by airplane."
      },
      {
        id: "418",
        front: "船[ふね]\n\n船で行きます。",
        back: "Ship, Boat\n\nI'll go by boat."
      },
      {
        id: "419",
        front: "タクシー\n\nタクシーで帰ります。",
        back: "Taxi\n\nI'll go home by taxi."
      },
      {
        id: "420",
        front: "切符[きっぷ]\n\n切符を買います。",
        back: "Ticket\n\nI'll buy a ticket."
      },
      {
        id: "421",
        front: "お金[おかね]\n\nお金がありません。",
        back: "Money\n\nI don't have money."
      },
      {
        id: "422",
        front: "円[えん]\n\n千円です。",
        back: "Yen\n\nIt's 1,000 yen."
      },
      {
        id: "423",
        front: "手紙[てがみ]\n\n手紙を書きます。",
        back: "Letter\n\nI write a letter."
      },
      {
        id: "424",
        front: "荷物[にもつ]\n\n荷物を持ちます。",
        back: "Luggage, Baggage\n\nI carry luggage."
      },
      {
        id: "425",
        front: "箱[はこ]\n\n箱に入れます。",
        back: "Box\n\nI put it in a box."
      },
      {
        id: "426",
        front: "ポケット\n\nポケットに入れます。",
        back: "Pocket\n\nI put it in my pocket."
      },
      {
        id: "427",
        front: "袋[ふくろ]\n\n袋をください。",
        back: "Bag, Sack\n\nPlease give me a bag."
      },
      {
        id: "428",
        front: "ゴミ\n\nゴミを捨てます。",
        back: "Garbage, Trash\n\nI throw away trash."
      },
      {
        id: "429",
        front: "プレゼント\n\nプレゼントをあげます。",
        back: "Present, Gift\n\nI'll give a present."
      },
      {
        id: "430",
        front: "お土産[おみやげ]\n\nお土産を買います。",
        back: "Souvenir\n\nI'll buy souvenirs."
      }
    ]
  },
  {
    id: "n5-complete-11",
    title: "JLPT N5 - Body Parts & Health",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "431",
        front: "体[からだ]\n\n体が痛いです。",
        back: "Body\n\nMy body hurts."
      },
      {
        id: "432",
        front: "頭[あたま]\n\n頭が痛いです。",
        back: "Head\n\nMy head hurts."
      },
      {
        id: "433",
        front: "顔[かお]\n\n顔を洗います。",
        back: "Face\n\nI wash my face."
      },
      {
        id: "434",
        front: "目[め]\n\n目が悪いです。",
        back: "Eye\n\nMy eyesight is bad."
      },
      {
        id: "435",
        front: "耳[みみ]\n\n耳が痛いです。",
        back: "Ear\n\nMy ear hurts."
      },
      {
        id: "436",
        front: "鼻[はな]\n\n鼻が高いですね。",
        back: "Nose\n\nYou have a high nose."
      },
      {
        id: "437",
        front: "口[くち]\n\n口を開けてください。",
        back: "Mouth\n\nPlease open your mouth."
      },
      {
        id: "438",
        front: "歯[は]\n\n歯が痛いです。",
        back: "Tooth, Teeth\n\nMy tooth hurts."
      },
      {
        id: "439",
        front: "首[くび]\n\n首が痛いです。",
        back: "Neck\n\nMy neck hurts."
      },
      {
        id: "440",
        front: "肩[かた]\n\n肩が凝ります。",
        back: "Shoulder\n\nMy shoulders are stiff."
      },
      {
        id: "441",
        front: "腕[うで]\n\n腕が長いです。",
        back: "Arm\n\nMy arms are long."
      },
      {
        id: "442",
        front: "手[て]\n\n手を洗います。",
        back: "Hand\n\nI wash my hands."
      },
      {
        id: "443",
        front: "指[ゆび]\n\n指を切りました。",
        back: "Finger\n\nI cut my finger."
      },
      {
        id: "444",
        front: "背[せ]\n\n背が高いです。",
        back: "Back, Height\n\nHe's tall."
      },
      {
        id: "445",
        front: "お腹[おなか]\n\nお腹が空きました。",
        back: "Stomach, Belly\n\nI'm hungry."
      },
      {
        id: "446",
        front: "足[あし]\n\n足が痛いです。",
        back: "Leg, Foot\n\nMy leg/foot hurts."
      },
      {
        id: "447",
        front: "髪[かみ]\n\n髪を切りました。",
        back: "Hair\n\nI cut my hair."
      },
      {
        id: "448",
        front: "声[こえ]\n\n声が大きいです。",
        back: "Voice\n\nYour voice is loud."
      },
      {
        id: "449",
        front: "血[ち]\n\n血が出ています。",
        back: "Blood\n\nIt's bleeding."
      },
      {
        id: "450",
        front: "病気[びょうき]\n\n病気になりました。",
        back: "Illness, Disease\n\nI got sick."
      },
      {
        id: "451",
        front: "風邪[かぜ]\n\n風邪を引きました。",
        back: "Cold (illness)\n\nI caught a cold."
      },
      {
        id: "452",
        front: "熱[ねつ]\n\n熱があります。",
        back: "Fever\n\nI have a fever."
      },
      {
        id: "453",
        front: "咳[せき]\n\n咳が出ます。",
        back: "Cough\n\nI'm coughing."
      },
      {
        id: "454",
        front: "薬[くすり]\n\n薬を飲みます。",
        back: "Medicine\n\nI take medicine."
      },
      {
        id: "455",
        front: "医者[いしゃ]\n\n医者に行きます。",
        back: "Doctor\n\nI'll go to the doctor."
      },
      {
        id: "456",
        front: "看護師[かんごし]\n\n看護師さんが来ました。",
        back: "Nurse\n\nThe nurse came."
      },
      {
        id: "457",
        front: "怪我[けが]\n\n怪我をしました。",
        back: "Injury\n\nI got injured."
      },
      {
        id: "458",
        front: "注射[ちゅうしゃ]\n\n注射が嫌いです。",
        back: "Injection\n\nI don't like injections."
      },
      {
        id: "459",
        front: "健康[けんこう]\n\n健康が大切です。",
        back: "Health\n\nHealth is important."
      },
      {
        id: "460",
        front: "元気[げんき]\n\n元気ですか。",
        back: "Healthy, Energetic\n\nAre you well?"
      },
      {
        id: "461",
        front: "危ない[あぶない]\n\n危ないですよ。",
        back: "Dangerous\n\nThat's dangerous!"
      },
      {
        id: "462",
        front: "安全[あんぜん]\n\n安全な場所です。",
        back: "Safe, Safety\n\nIt's a safe place."
      },
      {
        id: "463",
        front: "大丈夫[だいじょうぶ]\n\n大丈夫ですか。",
        back: "Okay, All right\n\nAre you okay?"
      },
      {
        id: "464",
        front: "痛い[いたい]\n\n痛いです。",
        back: "Painful, Hurt\n\nIt hurts."
      },
      {
        id: "465",
        front: "苦しい[くるしい]\n\n苦しいです。",
        back: "Suffering, Painful\n\nI'm in pain."
      }
    ]
  },
  {
    id: "n5-complete-12",
    title: "JLPT N5 - Nature & Weather",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "466",
        front: "天気[てんき]\n\n天気がいいですね。",
        back: "Weather\n\nThe weather is nice, isn't it?"
      },
      {
        id: "467",
        front: "晴れ[はれ]\n\n今日は晴れです。",
        back: "Clear weather, Sunny\n\nIt's sunny today."
      },
      {
        id: "468",
        front: "曇り[くもり]\n\n曇りの日です。",
        back: "Cloudy\n\nIt's a cloudy day."
      },
      {
        id: "469",
        front: "雨[あめ]\n\n雨が降ります。",
        back: "Rain\n\nIt rains."
      },
      {
        id: "470",
        front: "雪[ゆき]\n\n雪が降っています。",
        back: "Snow\n\nIt's snowing."
      },
      {
        id: "471",
        front: "風[かぜ]\n\n風が強いです。",
        back: "Wind\n\nThe wind is strong."
      },
      {
        id: "472",
        front: "台風[たいふう]\n\n台風が来ます。",
        back: "Typhoon\n\nA typhoon is coming."
      },
      {
        id: "473",
        front: "雲[くも]\n\n雲が多いです。",
        back: "Cloud\n\nThere are many clouds."
      },
      {
        id: "474",
        front: "空[そら]\n\n空が青いです。",
        back: "Sky\n\nThe sky is blue."
      },
      {
        id: "475",
        front: "太陽[たいよう]\n\n太陽が出ています。",
        back: "Sun\n\nThe sun is out."
      },
      {
        id: "476",
        front: "月[つき]\n\n月が綺麗です。",
        back: "Moon\n\nThe moon is beautiful."
      },
      {
        id: "477",
        front: "星[ほし]\n\n星が見えます。",
        back: "Star\n\nI can see stars."
      },
      {
        id: "478",
        front: "春[はる]\n\n春が来ました。",
        back: "Spring\n\nSpring has come."
      },
      {
        id: "479",
        front: "夏[なつ]\n\n夏は暑いです。",
        back: "Summer\n\nSummer is hot."
      },
      {
        id: "480",
        front: "秋[あき]\n\n秋は涼しいです。",
        back: "Autumn, Fall\n\nAutumn is cool."
      },
      {
        id: "481",
        front: "冬[ふゆ]\n\n冬は寒いです。",
        back: "Winter\n\nWinter is cold."
      },
      {
        id: "482",
        front: "季節[きせつ]\n\n何の季節が好きですか。",
        back: "Season\n\nWhich season do you like?"
      },
      {
        id: "483",
        front: "山[やま]\n\n山に登ります。",
        back: "Mountain\n\nI'll climb a mountain."
      },
      {
        id: "484",
        front: "川[かわ]\n\n川で泳ぎます。",
        back: "River\n\nI swim in the river."
      },
      {
        id: "485",
        front: "海[うみ]\n\n海へ行きます。",
        back: "Sea, Ocean\n\nI'll go to the sea."
      },
      {
        id: "486",
        front: "池[いけ]\n\n池に魚がいます。",
        back: "Pond\n\nThere are fish in the pond."
      },
      {
        id: "487",
        front: "湖[みずうみ]\n\n湖は綺麗です。",
        back: "Lake\n\nThe lake is beautiful."
      },
      {
        id: "488",
        front: "島[しま]\n\n小さい島です。",
        back: "Island\n\nIt's a small island."
      },
      {
        id: "489",
        front: "森[もり]\n\n森を歩きます。",
        back: "Forest\n\nI walk in the forest."
      },
      {
        id: "490",
        front: "林[はやし]\n\n林の中に入ります。",
        back: "Woods, Grove\n\nI enter the woods."
      },
      {
        id: "491",
        front: "木[き]\n\n大きい木です。",
        back: "Tree\n\nIt's a big tree."
      },
      {
        id: "492",
        front: "花[はな]\n\n花を買います。",
        back: "Flower\n\nI'll buy flowers."
      },
      {
        id: "493",
        front: "草[くさ]\n\n草を切ります。",
        back: "Grass\n\nI'll cut the grass."
      },
      {
        id: "494",
        front: "葉[は]\n\n葉が落ちます。",
        back: "Leaf\n\nLeaves fall."
      },
      {
        id: "495",
        front: "土[つち]\n\n土を掘ります。",
        back: "Soil, Earth\n\nI dig the soil."
      },
      {
        id: "496",
        front: "石[いし]\n\n石を拾いました。",
        back: "Stone, Rock\n\nI picked up a stone."
      },
      {
        id: "497",
        front: "砂[すな]\n\n砂浜を歩きます。",
        back: "Sand\n\nI walk on the sandy beach."
      },
      {
        id: "498",
        front: "動物[どうぶつ]\n\n動物が好きです。",
        back: "Animal\n\nI like animals."
      },
      {
        id: "499",
        front: "犬[いぬ]\n\n犬を飼っています。",
        back: "Dog\n\nI have a dog."
      },
      {
        id: "500",
        front: "猫[ねこ]\n\n猫が可愛いです。",
        back: "Cat\n\nCats are cute."
      },
      {
        id: "501",
        front: "鳥[とり]\n\n鳥が飛んでいます。",
        back: "Bird\n\nBirds are flying."
      },
      {
        id: "502",
        front: "馬[うま]\n\n馬に乗りました。",
        back: "Horse\n\nI rode a horse."
      },
      {
        id: "503",
        front: "牛[うし]\n\n牛がいます。",
        back: "Cow\n\nThere are cows."
      },
      {
        id: "504",
        front: "豚[ぶた]\n\n豚を見ました。",
        back: "Pig\n\nI saw pigs."
      },
      {
        id: "505",
        front: "虫[むし]\n\n虫が怖いです。",
        back: "Insect, Bug\n\nI'm scared of bugs."
      }
    ]
  },
  {
    id: "n5-complete-13",
    title: "JLPT N5 - Colors & Shapes",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "506",
        front: "色[いろ]\n\n何色が好きですか。",
        back: "Color\n\nWhat color do you like?"
      },
      {
        id: "507",
        front: "赤[あか]\n\n赤い花です。",
        back: "Red\n\nIt's a red flower."
      },
      {
        id: "508",
        front: "青[あお]\n\n青い空です。",
        back: "Blue\n\nIt's a blue sky."
      },
      {
        id: "509",
        front: "黄色[きいろ]\n\n黄色いバナナです。",
        back: "Yellow\n\nIt's a yellow banana."
      },
      {
        id: "510",
        front: "緑[みどり]\n\n緑の葉です。",
        back: "Green\n\nIt's a green leaf."
      },
      {
        id: "511",
        front: "白[しろ]\n\n白い雪です。",
        back: "White\n\nIt's white snow."
      },
      {
        id: "512",
        front: "黒[くろ]\n\n黒い猫です。",
        back: "Black\n\nIt's a black cat."
      },
      {
        id: "513",
        front: "茶色[ちゃいろ]\n\n茶色い靴です。",
        back: "Brown\n\nThey're brown shoes."
      },
      {
        id: "514",
        front: "ピンク\n\nピンクの服です。",
        back: "Pink\n\nIt's pink clothes."
      },
      {
        id: "515",
        front: "オレンジ\n\nオレンジ色です。",
        back: "Orange\n\nIt's orange colored."
      },
      {
        id: "516",
        front: "グレー\n\nグレーのシャツです。",
        back: "Gray\n\nIt's a gray shirt."
      },
      {
        id: "517",
        front: "紫[むらさき]\n\n紫の花です。",
        back: "Purple\n\nIt's a purple flower."
      },
      {
        id: "518",
        front: "明るい[あかるい]\n\n明るい色です。",
        back: "Bright\n\nIt's a bright color."
      },
      {
        id: "519",
        front: "暗い[くらい]\n\n暗い色です。",
        back: "Dark\n\nIt's a dark color."
      },
      {
        id: "520",
        front: "濃い[こい]\n\n濃い青です。",
        back: "Dark, Deep (color)\n\nIt's dark blue."
      },
      {
        id: "521",
        front: "薄い[うすい]\n\n薄い色です。",
        back: "Light, Pale\n\nIt's a light color."
      },
      {
        id: "522",
        front: "派手[はで]\n\n派手な服です。",
        back: "Flashy, Showy\n\nThey're flashy clothes."
      },
      {
        id: "523",
        front: "地味[じみ]\n\n地味な色です。",
        back: "Plain, Sober\n\nIt's a plain color."
      },
      {
        id: "524",
        front: "まっすぐ\n\nまっすぐ行きます。",
        back: "Straight\n\nI'll go straight."
      },
      {
        id: "525",
        front: "丸い[まるい]\n\n丸いテーブルです。",
        back: "Round\n\nIt's a round table."
      },
      {
        id: "526",
        front: "四角[しかく]\n\n四角い箱です。",
        back: "Square\n\nIt's a square box."
      },
      {
        id: "527",
        front: "三角[さんかく]\n\n三角の形です。",
        back: "Triangle\n\nIt's a triangular shape."
      },
      {
        id: "528",
        front: "平ら[たいら]\n\n平らな道です。",
        back: "Flat\n\nIt's a flat road."
      },
      {
        id: "529",
        front: "尖った[とがった]\n\n尖ったペンです。",
        back: "Pointed, Sharp\n\nIt's a pointed pen."
      },
      {
        id: "530",
        front: "丸[まる]\n\n丸を描きます。",
        back: "Circle\n\nI draw a circle."
      }
    ]
  },
  {
    id: "n5-complete-14",
    title: "JLPT N5 - Activities & Hobbies",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "531",
        front: "趣味[しゅみ]\n\n趣味は何ですか。",
        back: "Hobby\n\nWhat's your hobby?"
      },
      {
        id: "532",
        front: "運動[うんどう]\n\n毎日運動します。",
        back: "Exercise, Sports\n\nI exercise every day."
      },
      {
        id: "533",
        front: "スポーツ\n\nスポーツが好きです。",
        back: "Sports\n\nI like sports."
      },
      {
        id: "534",
        front: "サッカー\n\nサッカーをします。",
        back: "Soccer\n\nI play soccer."
      },
      {
        id: "535",
        front: "野球[やきゅう]\n\n野球を見ます。",
        back: "Baseball\n\nI watch baseball."
      },
      {
        id: "536",
        front: "テニス\n\nテニスをします。",
        back: "Tennis\n\nI play tennis."
      },
      {
        id: "537",
        front: "水泳[すいえい]\n\n水泳が得意です。",
        back: "Swimming\n\nI'm good at swimming."
      },
      {
        id: "538",
        front: "音楽[おんがく]\n\n音楽を聞きます。",
        back: "Music\n\nI listen to music."
      },
      {
        id: "539",
        front: "歌[うた]\n\n歌を歌います。",
        back: "Song\n\nI sing songs."
      },
      {
        id: "540",
        front: "ピアノ\n\nピアノを弾きます。",
        back: "Piano\n\nI play the piano."
      },
      {
        id: "541",
        front: "ギター\n\nギターを習います。",
        back: "Guitar\n\nI learn guitar."
      },
      {
        id: "542",
        front: "映画[えいが]\n\n映画を見ます。",
        back: "Movie\n\nI watch movies."
      },
      {
        id: "543",
        front: "ゲーム\n\nゲームをします。",
        back: "Game\n\nI play games."
      },
      {
        id: "544",
        front: "旅行[りょこう]\n\n旅行が好きです。",
        back: "Travel, Trip\n\nI like traveling."
      },
      {
        id: "545",
        front: "散歩[さんぽ]\n\n散歩をします。",
        back: "Walk, Stroll\n\nI take a walk."
      },
      {
        id: "546",
        front: "買い物[かいもの]\n\n買い物に行きます。",
        back: "Shopping\n\nI'll go shopping."
      },
      {
        id: "547",
        front: "料理[りょうり]\n\n料理が好きです。",
        back: "Cooking\n\nI like cooking."
      },
      {
        id: "548",
        front: "掃除[そうじ]\n\n部屋を掃除します。",
        back: "Cleaning\n\nI clean my room."
      },
      {
        id: "549",
        front: "洗濯[せんたく]\n\n洗濯をします。",
        back: "Laundry\n\nI do laundry."
      },
      {
        id: "550",
        front: "絵[え]\n\n絵を描きます。",
        back: "Picture, Painting\n\nI draw pictures."
      },
      {
        id: "551",
        front: "写真[しゃしん]\n\n写真を撮ります。",
        back: "Photo\n\nI take photos."
      },
      {
        id: "552",
        front: "釣り[つり]\n\n釣りに行きます。",
        back: "Fishing\n\nI'll go fishing."
      },
      {
        id: "553",
        front: "登山[とざん]\n\n登山が好きです。",
        back: "Mountain climbing\n\nI like mountain climbing."
      },
      {
        id: "554",
        front: "キャンプ\n\nキャンプに行きます。",
        back: "Camping\n\nI'll go camping."
      },
      {
        id: "555",
        front: "パーティー\n\nパーティーをします。",
        back: "Party\n\nI'll have a party."
      },
      {
        id: "556",
        front: "コンサート\n\nコンサートへ行きます。",
        back: "Concert\n\nI'll go to a concert."
      },
      {
        id: "557",
        front: "試合[しあい]\n\n試合を見ます。",
        back: "Match, Game\n\nI watch the game."
      },
      {
        id: "558",
        front: "練習[れんしゅう]\n\n毎日練習します。",
        back: "Practice\n\nI practice every day."
      },
      {
        id: "559",
        front: "宿題[しゅくだい]\n\n宿題をします。",
        back: "Homework\n\nI do homework."
      },
      {
        id: "560",
        front: "テスト\n\nテストがあります。",
        back: "Test\n\nI have a test."
      }
    ]
  },
  {
    id: "n5-complete-15",
    title: "JLPT N5 - Expressions & Particles",
    description: "Complete N5 vocabulary with example sentences",
    tags: [
      "JLPT",
      "N5"
    ],
    jlptLevel: "N5",
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    cards: [
      {
        id: "561",
        front: "〜さん\n\n田中さんです。",
        back: "Mr., Mrs., Ms.\n\nThis is Mr./Ms. Tanaka."
      },
      {
        id: "562",
        front: "〜ちゃん\n\n花ちゃんは可愛いです。",
        back: "Affectionate suffix\n\nHana-chan is cute."
      },
      {
        id: "563",
        front: "〜君[〜くん]\n\n太郎君は学生です。",
        back: "Young man suffix\n\nTaro-kun is a student."
      },
      {
        id: "564",
        front: "はい\n\nはい、そうです。",
        back: "Yes\n\nYes, that's right."
      },
      {
        id: "565",
        front: "いいえ\n\nいいえ、違います。",
        back: "No\n\nNo, that's wrong."
      },
      {
        id: "566",
        front: "これ\n\nこれは本です。",
        back: "This\n\nThis is a book."
      },
      {
        id: "567",
        front: "それ\n\nそれは何ですか。",
        back: "That\n\nWhat is that?"
      },
      {
        id: "568",
        front: "あれ\n\nあれは学校です。",
        back: "That over there\n\nThat over there is a school."
      },
      {
        id: "569",
        front: "どれ\n\nどれが好きですか。",
        back: "Which\n\nWhich do you like?"
      },
      {
        id: "570",
        front: "ここ\n\nここに来てください。",
        back: "Here\n\nPlease come here."
      },
      {
        id: "571",
        front: "そこ\n\nそこに座ります。",
        back: "There\n\nI'll sit there."
      },
      {
        id: "572",
        front: "あそこ\n\nあそこは駅です。",
        back: "Over there\n\nOver there is the station."
      },
      {
        id: "573",
        front: "どこ\n\nどこへ行きますか。",
        back: "Where\n\nWhere will you go?"
      },
      {
        id: "574",
        front: "この\n\nこの本です。",
        back: "This (before noun)\n\nIt's this book."
      },
      {
        id: "575",
        front: "その\n\nその人は誰ですか。",
        back: "That (before noun)\n\nWho is that person?"
      },
      {
        id: "576",
        front: "あの\n\nあの建物は何ですか。",
        back: "That (before noun)\n\nWhat is that building?"
      },
      {
        id: "577",
        front: "どの\n\nどの車ですか。",
        back: "Which (before noun)\n\nWhich car is it?"
      },
      {
        id: "578",
        front: "誰[だれ]\n\n誰ですか。",
        back: "Who\n\nWho is it?"
      },
      {
        id: "579",
        front: "何[なに/なん]\n\n何を食べますか。",
        back: "What\n\nWhat will you eat?"
      },
      {
        id: "580",
        front: "いつ\n\nいつ来ますか。",
        back: "When\n\nWhen will you come?"
      },
      {
        id: "581",
        front: "どう\n\nどうですか。",
        back: "How\n\nHow is it?"
      },
      {
        id: "582",
        front: "どうして\n\nどうして来ませんでしたか。",
        back: "Why\n\nWhy didn't you come?"
      },
      {
        id: "583",
        front: "どこで\n\nどこで買いましたか。",
        back: "Where (at)\n\nWhere did you buy it?"
      },
      {
        id: "584",
        front: "いくら\n\nいくらですか。",
        back: "How much\n\nHow much is it?"
      },
      {
        id: "585",
        front: "はい\n\nはい、どうぞ。",
        back: "Here you are\n\nHere you are."
      },
      {
        id: "586",
        front: "ええ\n\nええ、そうです。",
        back: "Yes (casual)\n\nYes, that's right."
      },
      {
        id: "587",
        front: "ううん\n\nううん、違います。",
        back: "No (casual)\n\nNo, that's wrong."
      },
      {
        id: "588",
        front: "そう\n\nそうですね。",
        back: "So, That's right\n\nThat's right, isn't it?"
      },
      {
        id: "589",
        front: "本当[ほんとう]\n\n本当ですか。",
        back: "Really, True\n\nReally?"
      },
      {
        id: "590",
        front: "もちろん\n\nもちろんです。",
        back: "Of course\n\nOf course."
      },
      {
        id: "591",
        front: "たぶん\n\nたぶん来ます。",
        back: "Perhaps, Maybe\n\nMaybe I'll come."
      },
      {
        id: "592",
        front: "きっと\n\nきっと大丈夫です。",
        back: "Surely, Certainly\n\nIt'll surely be okay."
      },
      {
        id: "593",
        front: "必ず[かならず]\n\n必ず来ます。",
        back: "Definitely, Without fail\n\nI'll definitely come."
      },
      {
        id: "594",
        front: "絶対[ぜったい]\n\n絶対に行きます。",
        back: "Absolutely\n\nI'll absolutely go."
      },
      {
        id: "595",
        front: "多分[たぶん]\n\n多分雨です。",
        back: "Probably\n\nIt's probably rain."
      },
      {
        id: "596",
        front: "初めて[はじめて]\n\n初めてです。",
        back: "First time\n\nIt's my first time."
      },
      {
        id: "597",
        front: "また\n\nまた来ます。",
        back: "Again\n\nI'll come again."
      },
      {
        id: "598",
        front: "まだ\n\nまだ食べていません。",
        back: "Still, Yet\n\nI haven't eaten yet."
      },
      {
        id: "599",
        front: "もう\n\nもう帰りました。",
        back: "Already\n\nI already went home."
      },
      {
        id: "600",
        front: "もっと\n\nもっとください。",
        back: "More\n\nPlease give me more."
      },
      {
        id: "601",
        front: "少し[すこし]\n\n少し待ってください。",
        back: "A little\n\nPlease wait a little."
      },
      {
        id: "602",
        front: "たくさん\n\nたくさん食べました。",
        back: "A lot, Many\n\nI ate a lot."
      },
      {
        id: "603",
        front: "全部[ぜんぶ]\n\n全部食べました。",
        back: "All, Everything\n\nI ate everything."
      },
      {
        id: "604",
        front: "半分[はんぶん]\n\n半分ください。",
        back: "Half\n\nPlease give me half."
      },
      {
        id: "605",
        front: "大体[だいたい]\n\n大体分かります。",
        back: "Mostly, Approximately\n\nI mostly understand."
      },
      {
        id: "606",
        front: "ちょうど\n\nちょうどいいです。",
        back: "Just, Exactly\n\nIt's just right."
      },
      {
        id: "607",
        front: "とても\n\nとても美味しいです。",
        back: "Very\n\nIt's very delicious."
      },
      {
        id: "608",
        front: "あまり\n\nあまり好きじゃありません。",
        back: "Not very (with negative)\n\nI don't like it very much."
      },
      {
        id: "609",
        front: "全然[ぜんぜん]\n\n全然分かりません。",
        back: "Not at all\n\nI don't understand at all."
      },
      {
        id: "610",
        front: "ずっと\n\nずっと待っていました。",
        back: "All the time, Much more\n\nI was waiting all along."
      },
      {
        id: "611",
        front: "すぐ\n\nすぐ来ます。",
        back: "Immediately, Soon\n\nI'll come soon."
      },
      {
        id: "612",
        front: "今度[こんど]\n\n今度行きます。",
        back: "Next time\n\nI'll go next time."
      },
      {
        id: "613",
        front: "一緒[いっしょ]\n\n一緒に行きましょう。",
        back: "Together\n\nLet's go together."
      },
      {
        id: "614",
        front: "別[べつ]\n\n別の日にします。",
        back: "Different, Separate\n\nLet's make it a different day."
      },
      {
        id: "615",
        front: "特に[とくに]\n\n特に好きです。",
        back: "Especially\n\nI especially like it."
      },
      {
        id: "616",
        front: "やはり/やっぱり\n\nやはり難しいです。",
        back: "As expected\n\nAs expected, it's difficult."
      },
      {
        id: "617",
        front: "本当に[ほんとうに]\n\n本当に美味しいです。",
        back: "Really, Truly\n\nIt's really delicious."
      },
      {
        id: "618",
        front: "実は[じつは]\n\n実は、学生です。",
        back: "Actually, To tell the truth\n\nActually, I'm a student."
      },
      {
        id: "619",
        front: "例えば[たとえば]\n\n例えば、これです。",
        back: "For example\n\nFor example, this."
      },
      {
        id: "620",
        front: "普通[ふつう]\n\n普通は行きません。",
        back: "Usually, Normal\n\nI don't usually go."
      },
      {
        id: "621",
        front: "時々[ときどき]\n\n時々来ます。",
        back: "Sometimes\n\nI come sometimes."
      },
      {
        id: "622",
        front: "いつも\n\nいつもありがとう。",
        back: "Always\n\nThank you always."
      },
      {
        id: "623",
        front: "最近[さいきん]\n\n最近忙しいです。",
        back: "Recently\n\nI'm busy recently."
      },
      {
        id: "624",
        front: "昔[むかし]\n\n昔、ここに住んでいました。",
        back: "Long ago, Old days\n\nI lived here long ago."
      },
      {
        id: "625",
        front: "前[まえ]\n\n三年前です。",
        back: "Before, Ago\n\nIt's three years ago."
      },
      {
        id: "626",
        front: "後[あと]\n\n後で電話します。",
        back: "After, Later\n\nI'll call later."
      },
      {
        id: "627",
        front: "最初[さいしょ]\n\n最初は難しかったです。",
        back: "First, Beginning\n\nIt was difficult at first."
      },
      {
        id: "628",
        front: "最後[さいご]\n\n最後まで頑張ります。",
        back: "Last, End\n\nI'll do my best until the end."
      },
      {
        id: "629",
        front: "次[つぎ]\n\n次の駅で降ります。",
        back: "Next\n\nI'll get off at the next station."
      },
      {
        id: "630",
        front: "以上[いじょう]\n\n二十歳以上です。",
        back: "More than, Above\n\n20 years old or older."
      },
      {
        id: "631",
        front: "以下[いか]\n\n十歳以下です。",
        back: "Less than, Below\n\n10 years old or younger."
      },
      {
        id: "632",
        front: "ぐらい/くらい\n\n一時間ぐらいです。",
        back: "About, Approximately\n\nIt's about one hour."
      },
      {
        id: "633",
        front: "しか\n\nこれしかありません。",
        back: "Only (with negative)\n\nThere's only this."
      },
      {
        id: "634",
        front: "だけ\n\nこれだけです。",
        back: "Only, Just\n\nIt's just this."
      },
      {
        id: "635",
        front: "など\n\n本など買いました。",
        back: "And so on\n\nI bought books and such."
      },
      {
        id: "636",
        front: "や\n\nりんごやバナナを買いました。",
        back: "And (non-exhaustive)\n\nI bought apples and bananas (and other things)."
      },
      {
        id: "637",
        front: "と\n\n友達と行きます。",
        back: "And, With\n\nI'll go with a friend."
      },
      {
        id: "638",
        front: "か\n\nお茶かコーヒーですか。",
        back: "Or, Question particle\n\nIs it tea or coffee?"
      },
      {
        id: "639",
        front: "が\n\n日本語は難しいが面白いです。",
        back: "But, Subject particle\n\nJapanese is difficult but interesting."
      },
      {
        id: "640",
        front: "けれど/けど\n\n高いけど買います。",
        back: "But, However\n\nIt's expensive but I'll buy it."
      },
      {
        id: "641",
        front: "から\n\n忙しいから行けません。",
        back: "Because, From\n\nI can't go because I'm busy."
      },
      {
        id: "642",
        front: "ので\n\n雨なので傘を持ちます。",
        back: "Because, Since\n\nSince it's rain, I'll take an umbrella."
      },
      {
        id: "643",
        front: "のに\n\n勉強したのに分かりません。",
        back: "Although, Despite\n\nAlthough I studied, I don't understand."
      },
      {
        id: "644",
        front: "なら\n\n暇なら来てください。",
        back: "If\n\nIf you're free, please come."
      },
      {
        id: "645",
        front: "〜たら\n\n着いたら電話します。",
        back: "If, When\n\nI'll call when I arrive."
      },
      {
        id: "646",
        front: "〜ても\n\n雨でも行きます。",
        back: "Even if\n\nI'll go even if it rains."
      },
      {
        id: "647",
        front: "〜ながら\n\n音楽を聞きながら勉強します。",
        back: "While doing\n\nI study while listening to music."
      },
      {
        id: "648",
        front: "〜たり〜たり\n\n本を読んだり映画を見たりします。",
        back: "Do things like\n\nI do things like read books and watch movies."
      },
      {
        id: "649",
        front: "〜て\n\n起きて食べます。",
        back: "And (te-form)\n\nI wake up and eat."
      },
      {
        id: "650",
        front: "〜ない\n\n行きません。",
        back: "Not (negative)\n\nI won't go."
      },
      {
        id: "651",
        front: "〜た\n\n食べました。",
        back: "Past tense\n\nI ate."
      },
      {
        id: "652",
        front: "〜ます\n\n行きます。",
        back: "Polite form\n\nI'll go."
      },
      {
        id: "653",
        front: "〜です\n\n学生です。",
        back: "Is (polite)\n\nI'm a student."
      },
      {
        id: "654",
        front: "〜でした\n\n学生でした。",
        back: "Was (polite)\n\nI was a student."
      },
      {
        id: "655",
        front: "お〜\n\nお茶",
        back: "Honorific prefix\n\nTea (polite)."
      }
    ]
  }
];

export const jlptTemplates: FlashcardSet[] = [
  ...n5Sets,
  ...n4Sets,
 ];

export default jlptTemplates;
