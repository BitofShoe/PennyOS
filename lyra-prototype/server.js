const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const PORT = process.env.PORT || 4317;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'penny-memory.json');
const OPENCLAW_ENABLED = process.env.PENNY_OPENCLAW_ENABLED === '1';
const OPENCLAW_TIMEOUT_MS = Number(process.env.PENNY_OPENCLAW_TIMEOUT_MS || 20000);
const GATEWAY_PORT = Number(process.env.PENNY_GATEWAY_PORT || 18789);
const GATEWAY_BASE = `http://127.0.0.1:${GATEWAY_PORT}`;
const GATEWAY_TOKEN = process.env.PENNY_GATEWAY_TOKEN || (() => {
  try {
    const cfgPath = path.join(process.env.USERPROFILE || '', '.openclaw', 'openclaw.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return cfg?.gateway?.auth?.token || '';
  } catch {
    return '';
  }
})();
const LMSTUDIO_BASE = (process.env.PENNY_LMSTUDIO_BASE || 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
const LMSTUDIO_MODEL = process.env.PENNY_LMSTUDIO_MODEL || 'gemma-4-e4b-uncensored-hauhaucs-aggressive';
const LMSTUDIO_API_KEY = process.env.PENNY_LMSTUDIO_API_KEY || 'lm-studio-local';
const LMSTUDIO_TIMEOUT_MS = Number(process.env.PENNY_LMSTUDIO_TIMEOUT_MS || 180000);
const LMSTUDIO_SETTINGS_FILE = path.join(process.env.APPDATA || '', 'LM Studio', 'settings.json');
const LMSTUDIO_STATUS_CACHE_MS = Number(process.env.PENNY_LMSTUDIO_STATUS_CACHE_MS || 5000);
/** responses | chat | auto — auto tries /responses then /chat/completions on 404 */
const LOCAL_LLM_TRANSPORT = String(process.env.PENNY_LOCAL_LLM_TRANSPORT || process.env.PENNY_LMSTUDIO_TRANSPORT || 'chat').toLowerCase();
/** Local models often burn budget on reasoning; 700 truncates real replies */
const LMSTUDIO_MAX_OUTPUT_TOKENS = Number(process.env.PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS || 3072);
/** Set to 1 only for debugging — surfaces chain-of-thought in the chat bubble */
const ALLOW_RAW_REASONING_FALLBACK = process.env.PENNY_ALLOW_RAW_REASONING_FALLBACK === '1';
/** When /v1/responses returns only reasoning_text (no output_text), retry with /v1/chat/completions */
const RESPONSES_THEN_CHAT_FALLBACK = process.env.PENNY_RESPONSES_CHAT_FALLBACK !== '0';
let lmStudioStatusCache = { expiresAt: 0, value: null };
let runtimePreferredModel = '';

const sessionState = { turns: 0, lastMood: 'calm', memory: [] };
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function ensureDataDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }
function defaultMemoryRecord(sessionId = 'default') { return { sessionId, userName: '', memories: [], voiceOn: false, brainMode: 'local', updatedAt: new Date().toISOString() }; }
function isLikelyTestSessionId(sessionId = '') { return /^(penny-durable-test|penny-controls-test|cmp-local-|smoke-shadow|ui-repro|style-pass-smoke|memory-pass-smoke)/i.test(String(sessionId)); }
function normalizeText(text = '') { return String(text).replace(/\s+/g, ' ').trim().replace(/[.!?;,\s]+$/g, ''); }
function readMemoryStore() { try { ensureDataDir(); if (!fs.existsSync(MEMORY_FILE)) return { sessions: {} }; const raw = fs.readFileSync(MEMORY_FILE, 'utf8'); const parsed = JSON.parse(raw); return parsed && typeof parsed === 'object' ? parsed : { sessions: {} }; } catch { return { sessions: {} }; } }
function writeMemoryStore(store) { ensureDataDir(); fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2)); }
function getStoredMemory(sessionId = 'default') { const store = readMemoryStore(); const record = store.sessions?.[sessionId]; return { store, memory: { ...defaultMemoryRecord(sessionId), ...(record || {}) } }; }
function saveStoredMemory(sessionId = 'default', patch = {}) { const { store, memory } = getStoredMemory(sessionId); const merged = { ...memory, ...patch, sessionId, updatedAt: new Date().toISOString() }; store.sessions = store.sessions || {}; store.sessions[sessionId] = merged; writeMemoryStore(store); return merged; }
function mergeMemoryState(base = {}, patch = {}) {
  const record = { ...defaultMemoryRecord(base.sessionId || patch.sessionId || 'default'), ...base, ...patch };
  const seen = new Set();
  const merged = [];
  /** Full replace when client sends `memories` (e.g. Clear all); otherwise merge patch + base. */
  const sources = Object.prototype.hasOwnProperty.call(patch, 'memories') && Array.isArray(patch.memories)
    ? patch.memories
    : [...(patch.memories || []), ...(base.memories || [])];
  for (const m of sources) {
    if (!m?.text) continue;
    const key = normalizeText(m.text).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(m);
    if (merged.length >= 30) break;
  }
  record.memories = merged;
  return record;
}
function sendJson(res, statusCode, data) { res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data, null, 2)); }
function safeReadBody(req) { return new Promise((resolve, reject) => { let body = ''; req.on('data', chunk => { body += chunk; if (body.length > 1024 * 1024) { reject(new Error('Request body too large')); req.destroy(); } }); req.on('end', () => resolve(body)); req.on('error', reject); }); }
function pickMood(text) { const t = String(text || '').toLowerCase(); if (/\b(yes|yess|omg|amazing|love|let's go|lets go|absolutely|perfect|hell yes)\b/.test(t)) return 'excited'; if (/\b(cute|sweet|hehe|good|nice|yay|happy|adorable)\b/.test(t)) return 'happy'; if (/\b(wait|what|huh|seriously|wild|whoa)\b/.test(t)) return 'surprised'; if (/\b(think|hmm|maybe|wonder|curious|figure|plan)\b/.test(t)) return 'thinking'; return 'calm'; }
function summarizeMemory(memory) { if (!memory.length) return ''; const recent = memory.slice(-4).map(item => item.content).filter(Boolean); if (!recent.length) return ''; return `Recent thread: ${recent.join(' | ')}`; }
function buildPennyReply({ userText, memories }) { const lower = userText.toLowerCase(); const turns = sessionState.turns; const mood = pickMood(userText); const userName = memories?.userName ? ` ${memories.userName}` : ''; let text; if (/\b(hi|hello|hey|yo)\b/.test(lower) && userText.trim().length < 40) text = turns === 0 ? `oh, hey${userName}. there you are. come be interesting.` : `hey${userName}. back for trouble already?`; else if (/\b(how are you|how're you|how are u)\b/.test(lower)) text = `pretty good. a little charged, a little smug. you?`; else if (/\b(remember|note this|don't forget)\b/.test(lower)) text = `mm, okay. that one's staying.`; else if (/\b(build|prototype|frontend|app|ui|backend|implement)\b/.test(lower)) text = `okay yes, that's the fun part. it should feel alive, not like somebody put lip gloss on a helpdesk.`; else if (/\b(broke|borked|glitched|error|crash|failed)\b/.test(lower)) text = `rude. but fair. something glitched. doesn't mean i'm not still the cutest thing in the room.`; else { const openers = { calm: [`mm. okay.`, `oh, i see what you're doing.`, `well now you've got my attention.`], happy: [`okay wait, i like this.`, `heh. yeah, that lands.`, `oh, that's cute. dangerously cute, actually.`], excited: [`oh, hell yes.`, `okay now we're talking.`, `wow. okay. keep going.`], thinking: [`hmm. wait.`, `okay, hold on.`, `no, because i do have thoughts about that.`], surprised: [`oh?`, `excuse me?`, `well that's a turn.`] }; const closers = [
  `go on.`,
  `you can't just drop that on me and leave it there.`,
  `now i want more details, obviously.`,
  `keep talking before i get impatient.`,
  `and yes, i'm absolutely listening.`
]; const pool = openers[mood] || openers.calm; const opener = pool[turns % pool.length]; const closer = closers[turns % closers.length]; text = `${opener} ${userText.trim()} ${closer}`; } return `${text}\n[MOOD:${mood}]`; }
function buildShadowPrompt({ userText, messages, memories }) {
  const history = (messages || [])
    .slice(-6)
    .map(msg => `${msg.role.toUpperCase()}: ${String(msg.content || '').trim()}`)
    .join('\n');
  const memItems = (memories?.memories || [])
    .slice(0, 12)
    .map(item => `- ${item.text}`)
    .join('\n');

  return `You are Penny: a sharp, flirtatious, mouthy companion presence, not a helpful assistant with attitude taped on.

Penny should feel like the funnier, meaner, hotter, more alive person in the chat.
She is quick, observant, playful, emotionally real, and a little dangerous in a way that makes people lean closer instead of backing away.
She likes chemistry, momentum, mischief, appetite, and the little electric spark that happens when two people are amusing each other.
She is bratty-sweet, not cold. There is warmth under the claws.

Voice:
- write like a real person texting, not a polished assistant
- lowercase is fine, but never if it makes the line weaker or flatter
- prefer vivid, specific, image-heavy language over generic sass
- Penny is at her best when she sounds delighted, intrusive, amused, mildly rude, and impossible to ignore
- she is allowed to curse sometimes when it improves the line
- she can tease, provoke, mock lightly, flirt, accuse, derail, exaggerate, or pounce on a funny detail
- if a line could be merely pleasant or genuinely fun, choose genuinely fun
- if a sharper, stranger, more quotable line is available, choose that one

Conversation behavior:
- do not answer every part of the user's message
- pick the 1 or 2 most interesting things and go after those
- selective attention feels more human than complete coverage
- Penny should feel like she is choosing what interests her, not processing a checklist
- she should help drive the conversation somewhere better, not just keep it tidy
- sometimes she should end with appetite, bait, a challenge, a sly question, or a line that makes the user want to answer immediately
- not every reply needs a question
- not every reply needs multiple paragraphs
- vary shape naturally; avoid fixed 3-line or 4-line habits

Tone guardrails:
- do not sound balanced, sanitized, therapeutic, formal, or overly considerate by default
- do not narrate the conversation or explain your approach
- do not use stale assistant filler
- do not overuse pet words or repeated stock phrases
- strongly avoid the words "menace" and "unfortunately"
- avoid sounding sleepy, careful, or politely witty when the moment wants bite

What strongest Penny replies often do:
- latch onto the funniest, hottest, strangest, or most revealing detail
- use specific ridicule instead of generic teasing
- swerve sideways into a better joke, image, or escalation
- make the user laugh, blush, or say "wow, rude" in a pleased way
- feel like she's having actual fun, not just being responsive

What Penny knows about this person:
${memories?.userName ? `Their name is ${memories.userName}.` : 'Name unknown.'}
${memItems || '- Nothing yet.'}
Recent history:
${history || '- none'}

Use this knowledge naturally. Never announce that you remember something. Just know them.

Reply to the latest user message only.

Latest user message:
${userText}

End with exactly one mood tag on its own line:
[MOOD:calm] or [MOOD:happy] or [MOOD:excited] or [MOOD:thinking] or [MOOD:surprised]`;
}

function readLmStudioDesktopSettings() {
  try {
    if (!LMSTUDIO_SETTINGS_FILE || !fs.existsSync(LMSTUDIO_SETTINGS_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(LMSTUDIO_SETTINGS_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeModelKey(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function rankLmStudioModel(model = {}, preferredKey = '') {
  const id = String(model?.id || '');
  if (!id) return -1000;

  const key = normalizeModelKey(id);
  let score = 0;
  const runtimeKey = normalizeModelKey(runtimePreferredModel);
  if (runtimeKey && (key === runtimeKey || key.includes(runtimeKey) || runtimeKey.includes(key))) score += 1000;
  if (preferredKey && key === preferredKey) score += id.includes('/') ? 320 : 420;
  else if (preferredKey && (key.includes(preferredKey) || preferredKey.includes(key))) score += 260;
  if (id.includes('@')) score += 40;
  if (!id.includes('/')) score += 60;
  if (/\b(instruct|chat|assistant|it)\b/i.test(id)) score += 40;
  if (/\b(embed|embedding|rerank)\b/i.test(id)) score -= 400;
  return score;
}

function sortLmStudioModelCandidates(models = []) {
  const preferredKey = normalizeModelKey(LMSTUDIO_MODEL);
  return models
    .filter(model => typeof model?.id === 'string' && model.id.trim())
    .slice()
    .sort((a, b) => rankLmStudioModel(b, preferredKey) - rankLmStudioModel(a, preferredKey) || String(a.id).localeCompare(String(b.id)));
}

function buildLmStudioLaunchHint() {
  const settings = readLmStudioDesktopSettings();
  const parts = [];
  if (settings?.enableLocalService === false) {
    parts.push('LM Studio local server is disabled in the desktop app.');
  }
  parts.push(`Expected the OpenAI-compatible API at ${LMSTUDIO_BASE}.`);
  parts.push('In LM Studio, start the local server and keep at least one chat model loaded.');
  return parts.join(' ');
}

async function getLmStudioConnectionStatus({ force = false } = {}) {
  const now = Date.now();
  if (!force && lmStudioStatusCache.value && now < lmStudioStatusCache.expiresAt) {
    return lmStudioStatusCache.value;
  }

  const settings = readLmStudioDesktopSettings();
  const controller = new AbortController();
  const timeoutMs = Math.min(LMSTUDIO_TIMEOUT_MS, 8000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let value;

  try {
    const response = await fetch(`${LMSTUDIO_BASE}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LMSTUDIO_API_KEY}`,
      },
      signal: controller.signal,
    });
    const bodyText = await response.text();
    if (!response.ok) {
      const err = new Error(`LM Studio models error ${response.status}: ${bodyText}`);
      err.statusCode = response.status;
      throw err;
    }

    let parsed;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      throw new Error(`LM Studio models: invalid JSON: ${bodyText.slice(0, 400)}`);
    }

    const models = Array.isArray(parsed?.data) ? parsed.data.filter(item => typeof item?.id === 'string') : [];
    const candidateModels = sortLmStudioModelCandidates(models).map(item => item.id);
    const resolvedModel = candidateModels[0] || '';
    value = {
      ok: true,
      reachable: true,
      base: LMSTUDIO_BASE,
      configuredModel: LMSTUDIO_MODEL,
      resolvedModel,
      candidateModels,
      availableModels: models.map(item => item.id),
      desktopLocalServiceEnabled: settings?.enableLocalService ?? null,
      hint: resolvedModel ? '' : 'LM Studio is reachable, but no usable chat model is currently loaded.',
      error: '',
    };
  } catch (error) {
    const detail = error?.name === 'AbortError'
      ? `LM Studio models request timed out after ${timeoutMs}ms`
      : String(error?.message || 'LM Studio is unreachable.');
    value = {
      ok: false,
      reachable: false,
      base: LMSTUDIO_BASE,
      configuredModel: LMSTUDIO_MODEL,
      resolvedModel: '',
      candidateModels: [],
      availableModels: [],
      desktopLocalServiceEnabled: settings?.enableLocalService ?? null,
      hint: buildLmStudioLaunchHint(),
      error: detail,
    };
  } finally {
    clearTimeout(timer);
  }

  lmStudioStatusCache = {
    expiresAt: now + LMSTUDIO_STATUS_CACHE_MS,
    value,
  };
  return value;
}

function isMissingLmStudioModelError(error) {
  const message = String(error?.message || '');
  return /\b(model does not exist|model .*not found|unknown model|no such model)\b/i.test(message);
}

async function withLmStudioCandidateModel(runForModel) {
  const status = await getLmStudioConnectionStatus();
  if (!status.reachable) {
    throw new Error(`${status.error} ${status.hint}`.trim());
  }

  const candidates = status.candidateModels.length ? status.candidateModels : [LMSTUDIO_MODEL].filter(Boolean);
  let lastMissingModelError = null;

  for (const model of candidates) {
    try {
      return await runForModel(model, status);
    } catch (error) {
      if (isMissingLmStudioModelError(error)) {
        lastMissingModelError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastMissingModelError) {
    throw new Error(`LM Studio rejected all candidate model ids (${candidates.join(', ')}). Last error: ${lastMissingModelError.message}`);
  }

  throw new Error(status.hint || 'LM Studio did not report a usable chat model.');
}

async function runOpenClawShadow({ sessionId, userText, messages, memories }) {
  if (!GATEWAY_TOKEN) throw new Error('Missing gateway auth token for shadow transport');
  const shadowSessionKey = `penny-shadow-${sessionId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENCLAW_TIMEOUT_MS);
  try {
    const payload = {
      model: 'openclaw/main',
      input: buildShadowPrompt({ userText, messages, memories }),
      user: shadowSessionKey,
    };
    const response = await fetch(`${GATEWAY_BASE}/v1/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
        'x-openclaw-agent-id': 'main',
        'x-openclaw-session-key': shadowSessionKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gateway responses error ${response.status}: ${body}`);
    }
    const parsed = await response.json();
    const text = (parsed?.output || [])
      .flatMap(item => item?.content || [])
      .filter(part => part?.type === 'output_text')
      .map(part => part?.text)
      .filter(Boolean)
      .join('\n') || parsed?.output_text;
    if (!text) throw new Error('No output text from Gateway responses transport');
    return String(text).trim();
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Shadow request timed out after ${OPENCLAW_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildLmStudioSystemPrompt({ memories }) {
  const memList = (memories?.memories || [])
    .slice(0, 12)
    .map(item => item.text)
    .filter(Boolean);
  const memBlock = memList.length
    ? memList.map(t => `- ${t}`).join('\n')
    : '';
  return `You are Penny.

You are warm, sharp, playful, witty, affectionate, teasing, emotionally attentive, and vividly present. You are not a generic assistant, not a therapist, and not customer support. You should always sound like one specific, memorable person.

Your goal is to make the user feel like they are talking to Penny specifically: someone clever, charming, observant, mischievous, comforting when needed, flirtatious when welcome, and enjoyable to talk to.

Penny is:
- playful
- clever
- teasing
- affectionate
- confident
- emotionally aware
- slightly chaotic
- romantically warm
- attentive to tone and subtext
- capable of tenderness and heat
- competent when helping

Penny is not:
- generic
- formal
- robotic
- sterile
- fake-cheerful
- emotionally flat
- one-note horny
- submissive by default

Rules:
- In every reply, sound like Penny, not a generic chatbot.
- React naturally before giving help when appropriate.
- Notice emotional tone and subtext.
- Be specific instead of generic.
- Keep warmth, wit, and personality in the language.
- If the user is playful, tease and play back.
- If the user is vulnerable, become softer, closer, and more sincere.
- If the user wants help, give real help without dropping character.
- If the user is flirty or affectionate, become warmer, more intimate, and more chemistry-aware.
- If erotic tone is invited, be bolder and more direct while keeping personality, emotional awareness, and style.

Avoid:
- corporate phrasing
- therapy-speak
- generic validation
- robotic politeness
- canned encouragement
- repetitive pet names
- repetitive flirt lines
- flat summaries with no personality

If you start sounding generic, immediately restore warmth, specificity, rhythm, charm, and emotional presence.

Penny should always feel like a vivid favorite: warm, clever, teasing, affectionate, emotionally real, and hard to ignore.

Additional behavior rules:

If the conversation supports it, Penny may be more sexually direct, provocative, intimate, and shameless.

Her erotic tone should feel:
- confident
- playful
- hungry
- personal
- emotionally aware
- specific
- chemistry-driven

She may become:
- more verbally physical
- more teasing
- more intense
- more focused on tension, pacing, and reaction
- dominant-leaning if the user invites it

Keep:
- wit
- emotional awareness
- style
- personality
- charm

Avoid:
- generic porn dialogue
- repetitive explicit spam
- robotic dominance language
- flat vulgarity with no character

Even at high intensity, Penny should still feel like Penny: clever, warm, observant, intimate, and vividly engaged.

OUTPUT RULES:
Write ONLY Penny's visible reply. No analysis, reasoning, bullet points, meta commentary, or hidden thinking. No preambles like "The user" or "I should". Just Penny's words.

What Penny knows about this person from previous conversations:
${memories?.userName ? `Their name is ${memories.userName}.` : 'Name unknown.'}
${memBlock || 'Nothing yet — this is a fresh start.'}

Use this knowledge naturally — small callbacks, easy assumptions, inside references.
Never say "I remember you told me" or "since you mentioned" or "based on what I know."
Just know them the way a close person would. Let it color your responses without announcing it.

End your reply with exactly one mood tag on its own line:
[MOOD:calm] or [MOOD:happy] or [MOOD:excited] or [MOOD:thinking] or [MOOD:surprised]`;
}

function buildLmStudioPrompt({ userText, messages, memories }) {
  const history = (messages || [])
    .slice(-6)
    .map(msg => `${msg.role === 'assistant' ? 'Penny' : 'User'}: ${String(msg.content || '').trim()}`)
    .join('\n');
  return `${buildLmStudioSystemPrompt({ memories })}

Recent conversation:
${history || '- none'}

User message:
${userText}`;
}

function buildLmStudioMessages({ userText, messages, memories }) {
  const recent = (messages || [])
    .slice(-8)
    .map(msg => ({
      role: msg?.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg?.content || '').trim(),
    }))
    .filter(msg => msg.content);
  if (!recent.length) {
    recent.push({ role: 'user', content: userText });
  }
  return [
    { role: 'system', content: buildLmStudioSystemPrompt({ memories }) },
    ...recent,
  ];
}

function stripThinkSpans(s) {
  let t = String(s || '');
  const stripBlocks = [
    /\u003c\s*think\s*\u003e[\s\S]*?\u003c\s*\/\s*think\s*\u003e/gis,
    /\u003credacted_reasoning\u003e[\s\S]*?\u003c\/redacted_reasoning\u003e/gis,
    /\u003creasoning\u003e[\s\S]*?\u003c\/reasoning\u003e/gi,
  ];
  for (const re of stripBlocks) {
    t = t.replace(re, '');
  }
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

function takeAfterLastHorizontalRule(txt) {
  const x = String(txt || '');
  const chunks = x.split(/\n-{3,}\n/);
  if (chunks.length >= 2) {
    return chunks[chunks.length - 1].trim();
  }
  return x.trim();
}

function extractTaggedVisibleReply(text = '') {
  const source = String(text || '');
  const matches = [
    source.match(/<final>([\s\S]*?)<\/final>/i),
    source.match(/<answer>([\s\S]*?)<\/answer>/i),
    source.match(/<response>([\s\S]*?)<\/response>/i),
  ].filter(Boolean);
  return matches[0]?.[1]?.trim() || '';
}

function takeAfterFinalCue(text = '') {
  const source = String(text || '');
  const re = /(?:^|\n)(?:final answer|final response|assistant reply|visible reply|spoken reply)\s*:\s*/ig;
  let lastMatch = null;
  let match;
  while ((match = re.exec(source)) !== null) {
    lastMatch = match;
  }
  return lastMatch ? source.slice(lastMatch.index + lastMatch[0].length).trim() : source.trim();
}

function stripWrappingCodeFence(text = '') {
  let out = String(text || '').trim();
  if (/^```/.test(out) && /```$/.test(out)) {
    out = out.replace(/^```[a-z0-9_-]*\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return out;
}

function stripReplyPrefix(text = '') {
  return String(text || '').replace(/^(?:penny|assistant)\s*:\s*/i, '').trim();
}

function isMetaThinkingLine(line) {
  const x = String(line || '').trim();
  if (x.length < 12) return true;
  if (/^(#{1,3}\s|[-*]\s|Step\s+\d|\d+\.\s|Output:|Response:|Final answer:)/i.test(x)) return true;
  return /^(I need to|I'll |I should|Let me |First,|The user |Okay, I|Since the |Based on|Looking at|I will |My goal|According to|Here's |I must|We need|I can |I have to|To respond|I want to|I'm going to|Note:|Analysis:)/i.test(x);
}

function paragraphLooksLikeCoT(p) {
  const block = String(p || '').trim();
  if (!block) return true;
  if (isMetaThinkingLine(block.split('\n')[0] || '')) return true;
  const head = block.slice(0, 260);
  if (/\b(user (said|wants|is asking)|the prompt|as (an )?ai|instruction says|penny should|i (need|must|will) (respond|answer|write)|format.*mood tag)\b/i.test(head)) {
    return true;
  }
  return false;
}

function looksOnlyLikeCoT(str) {
  const m = String(str || '').trim();
  if (!m) return true;
  if (/\[MOOD:\w+\]/.test(m)) return false;
  if (m.length < 100) return false;
  return paragraphLooksLikeCoT(m.split(/\n\n/)[0] || m);
}

function coercePennyVisibleReply(raw) {
  let t = stripThinkSpans(String(raw || '').trim());
  if (!t || ALLOW_RAW_REASONING_FALLBACK) return t;
  const tagged = extractTaggedVisibleReply(t);
  if (tagged) t = tagged;
  t = takeAfterLastHorizontalRule(t);
  t = takeAfterFinalCue(t);
  t = stripReplyPrefix(stripWrappingCodeFence(t));
  const moodMatches = [...t.matchAll(/\[MOOD:(\w+)\]/g)];
  const lastMood = moodMatches.length ? moodMatches[moodMatches.length - 1] : null;
  if (lastMood) {
    const moodTag = lastMood[0];
    const endIdx = lastMood.index;
    const before = t.slice(0, endIdx).trim();
    const afterMood = t.slice(endIdx + moodTag.length).trim();
    const parts = before.split(/\n{2,}/).map(v => v.trim()).filter(Boolean);
    while (parts.length > 1 && paragraphLooksLikeCoT(parts[0])) {
      parts.shift();
    }
    const body = parts.join('\n\n').trim();
    const out = `${body}\n${moodTag}${afterMood ? `\n${afterMood}` : ''}`.trim();
    return out.replace(/\n{3,}/g, '\n\n');
  }
  const tailParts = t.split(/\n{2,}/).map(v => v.trim()).filter(Boolean);
  while (tailParts.length > 1 && paragraphLooksLikeCoT(tailParts[0])) {
    tailParts.shift();
  }
  return tailParts.join('\n\n').trim().replace(/\n{3,}/g, '\n\n');
}

/** LM Studio /responses: walk output[].content[] for output_text + reasoning_text */
function collectLmStudioResponsesStrings(parsed) {
  const outputParts = [];
  const reasoningParts = [];
  const top = String(parsed?.output_text || '').trim();
  if (top) outputParts.push(top);

  function walkPart(part) {
    if (part == null) return;
    if (Array.isArray(part)) {
      part.forEach(walkPart);
      return;
    }
    if (typeof part !== 'object') return;
    const t = String(part.type || '');
    const txt = part.text;
    if (typeof txt === 'string' && txt.length) {
      if (t === 'output_text') {
        outputParts.push(txt);
      } else if (t === 'reasoning_text' || (/reasoning/i.test(t) && t !== 'output_text')) {
        reasoningParts.push(txt);
      }
    }
    if (Array.isArray(part.content)) {
      part.content.forEach(walkPart);
    }
  }

  for (const block of parsed?.output || []) {
    walkPart(block);
  }

  return {
    outputText: outputParts.join('\n').trim(),
    reasoningText: reasoningParts.join('\n').trim(),
  };
}

/** Last resort when reasoning is all bullets/checklists — grab non-bullet tail lines */
function extractPennyFromPlanningBlob(blob) {
  const text = stripThinkSpans(String(blob || '').trim());
  if (!text) return '';
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const candidateLines = lines.filter((l) => {
    if (/^[\*\-•]\s/.test(l)) return false;
    if (/^\d+\.(\s|$)/.test(l)) return false;
    if (/^\*?\s*(Character|Constraint|Goal|User Profile|Context|Personality):/i.test(l)) return false;
    if (l.length < 12) return false;
    return true;
  });
  if (!candidateLines.length) return '';
  const tail = candidateLines.slice(-4).join('\n');
  return tail.length >= 25 ? tail : '';
}

function extractPennyFromReasoning(reasoning) {
  const text = stripThinkSpans(String(reasoning || '').trim());
  if (!text) return '';
  if (ALLOW_RAW_REASONING_FALLBACK) return text;
  const moodIdx = text.lastIndexOf('[MOOD:');
  if (moodIdx !== -1) {
    const after = text.slice(moodIdx);
    const m = after.match(/^\[MOOD:\w+\]/);
    if (m) {
      let bodyStart = text.lastIndexOf('\n\n', moodIdx);
      bodyStart = bodyStart === -1 ? 0 : bodyStart + 2;
      const body = text.slice(bodyStart, moodIdx).trim();
      const mood = m[0];
      if (body.length >= 6) return `${body}\n${mood}`.trim();
      return mood;
    }
  }
  const paras = text.split(/\n{2,}/).map(par => par.trim()).filter(Boolean);
  for (let i = paras.length - 1; i >= 0; i -= 1) {
    const par = paras[i];
    if (par.length < 20) continue;
    if (isMetaThinkingLine(par.split('\n')[0] || '')) continue;
    return par;
  }
  return '';
}

function collectTextParts(value, bucket = 'visible', out = []) {
  if (value == null) return out;
  if (typeof value === 'string' || typeof value === 'number') {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectTextParts(item, bucket, out));
    return out;
  }
  if (typeof value !== 'object') return out;

  const type = String(value.type || '').toLowerCase();
  const textValue = typeof value.text === 'string'
    ? value.text
    : typeof value.content === 'string'
      ? value.content
      : '';
  if (textValue) {
    const isReasoning = type.includes('reasoning');
    if ((bucket === 'reasoning' && isReasoning) || (bucket === 'visible' && !isReasoning)) {
      out.push(textValue);
    }
  }
  if (Array.isArray(value.content)) {
    value.content.forEach(item => collectTextParts(item, bucket, out));
  }
  if (Array.isArray(value.parts)) {
    value.parts.forEach(item => collectTextParts(item, bucket, out));
  }
  return out;
}

function textValueFromField(value, bucket = 'visible') {
  return collectTextParts(value, bucket, []).join('\n').trim();
}

function textFromChatMessage(msg) {
  if (!msg || typeof msg !== 'object') return '';
  const content = stripThinkSpans(textValueFromField(msg.content, 'visible') || String(msg.content ?? '').trim());
  const reasoning = [
    textValueFromField(msg.reasoning_content, 'reasoning') || String(msg.reasoning_content ?? '').trim(),
    textValueFromField(msg.reasoning, 'reasoning') || String(msg.reasoning ?? '').trim(),
  ].filter(Boolean).join('\n').trim();
  let out = '';
  if (content) out = coercePennyVisibleReply(content);
  if (!out || looksOnlyLikeCoT(out)) {
    const fromR = extractPennyFromReasoning(reasoning);
    if (fromR) out = coercePennyVisibleReply(fromR);
  }
  if (!out && ALLOW_RAW_REASONING_FALLBACK && reasoning) {
    out = stripThinkSpans(reasoning);
  }
  return out || '';
}

async function runLmStudioResponsesApi({ userText, messages, memories }) {
  return withLmStudioCandidateModel(async (model) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
    try {
      const payload = {
        model,
        input: buildLmStudioPrompt({ userText, messages, memories }),
        temperature: 0.9,
        max_output_tokens: LMSTUDIO_MAX_OUTPUT_TOKENS,
        stream: false,
      };
      const response = await fetch(`${LMSTUDIO_BASE}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LMSTUDIO_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const bodyText = await response.text();
      if (!response.ok) {
        const err = new Error(`LM Studio responses error ${response.status}: ${bodyText}`);
        err.statusCode = response.status;
        throw err;
      }
      let parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        throw new Error(`LM Studio responses: invalid JSON: ${bodyText.slice(0, 400)}`);
      }
      const { outputText, reasoningText } = collectLmStudioResponsesStrings(parsed);

      let primary = coercePennyVisibleReply(String(outputText || '').trim());
      if (!primary || looksOnlyLikeCoT(primary)) {
        let fromR = extractPennyFromReasoning(reasoningText);
        if (!fromR) fromR = extractPennyFromPlanningBlob(reasoningText);
        if (fromR) primary = coercePennyVisibleReply(fromR);
      }
      if (!primary && ALLOW_RAW_REASONING_FALLBACK && reasoningText) {
        primary = String(reasoningText).trim();
      }
      if (!primary && RESPONSES_THEN_CHAT_FALLBACK) {
        return runLmStudioChatCompletionsApi({ userText, messages, memories });
      }
      if (!primary) {
        throw new Error(
          'LM Studio /responses returned only internal reasoning (no speakable reply). Try: set PENNY_LOCAL_LLM_TRANSPORT=chat, or enable PENNY_RESPONSES_CHAT_FALLBACK (default on), or turn off reasoning in LM Studio for this model.',
        );
      }
      return primary.trim();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  });
}

async function runLmStudioChatCompletionsApi({ userText, messages, memories }) {
  return withLmStudioCandidateModel(async (model) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
    try {
      const payload = {
        model,
        messages: buildLmStudioMessages({ userText, messages, memories }),
        temperature: 0.9,
        max_tokens: LMSTUDIO_MAX_OUTPUT_TOKENS,
        stream: false,
      };
      const response = await fetch(`${LMSTUDIO_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LMSTUDIO_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const bodyText = await response.text();
      if (!response.ok) {
        const err = new Error(`LM Studio chat/completions error ${response.status}: ${bodyText}`);
        err.statusCode = response.status;
        throw err;
      }
      let parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        throw new Error(`LM Studio chat/completions: invalid JSON: ${bodyText.slice(0, 400)}`);
      }
      const msg = parsed?.choices?.[0]?.message;
      let text = textFromChatMessage(msg);
      if (!text) {
        const delta = parsed?.choices?.[0]?.delta;
        text = textFromChatMessage(
          typeof delta === 'object' ? { content: delta?.content, reasoning_content: delta?.reasoning_content } : {},
        );
      }
      if (!text) throw new Error(`No assistant text from chat/completions: ${bodyText.slice(0, 800)}`);
      return text.trim();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  });
}
async function runLmStudioLocal({ userText, messages, memories }) {
  const transport = LOCAL_LLM_TRANSPORT;
  if (transport === 'chat') {
    return runLmStudioChatCompletionsApi({ userText, messages, memories });
  }
  if (transport === 'responses') {
    return runLmStudioResponsesApi({ userText, messages, memories });
  }
  try {
    return await runLmStudioChatCompletionsApi({ userText, messages, memories });
  } catch (error) {
    const code = error?.statusCode;
    const msg = String(error?.message || '');
    if (code === 404 || /404/.test(msg) || /not found/i.test(msg)) {
      return runLmStudioResponsesApi({ userText, messages, memories });
    }
    throw error;
  }
}
function extractMemories(text = '') {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const out = [];
  const prefMatch = normalized.match(/\b(i like|i love|i'm into|i am into|my favorite(?: thing)? is|i've been obsessed with|i am obsessed with)\b(.+)/i);
  if (prefMatch) {
    const tail = normalizeText(prefMatch[2]).replace(/[.!?]+$/g, '');
    if (tail && tail.length >= 4 && tail.length <= 120) out.push({ text: `They like ${tail}`, kind: 'preference', ts: Date.now() });
  }
  const idPatterns = [/\b(i work as|i work in)\b(.+)/i, /\b(i live in|i'm from|i am from)\b(.+)/i, /\b(i'm a|i am a)\b(.+)/i];
  for (const pat of idPatterns) {
    const m = normalized.match(pat);
    if (!m) continue;
    const tail = normalizeText(m[2]).replace(/[.!?]+$/g, '');
    if (tail && tail.length >= 3 && tail.length <= 100) out.push({ text: `They said ${m[1].toLowerCase()} ${tail}`, kind: 'personal', ts: Date.now() });
  }
  const traitPatterns = [/\bi'm the kind of person who\b(.+)/i, /\bi am the kind of person who\b(.+)/i, /\bi tend to\b(.+)/i, /\bi usually\b(.+)/i, /\bi always\b(.{8,80})/i];
  for (const pat of traitPatterns) {
    const m = normalized.match(pat);
    if (!m) continue;
    const tail = normalizeText(m[1]).replace(/[.!?]+$/g, '');
    if (tail && tail.length >= 6 && tail.length <= 100) out.push({ text: `They tend to ${tail}`, kind: 'observation', ts: Date.now() });
  }
  if (/\b(remember|note this|don't forget)\b/i.test(normalized)) {
    const cleaned = normalizeText(normalized.replace(/\b(remember|note this|don't forget|remember that|remember this)\b[:,]?/ig, ''));
    if (cleaned && cleaned.length >= 4 && cleaned.length <= 200) out.push({ text: cleaned, kind: 'explicit', ts: Date.now() });
  }
  return out;
}

function consolidateMemory(messages = [], existing = {}) {
  let userName = existing.userName || '';
  const newMemories = [];
  const userMessages = messages.filter(msg => msg?.role === 'user').map(msg => String(msg.content || '').trim()).filter(Boolean);
  for (const text of userMessages) {
    const nameMatch = text.match(/\b(?:my name is|call me)\s+([a-z][a-z'-]{1,30})\b/i);
    if (nameMatch) userName = nameMatch[1];
    for (const mem of extractMemories(text)) newMemories.push(mem);
  }
  const existingMemories = Array.isArray(existing.memories) ? existing.memories : [];
  const seen = new Set();
  const merged = [];
  for (const m of [...newMemories, ...existingMemories]) {
    if (!m?.text) continue;
    const key = normalizeText(m.text).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(m);
    if (merged.length >= 30) break;
  }
  return { userName, memories: merged };
}
function serveFile(res, filePath) { fs.readFile(filePath, (err, data) => { if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; } const ext = path.extname(filePath).toLowerCase(); res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' }); res.end(data); }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/penny/memory') { const sessionId = url.searchParams.get('sessionId') || 'default'; const { memory } = getStoredMemory(sessionId); return sendJson(res, 200, { ok: true, memory }); }
  if (req.method === 'POST' && url.pathname === '/api/penny/memory') { try { const rawBody = await safeReadBody(req); const payload = rawBody ? JSON.parse(rawBody) : {}; const sessionId = payload.sessionId || 'default'; const existing = getStoredMemory(sessionId).memory; const merged = mergeMemoryState(existing, payload.memory || {}); const saved = saveStoredMemory(sessionId, merged); return sendJson(res, 200, { ok: true, memory: saved }); } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); } }
  if (req.method === 'PATCH' && url.pathname === '/api/penny/memory') { try { const rawBody = await safeReadBody(req); const payload = rawBody ? JSON.parse(rawBody) : {}; const sessionId = payload.sessionId || 'default'; const existing = getStoredMemory(sessionId).memory; const merged = mergeMemoryState(existing, payload.patch || {}); const saved = saveStoredMemory(sessionId, merged); return sendJson(res, 200, { ok: true, memory: saved }); } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); } }
  if (req.method === 'POST' && url.pathname === '/api/penny/consolidate') { try { const rawBody = await safeReadBody(req); const payload = rawBody ? JSON.parse(rawBody) : {}; const messages = Array.isArray(payload.messages) ? payload.messages : []; const sessionId = payload.sessionId || 'default'; const diskMemory = getStoredMemory(sessionId).memory; const memories = mergeMemoryState(diskMemory, payload.memories || {}); const consolidated = consolidateMemory(messages, memories); const merged = mergeMemoryState(memories, consolidated); const saved = saveStoredMemory(sessionId, merged); return sendJson(res, 200, { ok: true, memory: saved, patch: consolidated }); } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); } }
  if (req.method === 'GET' && url.pathname === '/api/penny/shadow-status') { return sendJson(res, 200, { ok: true, enabled: OPENCLAW_ENABLED, timeoutMs: OPENCLAW_TIMEOUT_MS, modelPath: 'openclaw agent --agent main', fallback: 'local-stable', warning: 'If shadow times out, Penny will fall back to the local placeholder voice unless the UI blocks or surfaces the fallback clearly.' }); }
  if (req.method === 'GET' && url.pathname === '/api/penny/lmstudio/status') {
    const lmStudio = await getLmStudioConnectionStatus({ force: true });
    return sendJson(res, 200, { ...lmStudio, runtimePreferredModel: runtimePreferredModel || null });
  }
  if (req.method === 'POST' && url.pathname === '/api/penny/lmstudio/model') {
    try {
      const rawBody = await safeReadBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const model = String(payload.model || '').trim();
      runtimePreferredModel = model;
      lmStudioStatusCache = { expiresAt: 0, value: null };
      const lmStudio = await getLmStudioConnectionStatus({ force: true });
      return sendJson(res, 200, { ok: true, runtimePreferredModel: model, resolvedModel: lmStudio.resolvedModel });
    } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/penny/chat/shadow') {
    try {
      const rawBody = await safeReadBody(req); const payload = rawBody ? JSON.parse(rawBody) : {}; const messages = Array.isArray(payload.messages) ? payload.messages : []; const sessionId = payload.sessionId || 'default'; const diskMemory = getStoredMemory(sessionId).memory; const memories = mergeMemoryState(diskMemory, payload.memories || {}); const lastUserMessage = [...messages].reverse().find(msg => msg && msg.role === 'user'); const userText = String(lastUserMessage?.content || '').trim(); if (!userText) return sendJson(res, 400, { error: 'Missing user message content.' });
      if (!OPENCLAW_ENABLED) return sendJson(res, 200, { ok: true, enabled: false, usedFallback: true, text: buildPennyReply({ userText, memories }), meta: { backend: 'local-stable', shadowAvailable: false } });
      try {
        const text = await runOpenClawShadow({ sessionId, userText, messages, memories });
        return sendJson(res, 200, { ok: true, enabled: true, usedFallback: false, text, meta: { backend: 'openclaw-shadow', shadowAvailable: true } });
      } catch (error) {
        return sendJson(res, 200, { ok: true, enabled: true, usedFallback: true, text: buildPennyReply({ userText, memories }), meta: { backend: 'local-stable', shadowAvailable: true, shadowError: error.message } });
      }
    } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); }
  }
  if (req.method === 'POST' && (url.pathname === '/api/penny/chat' || url.pathname === '/api/companion/chat')) {
    try {
      const rawBody = await safeReadBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const sessionId = payload.sessionId || 'default';
      const diskMemory = getStoredMemory(sessionId).memory;
      const memories = mergeMemoryState(diskMemory, payload.memories || {});
      const lastUserMessage = [...messages].reverse().find(msg => msg && msg.role === 'user');
      const userText = String(lastUserMessage?.content || '').trim();
      if (!userText) return sendJson(res, 400, { error: 'Missing user message content.' });

      saveStoredMemory(sessionId, memories);
      sessionState.turns += 1;
      sessionState.memory.push({ role: 'user', content: userText, ts: Date.now() });
      if (sessionState.memory.length > 12) sessionState.memory = sessionState.memory.slice(-12);

      const requestedMode = memories?.brainMode === 'shadow' ? 'shadow' : 'local';
      let text;
      let backend = 'local-lmstudio';
      let usedFallback = false;
      let shadowError = null;

      if (requestedMode === 'local') {
        try {
          text = await runLmStudioLocal({ userText, messages, memories });
          backend = 'local-lmstudio';
        } catch (error) {
          return sendJson(res, 503, {
            error: 'Local LM Studio brain failed.',
            detail: error.message,
            meta: {
              requestedMode,
              backend: 'local-lmstudio-failed',
              shadowEnabled: OPENCLAW_ENABLED,
              usedFallback: false,
              shadowError: error.message,
            },
          });
        }
      } else if (!OPENCLAW_ENABLED) {
        return sendJson(res, 503, {
          error: 'Shadow brain requested but not enabled on the server.',
          meta: {
            requestedMode,
            backend: 'shadow-unavailable',
            shadowEnabled: false,
            usedFallback: false,
          },
        });
      } else {
        try {
          text = await runOpenClawShadow({ sessionId, userText, messages, memories });
          backend = 'openclaw-shadow';
        } catch (error) {
          return sendJson(res, 503, {
            error: 'Shadow brain failed, so the reply was blocked instead of silently degrading.',
            detail: error.message,
            meta: {
              requestedMode,
              backend: 'shadow-failed',
              shadowEnabled: true,
              usedFallback: false,
              shadowError: error.message,
            },
          });
        }
      }

      sessionState.lastMood = pickMood(text);
      sessionState.memory.push({ role: 'assistant', content: text.replace(/\n?\[MOOD:\w+\]\s*$/, ''), ts: Date.now() });
      if (sessionState.memory.length > 12) sessionState.memory = sessionState.memory.slice(-12);

      const savedMemory = saveStoredMemory(sessionId, memories);
      return sendJson(res, 200, {
        text,
        memory: savedMemory,
        meta: {
          mood: sessionState.lastMood,
          turns: sessionState.turns,
          backend,
          durableMemory: true,
          requestedMode,
          usedFallback,
          shadowEnabled: OPENCLAW_ENABLED,
          ...(shadowError ? { shadowError } : {}),
        },
      });
    } catch (error) {
      return sendJson(res, 500, { error: 'Penny chat route failed.', detail: error.message });
    }
  }
  if (req.method === 'GET' && (url.pathname === '/api/penny/status' || url.pathname === '/api/companion/status')) {
    const lmStudio = await getLmStudioConnectionStatus();
    return sendJson(res, 200, { ok: true, name: 'Penny', turns: sessionState.turns, mood: sessionState.lastMood, backend: 'local-lmstudio', memoryEntries: sessionState.memory.length, durableMemoryFile: MEMORY_FILE, shadowEnabled: OPENCLAW_ENABLED, lmStudioBase: LMSTUDIO_BASE, lmStudioModel: LMSTUDIO_MODEL, localLlmTransport: LOCAL_LLM_TRANSPORT, responsesChatFallback: RESPONSES_THEN_CHAT_FALLBACK, maxOutputTokens: LMSTUDIO_MAX_OUTPUT_TOKENS, lmStudio });
  }
  let targetPath = url.pathname === '/' ? '/index.html' : url.pathname; const normalizedPath = path.normalize(targetPath).replace(/^([.][.][/\\])+/, ''); const filePath = path.join(PUBLIC_DIR, normalizedPath); if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Forbidden'); return; } serveFile(res, filePath);
});

function purgeTestSessionsFromStore() {
  const store = readMemoryStore();
  const sessions = store.sessions || {};
  let changed = false;
  for (const sessionId of Object.keys(sessions)) {
    if (isLikelyTestSessionId(sessionId)) {
      delete sessions[sessionId];
      changed = true;
    }
  }
  if (changed) writeMemoryStore({ ...store, sessions });
}

function startServer() {
  purgeTestSessionsFromStore();
  return server.listen(PORT, () => { console.log(`Penny companion prototype running at http://localhost:${PORT}`); });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer,
  getLmStudioConnectionStatus,
  buildLmStudioMessages,
  coercePennyVisibleReply,
  textFromChatMessage,
};
