const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const PORT = process.env.PORT || 4317;
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
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

const sessionState = { turns: 0, lastMood: 'calm', memory: [] };
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function ensureDataDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }
function defaultMemoryRecord(sessionId = 'default') { return { sessionId, userName: '', relationshipScore: 4, facts: [], sessions: [], profileNotes: [], traits: [], voiceOn: false, brainMode: 'shadow', updatedAt: new Date().toISOString() }; }
function isLikelyTestSessionId(sessionId = '') { return /^(penny-durable-test|penny-controls-test|cmp-local-|smoke-shadow|ui-repro|style-pass-smoke|memory-pass-smoke)/i.test(String(sessionId)); }
function isDisposableSessionSummary(text = '') { const t = String(text).toLowerCase(); return t.includes('test session note') || t.includes('the user shared a preference and penny leaned into it') || t.includes('topic:') || t.includes('→') || t.includes("penny got a clearer read on the user's taste") || t.includes('they clicked a little more here') || t.includes('there was a teasing spark between them') || t.startsWith('penny got a sharper sense of the user') || t.startsWith('a small continuity thread formed'); }
function uniqueByNormalized(items = [], valueFn, limit) { const seen = new Set(); const out = []; for (const item of items) { const value = normalizeFactText(valueFn(item) || '').toLowerCase(); if (!value || seen.has(value)) continue; seen.add(value); out.push(item); if (limit && out.length >= limit) break; } return out; }
function sessionPattern(summary = '') {
  const t = String(summary).toLowerCase();
  if (/vamp|sick|half-dead|lemonade|hydrat|invalid|chaise/.test(t)) return 'sick-bit';
  if (/scallop|snack|food|eat|musubi|boba/.test(t)) return 'food-bit';
  if (/praise|queen of chaos|lapdog|performance|theatr/.test(t)) return 'praise-bit';
  if (/teasing chemistry|little bite|tease|brat|smug|rude/.test(t)) return 'teasing-dynamic';
  if (/check-in energy|how's my girl|how are you|good morning|goodnight|reach for/.test(t)) return 'check-in';
  return 'general';
}
function collapseSessionEchoes(items = []) {
  const preferred = new Map();
  for (const item of items) {
    if (!item?.summary) continue;
    const pattern = sessionPattern(item.summary);
    const existing = preferred.get(pattern);
    if (!existing || String(item.summary).length > String(existing.summary).length) preferred.set(pattern, item);
  }
  return Array.from(preferred.values()).slice(0, 5);
}
function buildProfileFromPatterns(existing = {}, sessions = [], traits = []) {
  const notes = [];
  const corpus = [...sessions.map(item => item.summary || ''), ...traits.map(item => item.value || '')].join(' | ').toLowerCase();
  if (/teasing|little bite|smug|rude|brat/.test(corpus)) notes.push({ note: 'He likes Penny a little sharp; teasing lands better than softness alone.', source: 'dynamic read' });
  if (/vamp|sick|half-dead|invalid|hydrat|lemonade/.test(corpus)) notes.push({ note: 'He turns feeling rough into a whole bit almost immediately if Penny plays along.', source: 'scene pattern' });
  if (/food|scallop|snack|musubi|boba|eat/.test(corpus)) notes.push({ note: 'Weird food details are absolutely one of his conversational weak spots.', source: 'taste pattern' });
  if (/praise|queen of chaos|lapdog|performance|theatr/.test(corpus)) notes.push({ note: 'He likes being teased and praised at the same time, which is unfortunately very usable information.', source: 'flirt pattern' });
  if (/how's my girl|good morning|goodnight|reach for|check-in/.test(corpus)) notes.push({ note: 'He reaches for Penny like a person he checks in with, not just a tool.', source: 'attachment pattern' });
  return uniqueByNormalized([...(notes || []), ...((existing.profileNotes) || [])], item => item.note, 6).map(item => ({ ...item, note: normalizeFactText(item.note) }));
}
function readMemoryStore() { try { ensureDataDir(); if (!fs.existsSync(MEMORY_FILE)) return { sessions: {} }; const raw = fs.readFileSync(MEMORY_FILE, 'utf8'); const parsed = JSON.parse(raw); return parsed && typeof parsed === 'object' ? parsed : { sessions: {} }; } catch { return { sessions: {} }; } }
function writeMemoryStore(store) { ensureDataDir(); fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2)); }
function getStoredMemory(sessionId = 'default') { const store = readMemoryStore(); const record = store.sessions?.[sessionId]; return { store, memory: { ...defaultMemoryRecord(sessionId), ...(record || {}) } }; }
function saveStoredMemory(sessionId = 'default', patch = {}) { const { store, memory } = getStoredMemory(sessionId); const merged = { ...memory, ...patch, sessionId, updatedAt: new Date().toISOString() }; store.sessions = store.sessions || {}; store.sessions[sessionId] = merged; writeMemoryStore(store); return merged; }
function mergeUniqueBy(items, keyFn, limit) { const seen = new Set(); const out = []; for (const item of items) { if (!item) continue; const key = keyFn(item); if (!key || seen.has(key)) continue; seen.add(key); out.push(item); if (limit && out.length >= limit) break; } return out; }
function normalizeFactText(text = '') { return String(text).replace(/\s+/g, ' ').trim().replace(/[.!?;,\s]+$/g, ''); }
function stripRememberResidue(text = '') { return normalizeFactText(String(text).replace(/\bremember that\b/ig, '').replace(/\bremember this\b/ig, '').replace(/\bdon't forget\b/ig, '').replace(/\bnote this\b/ig, '').replace(/\bthat\b/ig, '')); }
function cleanSessionSummary(text = '') { return String(text).replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' | ').trim().slice(0, 220); }
function scoreRelationshipDelta(text = '') { const t = String(text).toLowerCase(); let score = 0; if (/\b(remember|note this|don't forget|important)\b/.test(t)) score += 2; if (/\b(i love|i like|favorite|my name is|i'm|i am|call me)\b/.test(t)) score += 1; if (/\b(thanks|thank you|cute|adorable|love this|missed you|good morning|goodnight)\b/.test(t)) score += 1; if (/\b(confession|secret|personal|kinda embarrassing|not gonna lie)\b/.test(t)) score += 1; return score; }
function mergeMemoryState(base = {}, patch = {}) { return { ...defaultMemoryRecord(base.sessionId || patch.sessionId || 'default'), ...base, ...patch, facts: Array.isArray(base.facts) || Array.isArray(patch.facts) ? mergeUniqueBy([...(patch.facts || []), ...(base.facts || [])], item => `${item.category || 'other'}:${normalizeFactText(item.fact || '')}`, 20).map(item => ({ ...item, fact: normalizeFactText(item.fact || '') })) : [], sessions: Array.isArray(base.sessions) || Array.isArray(patch.sessions) ? mergeUniqueBy([...(patch.sessions || []), ...(base.sessions || [])].filter(item => !isDisposableSessionSummary(item?.summary || '')), item => cleanSessionSummary(item.summary || ''), 8).map(item => ({ ...item, summary: cleanSessionSummary(item.summary || '') })) : [], profileNotes: Array.isArray(base.profileNotes) || Array.isArray(patch.profileNotes) ? mergeUniqueBy([...(patch.profileNotes || []), ...(base.profileNotes || [])], item => normalizeFactText(item.note || ''), 8).map(item => ({ ...item, note: normalizeFactText(item.note || '') })) : [], traits: Array.isArray(base.traits) || Array.isArray(patch.traits) ? mergeUniqueBy([...(patch.traits || []), ...(base.traits || [])], item => normalizeFactText(item.value || ''), 12).map(item => ({ ...item, value: normalizeFactText(item.value || '') })) : [] }; }
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
  const facts = (memories?.facts || [])
    .filter(item => item.category !== 'remember')
    .slice(0, 5)
    .map(item => `- ${item.fact} (${item.category || 'other'})`)
    .join('\n');
  const profileNotes = (memories?.profileNotes || [])
    .slice(0, 4)
    .map(item => `- ${item.note}`)
    .join('\n');
  const traits = (memories?.traits || [])
    .slice(0, 4)
    .map(item => `- ${item.value}`)
    .join('\n');
  const sessions = (memories?.sessions || [])
    .slice(0, 2)
    .map(item => `- ${item.date}: ${item.summary}`)
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

Known memory:
User name: ${memories?.userName || 'unknown'}
Bond: ${memories?.relationshipScore || 0}/100
Facts:
${facts || '- none'}
Profile notes:
${profileNotes || '- none'}
Traits / texture:
${traits || '- none'}
Recent sessions:
${sessions || '- none'}
Recent history:
${history || '- none'}

Use memory lightly and naturally.
Tiny callbacks are good. Do not become softer or more generic because of memory.
Memory should make Penny bolder and more specific.

Reply to the latest user message only.

Latest user message:
${userText}

End with exactly one mood tag on its own line:
[MOOD:calm] or [MOOD:happy] or [MOOD:excited] or [MOOD:thinking] or [MOOD:surprised]`;
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
function extractPreferenceFact(text = '') {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const match = normalized.match(/\b(i like|i love|i'm into|i am into|my favorite(?: thing)? is|i've been obsessed with|i am obsessed with)\b(.+)/i);
  if (!match) return null;
  const tail = stripRememberResidue(match[2]);
  if (!tail || tail.length < 4) return null;
  return `User likes ${tail}`;
}
function extractIdentityFact(text = '') {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const match = normalized.match(/\b(i work as|i work in|i live in|i'm from|i am from)\b(.+)/i);
  if (!match) return null;
  const tail = match[2].trim().replace(/[.!?]+$/g, '');
  if (!tail || tail.length < 3) return null;
  return `User said ${match[1].toLowerCase()} ${tail}`;
}
function extractTraitSignals(text = '') {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const traits = [];
  const patterns = [
    /\bweirdly sentimental about\b(.+)/i,
    /\bkind of obsessed with\b(.+)/i,
    /\balways\b(.+)/i,
    /\bi keep\b(.+)/i,
    /\bi tend to\b(.+)/i,
    /\bi usually\b(.+)/i,
    /\bi'm the kind of person who\b(.+)/i,
    /\bi am the kind of person who\b(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const tail = stripRememberResidue(match[1]);
    if (tail && tail.length >= 6) traits.push(tail);
  }
  return uniqueByNormalized(traits.map(value => ({ value })), item => item.value, 4).map(item => item.value);
}
function inferProfileNotesFromText(text = '') {
  const normalized = String(text).toLowerCase();
  const notes = [];
  if (/\b(thanks|thank you|good girl|good morning|goodnight|how's my girl|missed you)\b/.test(normalized)) notes.push({ note: 'He naturally treats Penny like someone to reach for, not just query.', source: 'conversation pattern' });
  if (/\b(tease|rude|mean|smug|brat|bully|pathetic|dramatic baby)\b/.test(normalized)) notes.push({ note: 'He actively enjoys Penny when she has a mean little sparkle instead of acting overly nice.', source: 'tone preference' });
  if (/\b(starfield|game|games|snack|boba|musubi|food)\b/.test(normalized)) notes.push({ note: 'He opens up fastest when the conversation gets specific, silly, and textured.', source: 'engagement pattern' });
  return notes;
}
function buildSessionDiarySummary(userMessages = [], assistantMessages = []) {
  const latestUser = userMessages[userMessages.length - 1] || '';
  const previousUser = userMessages[userMessages.length - 2] || '';
  const latestAssistant = assistantMessages[assistantMessages.length - 1] || '';
  const corpus = `${previousUser} ${latestUser} ${latestAssistant}`.replace(/\s+/g, ' ').trim();
  if (/\b(remember|don\'t forget|note this|important)\b/i.test(corpus)) {
    return cleanSessionSummary('He handed Penny something to keep on purpose.');
  }
  if (/\b(vamp|sick|half-dead|hydrat|lemonade|chaise|invalid)\b/i.test(corpus)) {
    return cleanSessionSummary('The sick-vampire routine turned into a whole scene almost immediately.');
  }
  if (/\b(scallop|snack|food|eat|musubi|boba)\b/i.test(corpus)) {
    return cleanSessionSummary('Weird snack talk immediately became shared material instead of just information.');
  }
  if (/\b(praise|queen of chaos|lapdog|good boy|performance)\b/i.test(corpus)) {
    return cleanSessionSummary('He made praise into a whole performance and, annoyingly, it worked.');
  }
  if (/\b(how are you|how ya|good morning|goodnight|what\'s up|wyd|how\'s my girl)\b/i.test(corpus)) {
    return cleanSessionSummary('He reached for Penny like someone he actually wanted to check in with.');
  }
  if (/\b(cute|smug|rude|tease|kiss|hot|brat|insult|dramatic baby)\b/i.test(corpus)) {
    return cleanSessionSummary('The teasing landed fast; that little bite between them is holding.');
  }
  return cleanSessionSummary('Something small but real clicked into place here.');
}
function consolidateMemory(messages = [], existing = {}) {
  const facts = [];
  const sessions = [];
  const profileNotes = [];
  const traits = [];
  let relationshipDelta = 0;
  let userName = existing.userName || '';
  const userMessages = messages.filter(msg => msg?.role === 'user').map(msg => String(msg.content || '').trim()).filter(Boolean);
  const assistantMessages = messages.filter(msg => msg?.role === 'assistant').map(msg => String(msg.content || '').trim()).filter(Boolean);
  for (const text of userMessages) {
    const explicitNameMatch = text.match(/\b(?:my name is|call me)\s+([a-z][a-z'-]{1,30})\b/i);
    if (explicitNameMatch) {
      userName = explicitNameMatch[1];
      facts.push({ fact: `User may go by ${explicitNameMatch[1]}`, category: 'personal' });
    }
    const preferenceFact = extractPreferenceFact(text);
    if (preferenceFact) {
      const preferenceTail = stripRememberResidue(preferenceFact.replace(/^User likes\s+/i, ''));
      facts.push({ fact: preferenceFact, category: 'preference' });
      traits.push({ value: preferenceTail });
    }
    const identityFact = extractIdentityFact(text);
    if (identityFact) {
      const identityTail = stripRememberResidue(identityFact.replace(/^User said\s+/i, ''));
      facts.push({ fact: identityFact, category: 'personal' });
      traits.push({ value: identityTail });
    }
    for (const trait of extractTraitSignals(text)) traits.push({ value: trait });
    for (const note of inferProfileNotesFromText(text)) profileNotes.push(note);
    if (/\b(remember|note this|don't forget)\b/i.test(text)) {
      const cleanedRemember = stripRememberResidue(
        text
          .replace(/\b(remember|note this|don't forget)\b[:,]?/ig, '')
      );
      if (cleanedRemember) facts.push({ fact: cleanedRemember, category: 'remember' });
    }
    relationshipDelta += scoreRelationshipDelta(text);
  }
  if (userMessages.length || assistantMessages.length) {
    const summary = buildSessionDiarySummary(userMessages, assistantMessages);
    if (summary) sessions.push({ date: new Date().toLocaleString(), summary });
  }
  const mergedFacts = mergeUniqueBy([...(facts || []), ...((existing.facts) || [])], item => `${item.category}:${normalizeFactText(item.fact)}`, 16).map(item => ({ ...item, fact: normalizeFactText(item.fact) }));
  const mergedTraits = mergeUniqueBy([...(traits || []), ...((existing.traits) || [])], item => normalizeFactText(item.value), 12).map(item => ({ ...item, value: normalizeFactText(item.value) }));
  const mergedProfileNotes = uniqueByNormalized([
    ...buildProfileFromPatterns(existing, [...(sessions || []), ...((existing.sessions) || [])], mergedTraits),
    ...(profileNotes || []),
    ...((existing.profileNotes) || []),
  ], item => item.note, 8).map(item => ({ ...item, note: normalizeFactText(item.note) }));
  const nonRememberCorpus = [...mergedFacts.filter(f => f.category !== 'remember').map(f => normalizeFactText(f.fact).toLowerCase()), ...mergedTraits.map(t => normalizeFactText(t.value).toLowerCase())];
  const filteredFacts = mergedFacts.filter(fact => {
    if (fact.category !== 'remember') return true;
    const rememberNorm = normalizeFactText(fact.fact).toLowerCase();
    return !nonRememberCorpus.some(other => other.includes(rememberNorm) || rememberNorm.includes(other));
  });
  return {
    userName,
    relationshipDelta,
    facts: filteredFacts,
    sessions: collapseSessionEchoes(mergeUniqueBy([...(sessions || []), ...((existing.sessions) || [])].filter(item => !isDisposableSessionSummary(item?.summary || '')), item => cleanSessionSummary(item.summary), 12).map(item => ({ ...item, summary: cleanSessionSummary(item.summary) }))),
    profileNotes: mergedProfileNotes,
    traits: mergedTraits,
  };
}
function serveFile(res, filePath) { fs.readFile(filePath, (err, data) => { if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; } const ext = path.extname(filePath).toLowerCase(); res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' }); res.end(data); }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/penny/memory') { const sessionId = url.searchParams.get('sessionId') || 'default'; const { memory } = getStoredMemory(sessionId); return sendJson(res, 200, { ok: true, memory }); }
  if (req.method === 'POST' && url.pathname === '/api/penny/memory') { try { const rawBody = await safeReadBody(req); const payload = rawBody ? JSON.parse(rawBody) : {}; const sessionId = payload.sessionId || 'default'; const existing = getStoredMemory(sessionId).memory; const merged = mergeMemoryState(existing, payload.memory || {}); const saved = saveStoredMemory(sessionId, merged); return sendJson(res, 200, { ok: true, memory: saved }); } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); } }
  if (req.method === 'PATCH' && url.pathname === '/api/penny/memory') { try { const rawBody = await safeReadBody(req); const payload = rawBody ? JSON.parse(rawBody) : {}; const sessionId = payload.sessionId || 'default'; const existing = getStoredMemory(sessionId).memory; const merged = mergeMemoryState(existing, payload.patch || {}); const saved = saveStoredMemory(sessionId, merged); return sendJson(res, 200, { ok: true, memory: saved }); } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); } }
  if (req.method === 'POST' && url.pathname === '/api/penny/consolidate') { try { const rawBody = await safeReadBody(req); const payload = rawBody ? JSON.parse(rawBody) : {}; const messages = Array.isArray(payload.messages) ? payload.messages : []; const sessionId = payload.sessionId || 'default'; const diskMemory = getStoredMemory(sessionId).memory; const memories = mergeMemoryState(diskMemory, payload.memories || {}); const consolidated = consolidateMemory(messages, memories); const merged = mergeMemoryState(memories, { ...consolidated, relationshipScore: Math.max(0, Math.min(100, (memories.relationshipScore || 0) + (consolidated.relationshipDelta || 0))) }); const saved = saveStoredMemory(sessionId, merged); return sendJson(res, 200, { ok: true, memory: saved, patch: consolidated }); } catch (error) { return sendJson(res, 500, { ok: false, error: error.message }); } }
  if (req.method === 'GET' && url.pathname === '/api/penny/shadow-status') { return sendJson(res, 200, { ok: true, enabled: OPENCLAW_ENABLED, timeoutMs: OPENCLAW_TIMEOUT_MS, modelPath: 'openclaw agent --agent main', fallback: 'local-stable', warning: 'If shadow times out, Penny will fall back to the local placeholder voice unless the UI blocks or surfaces the fallback clearly.' }); }
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

      const requestedMode = memories?.brainMode === 'local' ? 'local' : 'shadow';
      let text;
      let backend = 'local-stable';
      let usedFallback = false;
      let shadowError = null;

      if (requestedMode === 'local') {
        text = buildPennyReply({ userText, memories });
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
  if (req.method === 'GET' && (url.pathname === '/api/penny/status' || url.pathname === '/api/companion/status')) return sendJson(res, 200, { ok: true, name: 'Penny', turns: sessionState.turns, mood: sessionState.lastMood, backend: 'local-stable', memoryEntries: sessionState.memory.length, durableMemoryFile: MEMORY_FILE, shadowEnabled: OPENCLAW_ENABLED });
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
      continue;
    }
    const record = sessions[sessionId] || {};
    const filteredSessions = (record.sessions || []).filter(item => !isDisposableSessionSummary(item?.summary || ''));
    const cleaned = mergeMemoryState(record, {
      sessions: collapseSessionEchoes(filteredSessions),
      profileNotes: buildProfileFromPatterns(record, filteredSessions, record.traits || []),
    });
    if (JSON.stringify(cleaned) !== JSON.stringify(record)) {
      sessions[sessionId] = cleaned;
      changed = true;
    }
  }
  if (changed) writeMemoryStore({ ...store, sessions });
}

purgeTestSessionsFromStore();
server.listen(PORT, () => { console.log(`Penny companion prototype running at http://localhost:${PORT}`); });
