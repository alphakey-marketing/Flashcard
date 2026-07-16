// server.js
// Load .env file first — required for OPENROUTER_API_KEY to reach this process
// when launched as a child of `concurrently` (Replit Secrets don't always propagate to child processes).
import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import kuromoji from 'kuromoji';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// Reader passages can be a few thousand characters — default 100kb JSON limit is too tight.
app.use(express.json({ limit: '2mb' }));

// Rate-limit the AI generation endpoint to prevent abuse
const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // max 20 requests per minute per IP
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tokenization is local CPU work (no external API), so it can afford a much
// higher ceiling than the AI/Jisho-backed endpoints below.
const localLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Kuromoji tokenizer (lazy singleton — dictionary load takes ~1-2s) ────────
let tokenizerPromise = null;
function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: path.join(__dirname, 'node_modules/kuromoji/dict') })
        .build((err, tokenizer) => {
          if (err) reject(err);
          else resolve(tokenizer);
        });
    });
  }
  return tokenizerPromise;
}

function katakanaToHiragana(str) {
  return str.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// Parts of speech worth tracking vocabulary state for (nouns, verbs, adjectives,
// adverbs). Particles, auxiliaries, symbols, etc. render as plain text in the
// reader but aren't tappable/highlighted.
const CONTENT_POS = new Set(['名詞', '動詞', '形容詞', '形容動詞', '副詞']);

// ─── OpenRouter helper ────────────────────────────────────────────────────────
async function callOpenRouter(systemPrompt, userMessage, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set.');

  const { temperature = 0.2, max_tokens = 256, model = 'mistralai/mistral-small-3.1-24b-instruct' } = options;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://flashmind.replit.app',
      'X-Title': 'FlashMind Sentence Generator',
    },
    body: JSON.stringify({
      model,
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

// ─── Punctuation restoration (Haiku) ───────────────────────────────────────────
// Auto-generated YouTube captions (and occasionally scraped article text) arrive
// with little to no sentence-ending punctuation, which breaks sentence-boundary
// splitting downstream (splitSentences relies on 。！？). Run a cheap AI pass to
// restore punctuation, but only when the text actually needs it — well-punctuated
// article text from Readability skips this entirely.
function needsPunctuationRestore(text) {
  if (!text) return false;
  const marks = (text.match(/[。！？]/g) || []).length;
  // Well-punctuated Japanese prose has roughly one sentence-ending mark every
  // 20-60 characters. Below that density (including zero marks — the common
  // case for auto-captions) the cleanup pass is worth the extra call.
  return marks === 0 || text.length / marks > 100;
}

async function restorePunctuation(text) {
  if (!needsPunctuationRestore(text)) return text;
  // Long transcripts are skipped rather than partially cleaned — cleaning only
  // a prefix would leave a jarring seam between punctuated and raw text.
  if (text.length > 12000) return text;

  try {
    const raw = await callOpenRouter(
      'You restore missing punctuation and sentence boundaries in Japanese text (e.g. auto-generated video captions) without changing any words, adding content, or translating. Insert 。！？ where sentences end and add commas (、) only where clearly needed for readability. Return ONLY JSON: {"text": "..."}.',
      text,
      { temperature: 0, max_tokens: Math.min(8000, Math.ceil(text.length * 1.5)), model: 'anthropic/claude-haiku-4.5' }
    );
    const parsed = safeParseJSON(raw, { text: null });
    return typeof parsed.text === 'string' && parsed.text.trim() ? parsed.text : text;
  } catch (err) {
    console.error('⚠️ [PUNCTUATION] restore failed, using original text:', err.message);
    return text;
  }
}

// ─── Jisho.org helper — free dictionary, no key needed ────────────────────────
// Shared by /api/generate-sentence (reading/meaning prefill) and
// /api/dictionary/lookup (full Reader dictionary popup).
async function lookupJisho(word) {
  const res = await fetch(
    `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`
  );
  if (!res.ok) throw new Error(`Jisho error ${res.status}`);
  const data = await res.json();
  return data?.data ?? [];
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
      const entries = await lookupJisho(word);
      const first = entries[0];
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
    } catch (jishoErr) {
      // Jisho failure is non-fatal
      console.warn('Jisho lookup failed, continuing without reading/meaning:', jishoErr.message);
    }

    // Step 2: OpenRouter — generate a simple sentence
const systemPrompt = `You are a Japanese language teacher creating intermediate flashcards for learners targeting JLPT N2–N3.
Given a Japanese vocabulary word, generate ONE example sentence using that word.
The sentence should feel natural and authentic — like something a native speaker might actually say or write — while remaining comprehensible to an N2–N3 learner.
Return ONLY this exact JSON object with no extra text:
{
  "japaneseSentence": "<Japanese sentence using the word>",
  "englishTranslation": "<natural English translation of that sentence>"
}
Rules:
- The sentence must actually contain the given word (or a conjugated/declined form up to and including: plain past, ます-form, negative, potential, volitional, or て-form. Do NOT use causative-passive or highly literary forms)
- All words in the sentence EXCEPT the target word should be N3 or above — avoid obscure N1/N2-only vocabulary in the supporting words
- The sentence must be a single clause or a natural two-clause structure — avoid long chains of three or more clauses- Keep the sentence short and direct — a single simple clause is ideal
- The target word must be structurally essential — removing it should break the sentence's meaning 
- Write sentences that reflect real-life situations: inner thoughts, casual observations, workplace moments, or everyday decisions. Avoid tourist-phrase or textbook-cliché sentences (e.g. do NOT write "私は学生です" or "これは本です")
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

// ─── API Route: POST /api/translate ────────────────────────────────────────────
// Translates a Japanese sentence, optionally explaining one target word in context.
// Ported from LinguaReader's ai.ts (Claude Haiku) onto the existing OpenRouter plumbing.
app.post('/api/translate', generateLimiter, async (req, res) => {
  const { sentence, targetWord } = req.body;
  if (!sentence?.trim()) {
    return res.status(400).json({ error: 'sentence is required' });
  }

  const systemPrompt = targetWord?.trim()
    ? `You are a Japanese language tutor. Given a Japanese sentence and a target word within it, respond with ONLY this exact JSON object, no extra text:
{
  "translation": "<natural English translation of the full sentence>",
  "wordExplanation": "<brief explanation of what the target word means in this specific context>"
}`
    : `You are a Japanese language tutor. Given a Japanese sentence, respond with ONLY this exact JSON object, no extra text:
{
  "translation": "<natural English translation of the sentence>",
  "wordExplanation": null
}
If there is something linguistically interesting about the grammar or vocabulary, put a brief note in "wordExplanation" instead of null.`;

  const userMessage = targetWord?.trim()
    ? `Sentence: ${sentence.trim()}\nTarget word: ${targetWord.trim()}`
    : `Sentence: ${sentence.trim()}`;

  try {
    const raw = await callOpenRouter(systemPrompt, userMessage, {
      temperature: 0.2,
      max_tokens: 300,
    });

    const parsed = safeParseJSON(raw, {});
    if (!parsed.translation) {
      return res.status(422).json({ error: 'AI returned incomplete data. Please try again.' });
    }

    return res.status(200).json({
      translation: parsed.translation,
      wordExplanation: parsed.wordExplanation ?? null,
    });
  } catch (error) {
    console.error('translate error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── API Route: POST /api/tokenize ─────────────────────────────────────────────
// Reader (FR-01): segments Japanese text into morpheme tokens via kuromoji,
// carrying surface form, dictionary form, hiragana reading, and part-of-speech.
app.post('/api/tokenize', localLimiter, async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const tokenizer = await getTokenizer();
    const rawTokens = tokenizer.tokenize(text);

    const tokens = tokensFromKuromoji(rawTokens);

    res.json({ tokens });
  } catch (error) {
    console.error('tokenize error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Shared by /api/tokenize and /api/tokenize-cues — converts kuromoji's raw
// token shape into the Reader's Token shape (surface/dictionaryForm/reading/pos/isWord).
function tokensFromKuromoji(rawTokens) {
  return rawTokens.map(t => {
    const dictionaryForm = t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form;
    const readingKatakana = t.reading && t.reading !== '*' ? t.reading : t.surface_form;
    return {
      surface: t.surface_form,
      dictionaryForm,
      reading: katakanaToHiragana(readingKatakana),
      pos: t.pos,
      isWord: CONTENT_POS.has(t.pos) && dictionaryForm.trim().length > 0,
    };
  });
}

// ─── API Route: POST /api/tokenize-cues ────────────────────────────────────────
// Reader (YouTube video sync): tokenizes each caption cue independently so the
// token index range for each cue is known exactly, instead of re-splitting a
// jointly-tokenized string and guessing at offsets. Cue boundaries stay exact
// even though kuromoji sees less context per call than a single big tokenize.
app.post('/api/tokenize-cues', localLimiter, async (req, res) => {
  const { cues } = req.body;
  if (!Array.isArray(cues) || cues.length === 0) {
    return res.status(400).json({ error: 'cues (non-empty string array) is required' });
  }

  try {
    const tokenizer = await getTokenizer();
    const cueTokens = cues.map(cueText =>
      tokensFromKuromoji(tokenizer.tokenize(typeof cueText === 'string' ? cueText : ''))
    );
    res.json({ cueTokens });
  } catch (error) {
    console.error('tokenize-cues error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── API Route: POST /api/dictionary/lookup ────────────────────────────────────
// Reader (FR-04 MVP): full dictionary entry for the word popup — headword, all
// readings, all senses. Sourced from Jisho.org; swap-in point for a local
// JMdict index later without touching callers.
app.post('/api/dictionary/lookup', generateLimiter, async (req, res) => {
  const { word } = req.body;
  if (!word?.trim()) {
    return res.status(400).json({ error: 'word is required' });
  }

  try {
    const entries = await lookupJisho(word.trim());
    if (entries.length === 0) {
      return res.json({ word, found: false, headword: word, readings: [], senses: [] });
    }

    const first = entries[0];
    const readings = (first.japanese || [])
      .map(j => j.reading)
      .filter((r, i, arr) => !!r && arr.indexOf(r) === i);
    const senses = (first.senses || []).map(s => ({
      englishDefinitions: s.english_definitions || [],
      partsOfSpeech: s.parts_of_speech || [],
    }));

    res.json({
      word,
      found: true,
      headword: first.japanese?.[0]?.word || word,
      readings,
      senses,
      isCommon: !!first.is_common,
    });
  } catch (error) {
    console.error('dictionary lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── API Route: POST /api/import-url ───────────────────────────────────────────
// Reader (FR-05 completion): fetches a URL server-side, extracts the main
// article text via Readability.js (avoids nav/ads/boilerplate), and returns
// plain text ready for /api/tokenize.
const PRIVATE_HOST_RE = /^(localhost|127\.|0\.0\.0\.0|::1|169\.254\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/i;

app.post('/api/import-url', generateLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || PRIVATE_HOST_RE.test(parsed.hostname)) {
    return res.status(400).json({ error: 'URL must be a public http(s) address' });
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlashMindReader/1.0)' },
      redirect: 'follow',
    });
    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch page: HTTP ${response.status}` });
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: parsed.toString() });
    const article = new Readability(dom.window.document).parse();

    if (!article?.textContent?.trim()) {
      return res.status(422).json({ error: 'Could not extract article text from this page.' });
    }

    const text = await restorePunctuation(article.textContent.trim());

    res.json({
      title: article.title || parsed.hostname,
      text,
    });
  } catch (error) {
    console.error('import-url error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── API Route: POST /api/import-youtube ───────────────────────────────────────
// Reader: fetches a YouTube video's Japanese caption track server-side (no
// official API supports third-party caption downloads without OAuth as the
// uploader, so this reads the same caption data the player itself loads),
// stitches it into plain text, and returns it ready for /api/tokenize.
function extractYoutubeVideoId(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }

  if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;

  if (u.hostname.endsWith('youtube.com')) {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const shortsMatch = u.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch) return shortsMatch[1];
  }

  return null;
}

// Extracts a JSON object embedded in HTML as `<marker> = {...};`, scanning
// braces with string-awareness (naive regex breaks on nested objects and on
// braces that appear inside string values, both common in YouTube's payload).
function extractJsonAfter(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;
  const start = html.indexOf('{', markerIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

// Parses YouTube's timedtext XML into per-cue { text, startMs, durMs }, keeping
// each cue's timing so it can drive video seek/A-B-loop sync (not just be
// joined into a flat transcript string).
function parseYoutubeCaptionXml(xml) {
  const entries = [...xml.matchAll(/<text start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g)];
  const decode = s =>
    s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '');
  return entries
    .map(([, start, dur, text]) => ({
      text: decode(text).trim(),
      startMs: Math.round(parseFloat(start) * 1000),
      durMs: Math.round(parseFloat(dur || '0') * 1000),
    }))
    .filter(cue => cue.text.length > 0);
}

app.post('/api/import-youtube', generateLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }

  const videoId = extractYoutubeVideoId(url.trim());
  if (!videoId) {
    return res.status(400).json({ error: 'Could not parse a YouTube video ID from this URL.' });
  }

  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.8',
      },
    });
    if (!pageRes.ok) {
      return res.status(502).json({ error: `Failed to fetch video page: HTTP ${pageRes.status}` });
    }

    const html = await pageRes.text();
    const playerResponse = extractJsonAfter(html, 'ytInitialPlayerResponse');
    if (!playerResponse) {
      return res.status(422).json({ error: 'Could not read this video\'s data. It may be age-restricted or unavailable.' });
    }

    const playability = playerResponse.playabilityStatus?.status;
    if (playability && playability !== 'OK') {
      return res.status(422).json({
        error: `Video unavailable (${playerResponse.playabilityStatus?.reason || playability}).`,
      });
    }

    // No (Japanese) captions is not a hard failure — the video can still be
    // imported as a video-only passage for audio shadowing, just without
    // text/vocab/caption-synced looping.
    const title = playerResponse.videoDetails?.title || `YouTube video ${videoId}`;

    const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) {
      return res.json({ title, text: '', videoId, cues: null });
    }

    const jaTrack =
      tracks.find(t => t.languageCode === 'ja' && t.kind !== 'asr') ||
      tracks.find(t => t.languageCode === 'ja') ||
      tracks.find(t => t.languageCode?.startsWith('ja'));

    if (!jaTrack) {
      return res.json({ title, text: '', videoId, cues: null });
    }

    // Caption fetch is best-effort, not required — the caption endpoint is
    // rate-limited separately from the page scrape above and 429s under
    // moderate load, but that should degrade to a working video-only import,
    // not block it. Any failure here (rate limit, network error, empty/
    // unparseable XML) falls through to the same video-only response as "no
    // captions found".
    let cues = [];
    try {
      const captionRes = await fetch(jaTrack.baseUrl);
      if (captionRes.ok) {
        const captionXml = await captionRes.text();
        cues = parseYoutubeCaptionXml(captionXml);
      } else {
        console.warn(`caption fetch HTTP ${captionRes.status} for ${videoId}, falling back to video-only`);
      }
    } catch (captionErr) {
      console.warn(`caption fetch failed for ${videoId}, falling back to video-only:`, captionErr.message);
    }

    if (cues.length === 0) {
      return res.json({ title, text: '', videoId, cues: null });
    }

    const rawText = cues.map(c => c.text).join('');

    // Punctuation restoration rewrites the text and would desync cue
    // boundaries from it, so it's skipped here — cue boundaries substitute
    // for punctuation-based sentence splitting downstream instead.
    res.json({ title, text: rawText, videoId, cues });
  } catch (error) {
    console.error('import-youtube error:', error);
    res.status(500).json({ error: error.message });
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
