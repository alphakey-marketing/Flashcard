// server.js
// Load .env file first — required for OPENROUTER_API_KEY to reach this process
// when launched as a child of `concurrently` (Replit Secrets don't always propagate to child processes).
import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json());

// Rate-limit the AI generation endpoint to prevent abuse
const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // max 20 requests per minute per IP
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── OpenRouter helper ────────────────────────────────────────────────────────
async function callOpenRouter(systemPrompt, userMessage, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set.');

  const { temperature = 0.2, max_tokens = 256 } = options;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://flashmind.replit.app',
      'X-Title': 'FlashMind Sentence Generator',
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-small-3.1-24b-instruct',
      temperature,
      max_tokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{}';
  // Strip markdown code fences
  return content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

function safeParseJSON(raw, fallback) {
  try { return JSON.parse(raw); } catch {}
  const obj = raw.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch {} }
  if (fallback !== undefined) return fallback;
  throw new Error(`Failed to parse AI response. Raw: ${raw.slice(0, 200)}`);
}

// ─── API Route: POST /api/generate-sentence ───────────────────────────────────
app.post('/api/generate-sentence', generateLimiter, async (req, res) => {
  const { word } = req.body;
  if (!word?.trim()) {
    return res.status(400).json({ error: 'word is required' });
  }

  try {
    // Step 1: Jisho.org — free dictionary (no key needed)
    let reading = word;
    let meaning = '';

    try {
      const jishoRes = await fetch(
        `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`
      );
      if (jishoRes.ok) {
        const jishoData = await jishoRes.json();
        const first = jishoData?.data?.[0];
        if (first) {
          const jp = first.japanese?.[0];
          const kanjiForm = jp?.word || word;
          const kana = jp?.reading || word;
          // Display as 食べる[たべる] if kanji and kana differ, or just the kana if they're the same
          reading = kanjiForm === kana
            ? kana
            : `${kanjiForm}[${kana}]`;

          const senses = first.senses?.[0]?.english_definitions ?? [];
          meaning = senses.slice(0, 3).join(', ');
        }
      }
    } catch (jishoErr) {
      // Jisho failure is non-fatal
      console.warn('Jisho lookup failed, continuing without reading/meaning:', jishoErr.message);
    }

    // Step 2: OpenRouter — generate a simple sentence
const systemPrompt = `You are a Japanese language teacher creating beginner flashcards.
Given a Japanese vocabulary word, generate ONE short, simple example sentence using that word.
The sentence must be suitable for JLPT N5–N4 level learners (under 20 characters preferred, 25 at most).
Return ONLY this exact JSON object with no extra text:
{
  "japaneseSentence": "<Japanese sentence using the word>",
  "englishTranslation": "<natural English translation of that sentence>"
}
Rules:
- The sentence must actually contain the given word (or its conjugated/declined form)
- All words in the sentence EXCEPT the target word must be simple N5–N4 vocabulary the learner already knows (e.g. 私、今日、食べる、行く、見る、good、大きい、小さい、etc.)
- Do NOT use subordinate clauses、て-form chains、or conditional forms (no 〜たら、〜ば、〜のに、〜ながら)
- Keep the sentence short and direct — a single simple clause is ideal
- Avoid tourist-phrase or textbook-cliché sentences (e.g. do NOT write "私は学生です")
- englishTranslation must be a natural English sentence — not a word-for-word literal translation
- Do NOT include furigana or reading hints in the sentence itself`;

    const userMessage = `Vocabulary word: ${word}`;

    const raw = await callOpenRouter(systemPrompt, userMessage, {
      temperature: 0.3,
      max_tokens: 150,
    });

    const parsed = safeParseJSON(raw, {});

    if (!parsed.japaneseSentence || !parsed.englishTranslation) {
      return res.status(422).json({ error: 'AI returned incomplete data. Please try again.' });
    }

    // Build card fields in the exact format used by existing built-in sets
    const front = `${reading}\n\n${parsed.japaneseSentence}`;
    const back = `${meaning || word}\n\n${parsed.englishTranslation}`;

    return res.status(200).json({ front, back, reading, meaning });

  } catch (error) {
    console.error('generate-sentence error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── In-process cache for extract-vocab (max 200 entries, cleared hourly) ─────
const extractCache = new Map();
setInterval(() => {
  if (extractCache.size > 200) extractCache.clear();
}, 60 * 60 * 1000);

// ─── API Route: POST /api/extract-vocab ───────────────────────────────────────
app.post('/api/extract-vocab', generateLimiter, async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }

  // Cache check — skip re-calling AI for identical inputs
  const cacheKey = Buffer.from(text.trim()).toString('base64').slice(0, 64);
  if (extractCache.has(cacheKey)) {
    return res.json({ words: extractCache.get(cacheKey), cached: true });
  }

  // NOTE: callOpenRouter enforces response_format: json_object, which requires
  // the model to return a JSON *object* — not a bare array. We therefore ask
  // for { "words": [...] } and extract result.words below.
  const systemPrompt = `
You are a Japanese language teacher building vocabulary flashcard lists for learners.

Given a Japanese paragraph, extract meaningful vocabulary worth studying.

INCLUDE:
- Content words (nouns, verbs in dictionary form, い/な adjectives, adverbs) at JLPT N4–N1 level
- Compound verbs as single units (e.g. 走り回る, 落ち着く — NOT split into parts)
- Compound nouns as single units (e.g. 交通渋滞, 待ち合わせ)
- Non-obvious katakana loanwords (e.g. インフラ, アルゴリズム — skip obvious ones like テレビ, コーヒー)
- Verbs in dictionary form ONLY (e.g. 食べます → 食べる, 走っていた → 走る)

EXCLUDE:
- Pure grammatical particles (は、が、を、に、で、と、も、か、や、の…)
- Copulas and pure auxiliaries (だ、です、ます、ている、てしまう、てもらう…)
- Demonstratives (これ、それ、あれ、ここ、どこ…)
- Words a learner would see in their first 100 hours of study
- Greetings and set phrases (ありがとう、すみません…)

OUTPUT FORMAT — return ONLY this exact JSON object, no markdown, no explanation:
{
  "words": [
    {
      "word": "dictionary form",
      "reading": "hiragana reading",
      "meaning": "concise English meaning"
    }
  ]
}

Maximum 20 words. Order by first appearance in the text.
`.trim();

  try {
    const aiResponse = await callOpenRouter(systemPrompt, text.trim(), {
      temperature: 0.2,
      max_tokens: 1024,
    });

    // safeParseJSON handles markdown fences and extracts the outer { } object
    const parsed = safeParseJSON(aiResponse, {});

    const words = parsed.words;
    if (!Array.isArray(words)) throw new Error('AI response missing "words" array');

    const validated = words
      .filter(w => w && typeof w.word === 'string' && w.word.length > 0)
      .slice(0, 20);

    if (validated.length === 0) throw new Error('AI returned empty word list');

    extractCache.set(cacheKey, validated);
    res.json({ words: validated, cached: false });

  } catch (err) {
    console.error('[extract-vocab] AI failed:', err.message);
    res.status(500).json({ error: 'extraction_failed', detail: err.message });
  }
});

// ─── Production: serve Vite build ─────────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ API server running on port ${PORT}`);
});
