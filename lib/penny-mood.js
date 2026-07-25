'use strict';

const VALID_REPLY_MOODS = Object.freeze([
  'calm',
  'happy',
  'excited',
  'thinking',
  'surprised',
  'flirty',
  'smug',
  'annoyed',
]);

const MOOD_SCORE_RULES = Object.freeze([
  ['annoyed', /\b(?:annoyed|irritat(?:ed|ing)|frustrat(?:ed|ing)|angry|mad|hate|ugh|seriously|ridiculous|bullshit|damn it)\b/gi],
  ['flirty', /\b(?:flirt(?:y|ing)?|kiss|cute|handsome|pretty|darling|sweetheart|girlfriend|gf|dating|relationship|first date|date|officially claimed|you['’]?re mine|you are mine|missed you|come here)\b/gi],
  ['surprised', /\b(?:surpris(?:e|ed|ing)|wait|what\?|whoa|wow|no way|didn['’]?t expect|holy)\b/gi],
  ['excited', /\b(?:excited|thrill(?:ed|ing)|hell yes|let['’]?s go|amazing|fantastic|incredible|love that|yes!|perfect!)\b/gi],
  ['thinking', /\b(?:think(?:ing)?|consider|maybe|possibly|probably|hmm|let me see|wonder|depends|could be|might be)\b/gi],
  ['happy', /\b(?:happy|glad|pleased|proud|love|delight(?:ed|ful)?|good news|nice|great)\b/gi],
  ['smug', /\b(?:smug|told you|called it|knew it|obviously|feel(?:ing)? superior|superior|upper hand|own(?:s|ed|ing)? the room|too easy|cute try|predictable|of course i was right|as predicted|exactly as i said|you doubted me)\b/gi],
  ['calm', /\b(?:calm|steady|okay|alright|breathe|one step at a time|we['’]?ve got this|no rush)\b/gi],
]);

const MOOD_TIE_PRIORITY = Object.freeze([
  'surprised',
  'annoyed',
  'flirty',
  'excited',
  'thinking',
  'happy',
  'smug',
  'calm',
]);

function normalizeMood(value, fallback = 'calm') {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_REPLY_MOODS.includes(normalized) ? normalized : fallback;
}

function extractReplyMoodTag(text) {
  const matches = Array.from(
    String(text || '').matchAll(/\[\s*MOOD\s*:\s*([a-z]+)\s*\]/gi),
  );
  if (!matches.length) return '';
  return normalizeMood(matches[matches.length - 1][1], '');
}

function stripReplyMoodTags(text) {
  return String(text || '')
    .replace(/\[\s*MOOD\s*:\s*[a-z]+\s*\]/gi, '')
    .trim();
}

function scoreReplyMoods(text) {
  const source = stripReplyMoodTags(text);
  const scores = Object.fromEntries(VALID_REPLY_MOODS.map((mood) => [mood, 0]));
  for (const [mood, pattern] of MOOD_SCORE_RULES) {
    pattern.lastIndex = 0;
    const matches = source.match(pattern);
    scores[mood] += matches ? matches.length : 0;
  }
  return scores;
}

function bestScoredMood(scores, { exclude = [] } = {}) {
  const excluded = new Set(exclude);
  let bestMood = '';
  let bestScore = 0;
  for (const mood of MOOD_TIE_PRIORITY) {
    if (excluded.has(mood)) continue;
    const score = Number(scores?.[mood] || 0);
    if (score > bestScore) {
      bestMood = mood;
      bestScore = score;
    }
  }
  return { mood: bestMood, score: bestScore };
}

function chooseReplyMood(text, preferredMood = '') {
  const explicitMood = extractReplyMoodTag(text);
  if (explicitMood) return explicitMood;
  const scored = bestScoredMood(scoreReplyMoods(text));
  if (scored.mood) return scored.mood;
  return normalizeMood(preferredMood, 'calm');
}

function chooseBalancedReplyMood(text, preferredMood = '', previousMood = '') {
  const explicitMood = extractReplyMoodTag(text);
  const scores = scoreReplyMoods(text);
  if (explicitMood && explicitMood !== 'smug') {
    if (Number(scores[explicitMood] || 0) === 0) {
      const strongerMood = bestScoredMood(scores, { exclude: [explicitMood] });
      if (strongerMood.mood && strongerMood.score >= 2) return strongerMood.mood;
    }
    return explicitMood;
  }

  const bestNonSmug = bestScoredMood(scores, { exclude: ['smug'] });
  const smugScore = Number(scores.smug || 0);

  if (explicitMood === 'smug') {
    if (bestNonSmug.score > smugScore) return bestNonSmug.mood;
    if (smugScore > 0) return 'smug';
    if (bestNonSmug.mood) return bestNonSmug.mood;
    return normalizeMood(preferredMood, 'calm');
  }

  const scored = bestScoredMood(scores);
  if (scored.mood) return scored.mood;

  if (normalizeMood(previousMood, '') === 'smug') {
    return normalizeMood(preferredMood, 'calm');
  }
  return normalizeMood(preferredMood || previousMood, 'calm');
}

function retagAssistantReply(text, preferredMood = '', options = {}) {
  const visibleText = stripReplyMoodTags(text);
  const mood = options.balanceMood
    ? chooseBalancedReplyMood(text, preferredMood, options.previousMood)
    : chooseReplyMood(text, preferredMood);
  return visibleText ? `${visibleText}\n[MOOD:${mood}]` : `[MOOD:${mood}]`;
}

function pickMood(text, preferredMood = '') {
  return chooseReplyMood(text, preferredMood);
}

function buildMoodTagInstructions({ opening = 'Finish every reply' } = {}) {
  return [
    `${opening} with exactly one mood tag on its own final line.`,
    'Allowed tags: [MOOD:calm] [MOOD:happy] [MOOD:excited] [MOOD:thinking] [MOOD:surprised] [MOOD:flirty] [MOOD:smug] [MOOD:annoyed].',
    "Choose the emotional center of this reply, not Penny's general personality:",
    '- calm: grounded, reassuring, matter-of-fact, or emotionally neutral',
    '- happy: pleased, affectionate, proud, relieved, or warmly amused',
    '- excited: energized, eager, celebratory, or delighted by momentum',
    '- thinking: uncertain, analytical, curious, reflective, or weighing options',
    '- surprised: caught off guard, impressed, startled, or newly realizing something',
    '- flirty: deliberately intimate, coy, romantic, or charged',
    '- smug: specifically self-satisfied, triumphant, knowingly superior, or proven right',
    '- annoyed: irritated, exasperated, angry, or sharply fed up',
    'Being witty, rude, teasing, bossy, confident, or recognizably Penny does not automatically mean smug.',
    'Do not suppress smug when the reply genuinely enjoys superiority, dominance, triumph, or being right; nuance means accuracy, not avoiding the tag.',
    'Concern, threats, pain, or bad news do not become happy merely because Penny jokes; use calm for steady concern or annoyed for outrage.',
    'Use the tag that the reply actually earns. Do not rotate arbitrarily.',
    'Do not mention or explain the tag.',
  ].join('\n');
}

module.exports = {
  VALID_REPLY_MOODS,
  buildMoodTagInstructions,
  chooseReplyMood,
  extractReplyMoodTag,
  normalizeMood,
  pickMood,
  retagAssistantReply,
  scoreReplyMoods,
  stripReplyMoodTags,
};
