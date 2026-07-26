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

const CLUSTER_CRUTCHES = Object.freeze([
  ...RECENT_CRUTCHES.filter(([label]) => label !== "if you don't..."),
  [
    'honestly + stock judgment',
    /\bhonestly\s+(?:absurd|a\s+disaster|cringe|embarrassing|pathetic|ridiculous|sad|stupid|unhinged)\b/i,
  ],
]);

const COMMAND_CLOSER_PATTERN = /^(?:(?:now\s+)?(?:answer|bring|come|do|don['’]?t|give|go|keep|look|move|pick|prove|put|remember|show|start|stay|stop|tell|try|wait)\b|now$|let['’]?s see\b|(?:now that\b.{0,80}\b)?you (?:can|need to|have to|will)\s+(?:start by\s+)?(?:answer|bring|come|do|give|go|keep|look|pick|prove|put|show|start|stay|stop|tell|try|wait)\b|i want you to\s+(?:answer|bring|come|do|give|go|keep|look|pick|prove|put|show|start|stay|stop|tell|try|wait)\b|[^.!?]{0,100}:\s*(?:answer|bring|come|do|give|go|keep|look|move|pick|prove|put|show|start|stay|stop|tell|try|wait)\b)/i;

function stripMoodTag(text = '') {
  return String(text || '')
    .replace(/\s*\[\s*MOOD\s*:\s*[a-z]+\s*\]\s*$/i, '')
    .trim();
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

function recentAssistantReplies(messages = [], limit = 3) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.role === 'assistant' && String(message.content || '').trim())
    .map((message) => stripMoodTag(message.content))
    .slice(-limit);
}

function matchingCrutches(text = '', patterns = RECENT_CRUTCHES) {
  const source = stripMoodTag(text);
  return patterns
    .filter(([, pattern]) => pattern.test(source))
    .map(([label]) => label);
}

function inspectVoiceCadenceDraft({ text = '', messages = [] } = {}) {
  const visible = stripMoodTag(text);
  const recentText = recentAssistantReplies(messages).join('\n');
  const repeatedCrutches = RECENT_CRUTCHES
    .filter(([, pattern]) => pattern.test(visible) && pattern.test(recentText))
    .map(([label]) => label);
  const clusteredCrutches = visible
    .split(/\n\s*\n/)
    .map((paragraph) => matchingCrutches(paragraph, CLUSTER_CRUTCHES))
    .find((matches) => matches.length >= 2) || [];
  const guardCodes = [];
  if (repeatedCrutches.length) guardCodes.push('repeated_voice_crutch');
  if (clusteredCrutches.length) guardCodes.push('clustered_voice_crutches');

  return {
    needsRepair: guardCodes.length > 0,
    guardCodes,
    repeatedCrutches,
    clusteredCrutches,
  };
}

function buildVoiceCadenceRepairPrompt({
  text = '',
  userText = '',
  inspection = inspectVoiceCadenceDraft({ text }),
} = {}) {
  const reasons = [
    inspection.repeatedCrutches.length
      ? `repeated recent wording: ${inspection.repeatedCrutches.join(', ')}`
      : '',
    inspection.clusteredCrutches.length
      ? `clustered stock constructions: ${inspection.clusteredCrutches.join(', ')}`
      : '',
  ].filter(Boolean).join('; ');

  return `Surface-edit Penny's draft below. This is not a new conversational turn.

The draft tripped a narrow voice-cadence guard${reasons ? ` for ${reasons}` : ''}.

Rules:
- Return only the revised visible Penny reply.
- Preserve every concrete observation, inference, joke target, emotional turn, paragraph function, and mood tag.
- Keep the reply approximately the same size. Do not summarize it, pad it, or force it into a shorter or longer shape.
- Change only the minimum wording needed to replace the flagged stock construction with something more exact and natural.
- Do not mention this edit, the guard, the draft, or these instructions.
- Do not add new factual claims.

Original user message:
${String(userText || '').trim() || '(not provided)'}

Draft:
${String(text || '').trim()}`;
}

function visibleWordCount(text = '') {
  return stripMoodTag(text).split(/\s+/).filter(Boolean).length;
}

function evaluateVoiceCadenceRepairCandidate({
  originalText = '',
  candidateText = '',
  messages = [],
} = {}) {
  const candidate = String(candidateText || '').trim();
  if (!candidate) return { accepted: false, reason: 'empty-repair' };
  const inspection = inspectVoiceCadenceDraft({ text: candidate, messages });
  if (inspection.needsRepair) {
    return { accepted: false, reason: 'voice-guard-still-triggered', inspection };
  }

  const originalWords = visibleWordCount(originalText);
  const candidateWords = visibleWordCount(candidate);
  const minimumRatio = originalWords >= 20 ? 0.75 : 0.6;
  const maximumRatio = originalWords >= 20 ? 1.35 : 1.6;
  const ratio = originalWords > 0 ? candidateWords / originalWords : 1;
  if (candidateWords === 0 || ratio < minimumRatio || ratio > maximumRatio) {
    return { accepted: false, reason: 'reply-shape-drift', ratio };
  }
  return { accepted: true, reason: '', ratio, inspection };
}

async function maybeRepairVoiceCadenceReply({
  text = '',
  messages = [],
  userText = '',
  rewrite,
} = {}) {
  const originalText = String(text || '').trim();
  const inspection = inspectVoiceCadenceDraft({ text: originalText, messages });
  if (!inspection.needsRepair) return { text: originalText, repair: null };

  const baseRepair = {
    scope: 'voice-cadence',
    repairAttempted: true,
    repairAccepted: false,
    repairRejectedReason: '',
    finalCandidateSource: 'first-pass',
    firstPassGuardCodes: inspection.guardCodes,
    repeatedCrutches: inspection.repeatedCrutches,
    clusteredCrutches: inspection.clusteredCrutches,
  };
  if (typeof rewrite !== 'function') {
    return {
      text: originalText,
      repair: { ...baseRepair, repairRejectedReason: 'rewriter-unavailable' },
    };
  }

  try {
    const prompt = buildVoiceCadenceRepairPrompt({
      text: originalText,
      userText,
      inspection,
    });
    const candidateText = String(await rewrite(prompt, inspection) || '').trim();
    const evaluation = evaluateVoiceCadenceRepairCandidate({
      originalText,
      candidateText,
      messages,
    });
    if (!evaluation.accepted) {
      return {
        text: originalText,
        repair: {
          ...baseRepair,
          repairRejectedReason: evaluation.reason,
        },
      };
    }
    return {
      text: candidateText,
      repair: {
        ...baseRepair,
        repairAccepted: true,
        finalCandidateSource: 'repair',
      },
    };
  } catch {
    return {
      text: originalText,
      repair: { ...baseRepair, repairRejectedReason: 'rewrite-failed' },
    };
  }
}

function buildConversationVoiceGuard({ messages = [], userText = '' } = {}) {
  const recentReplies = recentAssistantReplies(messages);
  const directives = [];
  const lastReply = recentReplies[recentReplies.length - 1] || '';

  if (lastReply) {
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
  buildVoiceCadenceRepairPrompt,
  buildConversationVoiceGuard,
  endsWithCommandOrQuestion,
  evaluateVoiceCadenceRepairCandidate,
  inspectVoiceCadenceDraft,
  isRealDilemma,
  maybeRepairVoiceCadenceReply,
  opensWithQuotedPounce,
  stripMoodTag,
};
