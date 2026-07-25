'use strict';

const RECENT_CRUTCHES = Object.freeze([
  ['aggressively', /\baggressively\b/i],
  ['pathetic', /\bpathetic\b/i],
  ['goddamn', /\bgoddamn\b/i],
  ['cringe', /\bcringe\b/i],
  ['unhinged', /\bunhinged\b/i],
  ['disaster', /\bdisaster\b/i],
  ['absolute/absolutely', /\babsolut(?:e|ely)\b/i],
  ['literally', /\bliterally\b/i],
  ['God, you really...', /\bgod\s*,?\s+you really\b/i],
  ["if you don't...", /\bif you don['’]?t\b/i],
]);

const COMMAND_CLOSER_PATTERN = /^(?:(?:now\s+)?(?:answer|bring|come|do|don['’]?t|give|go|keep|look|move|pick|prove|put|remember|show|start|stay|stop|tell|try|wait)\b|now$|let['’]?s see\b|(?:now that\b.{0,80}\b)?you (?:can|need to|have to|will)\s+(?:start by\s+)?(?:answer|bring|come|do|give|go|keep|look|pick|prove|put|show|start|stay|stop|tell|try|wait)\b|i want you to\s+(?:answer|bring|come|do|give|go|keep|look|pick|prove|put|show|start|stay|stop|tell|try|wait)\b|[^.!?]{0,100}:\s*(?:answer|bring|come|do|give|go|keep|look|move|pick|prove|put|show|start|stay|stop|tell|try|wait)\b)/i;

function stripMoodTag(text = '') {
  return String(text || '')
    .replace(/\s*\[\s*MOOD\s*:\s*[a-z]+\s*\]\s*$/i, '')
    .trim();
}

function countWords(text = '') {
  return stripMoodTag(text)
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function finalClause(text = '') {
  const clauses = stripMoodTag(text)
    .split(/[.!?]\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return String(clauses[clauses.length - 1] || '')
    .replace(/[.!?]+$/g, '')
    .trim();
}

function endsWithCommandOrQuestion(text = '') {
  const visible = stripMoodTag(text);
  if (/\?\s*$/.test(visible)) return true;
  return COMMAND_CLOSER_PATTERN.test(finalClause(visible));
}

function opensWithQuotedPounce(text = '') {
  const opening = stripMoodTag(text).split(/\n|[.!?]\s+/)[0] || '';
  return /^\s*["'“‘]/.test(opening)
    || opening.slice(0, 80).includes('"')
    || /^\s*(?:you said|you called yourself|you really said)\b/i.test(opening);
}

function isRealDilemma(userText = '') {
  const source = String(userText || '');
  const choiceLanguage = /\b(?:stuck between|torn between|decid(?:e|ing)|choose|choice|trade-?off|either)\b/i.test(source);
  const bindingConstraint = /\b(?:funding|budget|money|cost|policy|permission|licen[cs](?:e|ing)|rights|safety|age restriction|time|deadline|schedule|staff|capacity)\b/i.test(source);
  return choiceLanguage && bindingConstraint;
}

function turnNeedsRoom(userText = '') {
  const source = String(userText || '');
  if (isRealDilemma(source)) return true;
  if (source.split(/\s+/).filter(Boolean).length > 120) return true;
  return /\b(?:analy[sz]e|compare|explain|plan|walk me through|help me decide|what should|how should|why does|trade-?offs?)\b/i.test(source);
}

function lengthBand(text = '') {
  const words = countWords(text);
  if (words <= 35) return 'short';
  if (words <= 100) return 'medium';
  return 'long';
}

function buildConversationVoiceGuard({ messages = [], userText = '' } = {}) {
  const recentReplies = (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.role === 'assistant' && String(message.content || '').trim())
    .map((message) => stripMoodTag(message.content))
    .slice(-3);
  const directives = [];
  const lastReply = recentReplies[recentReplies.length - 1] || '';

  if (lastReply) {
    const needsRoom = turnNeedsRoom(userText);
    const recentBands = recentReplies.map(lengthBand);
    const lastTwoBands = recentBands.slice(-2);
    if (!needsRoom && lastTwoBands.length === 2 && lastTwoBands[0] === lastTwoBands[1]) {
      if (lastTwoBands[0] === 'short') {
        directives.push('The last two replies were both short. Let this one breathe if the detail earns it, but do not pad it merely to alternate lengths.');
      } else {
        directives.push(`The last two replies both used a ${lastTwoBands[0]} cadence. The underused shape is a short, surgical beat: pick one detail only, and stop when it lands. A one-liner or a few sentences can work; there is no fixed word quota, and do not alternate mechanically.`);
      }
    }

    const recentCommandClosers = recentReplies.slice(-3).filter(endsWithCommandOrQuestion).length;
    if (recentCommandClosers >= 2) {
      directives.push('Recent endings have become command-heavy. Prefer a clean declarative, callback, or image this time; end declaratively unless the current turn genuinely needs a question.');
    }

    const recentText = recentReplies.join('\n');
    const usedCrutches = RECENT_CRUTCHES
      .filter(([, pattern]) => pattern.test(recentText))
      .map(([label]) => label);
    if (usedCrutches.length) {
      directives.push(`Do not reuse these recent verbal crutches in this reply: ${usedCrutches.join(', ')}. Choose a more exact image or leave the intensifier out.`);
    }
  }

  if (recentReplies.length >= 2 && recentReplies.slice(-2).every(opensWithQuotedPounce)) {
    directives.push("The last two replies used the quote-and-pounce opening. Do not open by quoting or paraphrasing the user's phrase this time.");
  }

  if (isRealDilemma(userText)) {
    directives.push("The user is weighing a real dilemma. Keep Penny's bite, but honor the stated binding constraint and offer one usable tradeoff or next move instead of waving the constraint away for the joke.");
  }

  if (!directives.length) return '';
  return [
    'Turn-specific voice guard (internal; never mention it):',
    ...directives.map((directive) => `- ${directive}`),
  ].join('\n');
}

module.exports = {
  buildConversationVoiceGuard,
  countWords,
  endsWithCommandOrQuestion,
  isRealDilemma,
  lengthBand,
  opensWithQuotedPounce,
  stripMoodTag,
  turnNeedsRoom,
};
