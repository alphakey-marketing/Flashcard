// server.js
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
Given a Japanese vocabulary word, generate ONE short, natural, everyday example sentence using that word.
The sentence must be suitable for JLPT N4–N5 level learners (8–20 characters).
Return ONLY this exact JSON object with no extra text:
{
  "japaneseSentence": "<short Japanese sentence using the word>",
  "englishTranslation": "<natural English translation of that sentence>"
}
Rules:
- Use simple, common vocabulary in the sentence
- The sentence must actually contain the given word (or its conjugated form)
- englishTranslation must be a natural English sentence, not a word-for-word translation`;

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

// ─── Production: serve Vite build ─────────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ API server running on port ${PORT}`);
});
