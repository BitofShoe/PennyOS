const WRITE_TOOL_NAMES = new Set([
  'write_project_file',
  'replace_in_project_file',
  'insert_in_project_file',
]);

const PROJECT_PATH_EXTENSIONS = 'js|cjs|mjs|json|md|txt|html|css|svg|ps1|log';
const QUOTED_PROJECT_PATH_PATTERNS = [
  new RegExp("`([^`\\n]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))`", 'i'),
  new RegExp("\"([^\"\\n]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))\"", 'i'),
  new RegExp("'([^'\\n]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))'", 'i'),
];
const RELAXED_UNQUOTED_PROJECT_PATH_PATTERN = new RegExp(
  "(?:^|[\\s`\"(])((?!(?:open|read|inspect|check|show|search|find|look|inside|into|in|from|tell|please|add|append|write|rewrite|update|change)\\b)(?:[a-z0-9_.'()\\-]+(?: [a-z0-9_.'()\\-]+)*[\\\\/])+[a-z0-9_.'()\\-]+(?: [a-z0-9_.'()\\-]+)*\\.(?:"
    + PROJECT_PATH_EXTENSIONS + "))(?=$|[\\s`\")?!,:;.])",
  'i',
);
const UNQUOTED_PROJECT_PATH_PATTERN = new RegExp(
  "(?:^|[\\s`\"'(])([a-z0-9_./\\\\-]+\\.(?:" + PROJECT_PATH_EXTENSIONS + "))(?=$|[\\s`\"')?!,:;.])",
  'i',
);

function extractExplicitProjectPath(text = '') {
  const raw = String(text || '');
  for (const pattern of QUOTED_PROJECT_PATH_PATTERNS) {
    const match = raw.match(pattern);
    const candidate = String(match?.[1] || '').trim();
    if (candidate) return candidate;
  }
  const relaxedMatch = raw.match(RELAXED_UNQUOTED_PROJECT_PATH_PATTERN);
  if (relaxedMatch?.[1]) return relaxedMatch[1].trim().replace(/\\/g, '/');
  const match = raw.match(UNQUOTED_PROJECT_PATH_PATTERN);
  return match ? match[1].trim().replace(/\\/g, '/') : '';
}

function cleanProjectFolderCandidate(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+\b(folder|directory)\b$/i, '')
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
    .replace(/[\\]+/g, '/')
    .replace(/^\.?\//, '')
    .trim();
}

function isLikelyProjectFolderPath(value = '') {
  const candidate = cleanProjectFolderCandidate(value);
  const lower = candidate.toLowerCase();
  if (!candidate) return false;
  if (extractExplicitProjectPath(candidate)) return false;
  if ([
    'repo',
    'the repo',
    'repository',
    'the repository',
    'project',
    'the project',
    'folder',
    'the folder',
    'directory',
    'the directory',
    'here',
    'there',
  ].includes(lower)) {
    return false;
  }
  return /[\\/]/.test(candidate)
    || /\b(playground|docs?|memory|lib|public|scripts|data|tmp|output|test|tests)\b/i.test(candidate);
}

function extractExplicitProjectFolder(text = '') {
  const raw = String(text || '');
  const patterns = [
    /\binside\s+`([^`\n]+)`(?=\s*,?\s+(?:create|make|write|add|append|put)\b)/i,
    /\binside\s+"([^"\n]+)"(?=\s*,?\s+(?:create|make|write|add|append|put)\b)/i,
    /\binside\s+'([^'\n]+)'(?=\s*,?\s+(?:create|make|write|add|append|put)\b)/i,
    /\binside\s+([^,\n]+?)(?=\s*,?\s+(?:create|make|write|add|append|put)\b)/i,
    /\bin\s+([^,\n]+?)\s+(?:folder|directory)\b(?=\s*,?\s+(?:create|make|write|add|append|put)\b|\s*$)/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const candidate = cleanProjectFolderCandidate(match?.[1] || '');
    if (isLikelyProjectFolderPath(candidate)) {
      return normalizeProjectLikePath(candidate);
    }
  }
  return '';
}

function inferRequestedNewFileExtension(text = '') {
  const lower = String(text || '').toLowerCase();
  if (/\bmarkdown\b|\b\.md\b|\bmd file\b/.test(lower)) return 'md';
  if (/\bjson\b|\b\.json\b/.test(lower)) return 'json';
  if (/\bhtml\b|\b\.html\b/.test(lower)) return 'html';
  if (/\bcss\b|\b\.css\b/.test(lower)) return 'css';
  if (/\bsvg\b|\b\.svg\b/.test(lower)) return 'svg';
  if (/\b(?:text|txt)\b|\b\.txt\b/.test(lower)) return 'txt';
  return 'md';
}

function analyzeWorkspaceWriteIntent(userText = '', toolRecords = []) {
  const raw = String(userText || '');
  const lower = raw.toLowerCase();
  if (/\b(do not edit|don't edit|dont edit|without editing|do not change|don't change|dont change)\b/i.test(lower)) {
    return {
      required: false,
      targetType: 'none',
      exactPath: '',
      folderPath: '',
      preferredExtension: '',
      examplePath: '',
    };
  }
  const editVerb = /\b(add|append|insert|write|rewrite|edit|update|change|replace|remove|delete|rename|modify|create)\b/i.test(lower);
  if (!editVerb) {
    return {
      required: false,
      targetType: 'none',
      exactPath: '',
      folderPath: '',
      preferredExtension: '',
      examplePath: '',
    };
  }

  const explicitPath = normalizeProjectLikePath(extractExplicitProjectPath(raw) || lastToolPath(toolRecords));
  if (explicitPath && /\b(file|line|lines|content|contents|text|path|into|inside|in)\b/i.test(lower)) {
    return {
      required: true,
      targetType: 'file',
      exactPath: explicitPath,
      folderPath: '',
      preferredExtension: '',
      examplePath: explicitPath,
    };
  }

  const folderPath = extractExplicitProjectFolder(raw);
  const wantsNewFile = /\b(create|make|write)\b/i.test(lower)
    && /\b(?:new|one)\b[\s\S]{0,40}\b(?:markdown|md|text|txt|json|html|css|svg)?\s*file\b/i.test(lower);
  if (folderPath && wantsNewFile) {
    const preferredExtension = inferRequestedNewFileExtension(raw);
    const exampleBase = preferredExtension === 'md' ? 'whispers' : 'penny-note';
    return {
      required: true,
      targetType: 'new-file-in-folder',
      exactPath: '',
      folderPath,
      preferredExtension,
      examplePath: normalizeProjectLikePath(`${folderPath}/${exampleBase}.${preferredExtension}`),
    };
  }

  return {
    required: false,
    targetType: 'none',
    exactPath: '',
    folderPath: '',
    preferredExtension: '',
    examplePath: '',
  };
}

function requiresConfirmedWorkspaceWrite(userText = '', toolRecords = []) {
  return analyzeWorkspaceWriteIntent(userText, toolRecords).required === true;
}

function isPathInsideRequestedFolder(candidatePath = '', folderPath = '') {
  const candidate = normalizeProjectLikePath(candidatePath);
  const folder = normalizeProjectLikePath(folderPath);
  if (!candidate || !folder) return false;
  const candidateLower = candidate.toLowerCase();
  const folderLower = folder.toLowerCase();
  return candidateLower.startsWith(`${folderLower}/`) && candidateLower !== folderLower;
}

function buildMissingWorkspaceWriteError() {
  const error = new Error('Tool loop required a confirmed workspace write before final reply.');
  error.code = 'tool_loop_missing_workspace_write';
  return error;
}

function lastToolPath(toolRecords = []) {
  const records = Array.isArray(toolRecords) ? [...toolRecords].reverse() : [];
  for (const record of records) {
    const pathValue = String(record?.result?.data?.path || record?.args?.path || '').trim();
    if (pathValue) return pathValue;
  }
  return '';
}

function trimToolDebugText(value = '', limit = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function createToolDebugState(seed = null) {
  const base = seed && typeof seed === 'object' ? seed : {};
  const manualFallback = base.manualFallback && typeof base.manualFallback === 'object' ? base.manualFallback : {};
  const writeRescue = base.writeRescue && typeof base.writeRescue === 'object' ? base.writeRescue : {};
  return {
    manualFallback: {
      used: manualFallback.used === true,
      reasonCode: String(manualFallback.reasonCode || '').trim(),
      reason: trimToolDebugText(manualFallback.reason || '', 180),
      lastPlannerStatus: String(manualFallback.lastPlannerStatus || '').trim(),
      lastDecisionKind: String(manualFallback.lastDecisionKind || '').trim(),
      lastDecisionTool: String(manualFallback.lastDecisionTool || '').trim(),
      lastDecisionError: trimToolDebugText(manualFallback.lastDecisionError || '', 180),
      lastAssistantText: trimToolDebugText(manualFallback.lastAssistantText || '', 240),
      invalidReplyCount: Number.isFinite(Number(manualFallback.invalidReplyCount)) ? Math.max(0, Math.round(Number(manualFallback.invalidReplyCount))) : 0,
      emptyReplyCount: Number.isFinite(Number(manualFallback.emptyReplyCount)) ? Math.max(0, Math.round(Number(manualFallback.emptyReplyCount))) : 0,
    },
    writeRescue: {
      attempted: writeRescue.attempted === true,
      phase: String(writeRescue.phase || '').trim(),
      status: String(writeRescue.status || '').trim(),
      responseStatusCode: Number.isFinite(Number(writeRescue.responseStatusCode)) ? Math.round(Number(writeRescue.responseStatusCode)) : 0,
      decisionKind: String(writeRescue.decisionKind || '').trim(),
      tool: String(writeRescue.tool || '').trim(),
      argsPath: normalizeProjectLikePath(writeRescue.argsPath || ''),
      parseError: trimToolDebugText(writeRescue.parseError || '', 180),
      assistantText: trimToolDebugText(writeRescue.assistantText || '', 240),
      responseBody: trimToolDebugText(writeRescue.responseBody || '', 240),
    },
  };
}

function toolDebugHasSignal(debug = null) {
  const state = debug && typeof debug === 'object' ? debug : {};
  const manualFallback = state.manualFallback && typeof state.manualFallback === 'object' ? state.manualFallback : {};
  const writeRescue = state.writeRescue && typeof state.writeRescue === 'object' ? state.writeRescue : {};
  return manualFallback.used === true
    || Number(manualFallback.invalidReplyCount || 0) > 0
    || Number(manualFallback.emptyReplyCount || 0) > 0
    || !!String(manualFallback.lastPlannerStatus || '').trim()
    || writeRescue.attempted === true
    || !!String(writeRescue.status || '').trim();
}

function updateWriteRescueDebug(debugState = null, patch = {}) {
  if (!debugState || typeof debugState !== 'object') return;
  const state = createToolDebugState(debugState);
  debugState.manualFallback = state.manualFallback;
  debugState.writeRescue = {
    ...state.writeRescue,
    ...patch,
  };
}

function updateManualFallbackDebug(debugState = null, patch = {}) {
  if (!debugState || typeof debugState !== 'object') return;
  const state = createToolDebugState(debugState);
  debugState.writeRescue = state.writeRescue;
  debugState.manualFallback = {
    ...state.manualFallback,
    ...patch,
  };
}

function buildToolOutcome({ userText = '', editedPaths = new Set(), failureReason = '', debug = null } = {}) {
  const writeIntentRequired = requiresConfirmedWorkspaceWrite(userText);
  const confirmedWriteCount = editedPaths instanceof Set ? editedPaths.size : 0;
  const writeIntentSatisfied = !writeIntentRequired || confirmedWriteCount > 0;
  const debugState = createToolDebugState(debug);
  return {
    writeIntentRequired,
    writeIntentSatisfied,
    confirmedWriteCount,
    failureReason: writeIntentSatisfied ? '' : String(failureReason || 'write-required-unmet').trim(),
    debug: toolDebugHasSignal(debugState) ? debugState : null,
  };
}

function buildWriteRequiredFailureText({ userText = '', toolRecords = [] } = {}) {
  const writeIntent = analyzeWorkspaceWriteIntent(userText, toolRecords);
  const pathLabel = writeIntent.targetType === 'new-file-in-folder'
    ? `a new file inside ${writeIntent.folderPath || 'that folder'}`
    : writeIntent.exactPath || extractExplicitProjectPath(userText) || lastToolPath(toolRecords) || 'that file';
  return `i inspected ${pathLabel}, but i did not complete a verified edit, so i'm not going to pretend i did. no write landed, no fake victory lap.\n[MOOD:annoyed]`;
}

function cleanOpenEndedWriteDraft(text = '') {
  let cleaned = String(text || '').trim();
  cleaned = cleaned.replace(/^```[a-z0-9_-]*\r?\n?/i, '').replace(/\r?\n?```$/i, '').trim();
  cleaned = cleaned.replace(/\s*\[MOOD:\w+\]\s*$/gi, '').trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"'))
    || (cleaned.startsWith("'") && cleaned.endsWith("'"))
    || (cleaned.startsWith('`') && cleaned.endsWith('`'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/\r\n/g, '\n');
  const stripLeadingScaffolding = (value = '') => {
    let next = String(value || '').trim();
    for (let pass = 0; pass < 3; pass += 1) {
      const prior = next;
      next = next
        .replace(/^(?:markdown|md)\s*[:.-]\s*/i, '')
        .replace(/^(?:what i can do is provide(?: the)? exact prose you want to add|what i can do is give you(?: the)? exact prose you want to add|here(?:'s| is) the exact prose you want to add|the exact prose you want to add)\s*:\s*/i, '')
        .replace(/^(?:i can add|i can write|i can provide)\s+(?:the\s+)?(?:exact\s+)?(?:prose|text|paragraph)\s*(?:you (?:want|asked for))?\s*:\s*/i, '')
        .trim();
      if (next === prior) break;
    }
    return next;
  };
  cleaned = stripLeadingScaffolding(cleaned);
  const stripMetaSentences = (value = '') => {
    const sentences = String(value || '').match(/[^.!?]+[.!?]?/g) || [];
    const filtered = sentences
      .map((sentence) => String(sentence || '').trim())
      .filter(Boolean)
      .filter((sentence) => !/\b(?:i cannot|i can't|i won't|i didn't|can't actually|cannot actually|you(?:'ll| will) have to|copy-?paste|paste it yourself|raw and ready to paste|didn't change anything|can't access your files|cannot access your files|cannot open or edit files|can't open or edit files)\b/i.test(sentence))
      .filter((sentence) => !/\b(?:what i can do is provide|what i can do is give you|here(?:'s| is) the exact prose|the exact prose you want to add)\b/i.test(sentence))
      .filter((sentence) => !/\b(?:i added|i wrote|i appended|i updated)\b[\s\S]{0,120}\b(?:file|penny's playground|\.md|\.txt|\.json|tone)\b/i.test(sentence));
    return stripLeadingScaffolding(filtered.length ? filtered.join(' ').trim() : String(value || '').trim());
  };
  const hasRefusalScaffolding = /\b(?:i cannot|i can't|i won't|i didn't|can't actually|cannot actually)\b[\s\S]{0,160}\b(?:edit|write|change|append|access|reach)\b[\s\S]{0,120}\b(?:file|filesystem|disk)\b/i.test(cleaned)
    || /\b(?:you(?:'ll| will) have to|copy-?paste|paste it yourself|raw and ready to paste)\b/i.test(cleaned);
  if (!hasRefusalScaffolding) return stripMetaSentences(cleaned);

  const cueMatch = cleaned.match(/(?:here is(?: the)? text(?: you wanted)?(?:, raw and ready to paste)?\s*:|use this text\s*:|write this\s*:|text to add\s*:)\s*([\s\S]+)/i);
  let candidate = cueMatch?.[1] ? String(cueMatch[1]).trim() : cleaned;
  candidate = candidate
    .replace(/^\s*>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripMetaSentences(candidate);
}

function looksLikeMetaWriteDraft(text = '') {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!cleaned) return true;
  return /\b(?:tell me|let me know|confirm)\b.{0,80}\b(?:current state|current contents|what(?:'s| is) in the file|want me to|proceed)\b/.test(cleaned)
    || /\b(?:current state|current contents|what(?:'s| is) in the file|confirm you want me to)\b/.test(cleaned)
    || /\b(?:copy-?paste|paste it yourself|do the work yourself|to apply this|append the above block|updated file content|verify the change afterward)\b/.test(cleaned)
    || /^(?:markdown|md)\s*[:.-]\s*/.test(cleaned)
    || /\b(?:what i can do is provide|what i can do is give you|here(?:'s| is) the exact prose|the exact prose you want to add)\b/.test(cleaned)
    || /\b(?:can't|cannot|won't|don't)\b.{0,60}\b(?:edit|write|append|access|reach)\b/.test(cleaned);
}

function parseCountWord(token = '') {
  const lower = String(token || '').trim().toLowerCase();
  const map = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  if (map[lower]) return map[lower];
  const numeric = Number.parseInt(lower, 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function countDraftSentences(text = '') {
  return (String(text || '').match(/[^.!?]+[.!?]+/g) || []).length;
}

function countDraftParagraphs(text = '') {
  const paragraphs = String(text || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  return paragraphs.length || (String(text || '').trim() ? 1 : 0);
}

function extractDraftShapeRequirements(userText = '') {
  const lower = String(userText || '').toLowerCase();
  const requirements = {
    sentenceMin: 0,
    sentenceMax: 0,
    paragraphMin: 0,
    paragraphMax: 0,
  };
  const sentenceRange = lower.match(/\b([a-z0-9]+)\s*-\s*([a-z0-9]+)\s+sentences?\b/);
  if (sentenceRange) {
    requirements.sentenceMin = parseCountWord(sentenceRange[1]);
    requirements.sentenceMax = parseCountWord(sentenceRange[2]);
  } else {
    const exactSentences = lower.match(/\bexactly\s+([a-z0-9]+)\s+sentences?\b/);
    if (exactSentences) {
      const count = parseCountWord(exactSentences[1]);
      requirements.sentenceMin = count;
      requirements.sentenceMax = count;
    } else if (/\bone sentence only\b/.test(lower)) {
      requirements.sentenceMin = 1;
      requirements.sentenceMax = 1;
    }
  }
  if (/\bexactly one paragraph\b|\bone short paragraph\b|\bone paragraph\b/.test(lower)) {
    requirements.paragraphMin = 1;
    requirements.paragraphMax = 1;
  }
  return requirements;
}

function analyzeDraftShape(text = '', userText = '') {
  const requirements = extractDraftShapeRequirements(userText);
  const sentenceCount = countDraftSentences(text);
  const paragraphCount = countDraftParagraphs(text);
  if (requirements.sentenceMin && sentenceCount < requirements.sentenceMin) {
    return { ok: false, reason: 'sentence-underflow', sentenceCount, paragraphCount, requirements };
  }
  if (requirements.sentenceMax && sentenceCount > requirements.sentenceMax) {
    return { ok: false, reason: 'sentence-overflow', sentenceCount, paragraphCount, requirements };
  }
  if (requirements.paragraphMin && paragraphCount < requirements.paragraphMin) {
    return { ok: false, reason: 'paragraph-underflow', sentenceCount, paragraphCount, requirements };
  }
  if (requirements.paragraphMax && paragraphCount > requirements.paragraphMax) {
    return { ok: false, reason: 'paragraph-overflow', sentenceCount, paragraphCount, requirements };
  }
  return { ok: true, reason: '', sentenceCount, paragraphCount, requirements };
}

function describeDraftShapeRequirement(analysis = {}) {
  const requirements = analysis?.requirements && typeof analysis.requirements === 'object'
    ? analysis.requirements
    : {};
  const parts = [];
  if (requirements.sentenceMin && requirements.sentenceMax) {
    if (requirements.sentenceMin === requirements.sentenceMax) {
      parts.push(`exactly ${requirements.sentenceMin} sentence${requirements.sentenceMin === 1 ? '' : 's'}`);
    } else {
      parts.push(`${requirements.sentenceMin}-${requirements.sentenceMax} sentences`);
    }
  }
  if (requirements.paragraphMin && requirements.paragraphMax) {
    if (requirements.paragraphMin === requirements.paragraphMax) {
      parts.push(`exactly ${requirements.paragraphMin} paragraph${requirements.paragraphMin === 1 ? '' : 's'}`);
    } else {
      parts.push(`${requirements.paragraphMin}-${requirements.paragraphMax} paragraphs`);
    }
  }
  return parts.join(' and ');
}

function buildWriteRequiredGuidance({ userText = '', toolRecords = [], plannerMode = false } = {}) {
  const writeIntent = analyzeWorkspaceWriteIntent(userText, toolRecords);
  const pathLabel = writeIntent.exactPath || 'target-file.txt';
  const quotedPath = JSON.stringify(pathLabel);
  const insertExample = plannerMode
    ? `{"kind":"tool","tool":"insert_in_project_file","args":{"path":${quotedPath},"text":"your new line","position":"end","lineAware":true}}`
    : `{"name":"insert_in_project_file","arguments":{"path":${quotedPath},"text":"your new line","position":"end","lineAware":true}}`;
  const replaceExample = plannerMode
    ? `{"kind":"tool","tool":"replace_in_project_file","args":{"path":${quotedPath},"find":"old text","replace":"new text"}}`
    : `{"name":"replace_in_project_file","arguments":{"path":${quotedPath},"find":"old text","replace":"new text"}}`;
  const writeExample = plannerMode
    ? `{"kind":"tool","tool":"write_project_file","args":{"path":${JSON.stringify(writeIntent.examplePath || pathLabel)},"content":"full file contents"}}`
    : `{"name":"write_project_file","arguments":{"path":${JSON.stringify(writeIntent.examplePath || pathLabel)},"content":"full file contents"}}`;
  if (writeIntent.targetType === 'new-file-in-folder') {
    return [
      'This request explicitly requires a real workspace write before any final reply.',
      `Target folder: ${writeIntent.folderPath || 'target-folder'}`,
      `Choose one concrete repo-relative filename inside that folder and use ${writeExample}`,
      `The created file should end with .${writeIntent.preferredExtension || 'md'}.`,
      'Do not stop at listing or reading the folder.',
      plannerMode
        ? 'Do not return kind "final" until one write tool succeeds.'
        : 'Do not answer with plain final text until one write tool succeeds.',
    ].join('\n');
  }
  return [
    'This request explicitly requires a real workspace write before any final reply.',
    `Target path: ${pathLabel}`,
    `If the user wants a short appended line, use ${insertExample}`,
    `If the user wants an exact substitution, use ${replaceExample}`,
    `If the user truly asked for a full rewrite, use ${writeExample}`,
    'Do not stop at read_project_file.',
    plannerMode
      ? 'Do not return kind "final" until one write tool succeeds.'
      : 'Do not answer with plain final text until one write tool succeeds.',
  ].join('\n');
}

function buildWriteExampleSnippet({ userText = '', toolRecords = [], plannerMode = false } = {}) {
  const guidance = buildWriteRequiredGuidance({ userText, toolRecords, plannerMode });
  const lines = guidance.split('\n');
  if (lines[2]) {
    return lines[2]
      .replace(/^If the user wants a short appended line, use /, '')
      .replace(/^Choose one concrete repo-relative filename inside that folder and use /, '')
      .trim();
  }
  return '';
}

function normalizeProjectLikePath(value = '') {
  return String(value || '').trim().replace(/\\/g, '/');
}

function buildWriteRescueContext(toolRecords = []) {
  const recent = Array.isArray(toolRecords) ? toolRecords.slice(-3) : [];
  if (!recent.length) return 'No verified tool results yet.';
  return recent.map((record) => {
    const name = String(record?.name || 'unknown_tool').trim() || 'unknown_tool';
    const data = record?.result?.data;
    const summary = typeof data === 'string'
      ? data
      : JSON.stringify(data || {});
    return `- ${name}: ${String(summary || '').slice(0, 700)}`;
  }).join('\n');
}

function buildQueuedToolEvidenceFact({
  path = '',
  promptVisibility = '',
  nonPromptUse = '',
  renderForm = '',
  modelHop = '',
  toolRecordIndex = -1,
} = {}) {
  if (!Number.isInteger(toolRecordIndex) || toolRecordIndex < 0) return null;
  return {
    path: String(path || '').trim(),
    promptVisibility: String(promptVisibility || '').trim(),
    nonPromptUse: String(nonPromptUse || '').trim(),
    renderForm: String(renderForm || '').trim(),
    modelHop: String(modelHop || '').trim(),
    toolRecordIndexes: [toolRecordIndex],
  };
}

function queuePromptVisibleToolEvidenceFact(
  pendingToolEvidenceFacts = null,
  shape = {},
  toolRecordIndex = -1,
) {
  if (!Array.isArray(pendingToolEvidenceFacts)) return;
  const fact = buildQueuedToolEvidenceFact({
    ...shape,
    toolRecordIndex,
  });
  if (fact) pendingToolEvidenceFacts.push(fact);
}

function flushPendingToolEvidenceFacts(
  toolEvidenceFacts = null,
  pendingToolEvidenceFacts = null,
) {
  if (!Array.isArray(toolEvidenceFacts) || !Array.isArray(pendingToolEvidenceFacts) || !pendingToolEvidenceFacts.length) {
    return;
  }
  toolEvidenceFacts.push(...pendingToolEvidenceFacts);
  pendingToolEvidenceFacts.length = 0;
}

function createLmStudioToolLoopApi({
  withLmStudioLaneModel,
  postJsonLongRunning,
  executePennyTool,
  parseToolArguments,
  sanitizeToolMessages,
  clearLmStudioThread,
  bindAbortSignal,
  textFromChatMessage,
  buildLmStudioToolSystemPrompt,
  PENNY_TOOL_DEFINITIONS,
  composeToolRecordFallback,
  LMSTUDIO_BASE,
  LMSTUDIO_API_KEY,
  LMSTUDIO_TIMEOUT_MS,
  LMSTUDIO_TOOL_TEMPERATURE,
  LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS,
  LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS,
  LMSTUDIO_TOOL_SUMMARY_TEMPERATURE,
  LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS,
  MAX_TOOL_STEPS,
  TOOL_DIRECT_HISTORY_LIMIT,
} = {}) {
  if (typeof withLmStudioLaneModel !== 'function') throw new TypeError('createLmStudioToolLoopApi requires withLmStudioLaneModel');
  if (typeof postJsonLongRunning !== 'function') throw new TypeError('createLmStudioToolLoopApi requires postJsonLongRunning');
  if (typeof executePennyTool !== 'function') throw new TypeError('createLmStudioToolLoopApi requires executePennyTool');
  if (typeof parseToolArguments !== 'function') throw new TypeError('createLmStudioToolLoopApi requires parseToolArguments');
  if (typeof sanitizeToolMessages !== 'function') throw new TypeError('createLmStudioToolLoopApi requires sanitizeToolMessages');
  if (typeof clearLmStudioThread !== 'function') throw new TypeError('createLmStudioToolLoopApi requires clearLmStudioThread');
  if (typeof bindAbortSignal !== 'function') throw new TypeError('createLmStudioToolLoopApi requires bindAbortSignal');
  if (typeof textFromChatMessage !== 'function') throw new TypeError('createLmStudioToolLoopApi requires textFromChatMessage');
  if (typeof buildLmStudioToolSystemPrompt !== 'function') throw new TypeError('createLmStudioToolLoopApi requires buildLmStudioToolSystemPrompt');
  if (!Array.isArray(PENNY_TOOL_DEFINITIONS)) throw new TypeError('createLmStudioToolLoopApi requires PENNY_TOOL_DEFINITIONS');
  if (typeof composeToolRecordFallback !== 'function') throw new TypeError('createLmStudioToolLoopApi requires composeToolRecordFallback');

  async function attemptWriteRequiredRescue({
    model,
    controller,
    userText,
    toolsUsed,
    toolRecords,
    toolEvidenceFacts = [],
    editedPaths,
    autoCheckedSyntaxPaths,
    autoCheckedGitStatusRef,
    onToolEvent,
    debugState = null,
    phase = 'native',
  }) {
    const writeIntent = analyzeWorkspaceWriteIntent(userText, toolRecords);
    if (!writeIntent.required) return null;
    const exactPath = writeIntent.exactPath;
    const folderPath = writeIntent.folderPath;
    const pathLabel = exactPath || folderPath;
    if (!pathLabel) return null;
    updateWriteRescueDebug(debugState, {
      attempted: true,
      phase,
      status: 'started',
      argsPath: pathLabel,
    });
    onToolEvent?.({ type: 'status', stage: 'write-rescue', label: 'rescuing the edit step' });
    const rescuePayload = {
      model,
      messages: [
        {
          role: 'system',
          content: [
            'Write rescue mode:',
            'The tool loop inspected the file but stalled before issuing a real write tool.',
            'You must answer with exactly one JSON object and no markdown.',
            'Schema: {"tool":"insert_in_project_file","args":{"path":"file","text":"new text","position":"end","lineAware":true}}',
            `Allowed tools: ${[...WRITE_TOOL_NAMES].join(', ')}`,
            buildWriteRequiredGuidance({ userText, toolRecords, plannerMode: true }),
            'Do not choose any read tool. Do not explain yourself. Output one write tool call only.',
          ].join('\n'),
        },
        {
          role: 'system',
          content: `Verified tool context:\n${buildWriteRescueContext(toolRecords)}`,
        },
        {
          role: 'user',
          content: String(userText || '').trim(),
        },
      ],
      temperature: LMSTUDIO_TOOL_TEMPERATURE,
      max_tokens: LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS,
      stream: false,
    };
    const rescueResponse = await postJsonLongRunning(`${LMSTUDIO_BASE}/chat/completions`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
      },
      body: JSON.stringify(rescuePayload),
      signal: controller.signal,
    });
    if (rescueResponse.statusCode < 200 || rescueResponse.statusCode >= 300) {
      updateWriteRescueDebug(debugState, {
        status: 'http-error',
        responseStatusCode: rescueResponse.statusCode,
        responseBody: rescueResponse.bodyText,
      });
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(rescueResponse.bodyText);
    } catch {
      updateWriteRescueDebug(debugState, {
        status: 'response-invalid-json',
        responseStatusCode: rescueResponse.statusCode,
        responseBody: rescueResponse.bodyText,
      });
      return null;
    }
    const assistantText = textFromChatMessage(parsed?.choices?.[0]?.message || {});
    if (!assistantText) {
      updateWriteRescueDebug(debugState, {
        status: 'empty-assistant-text',
        responseStatusCode: rescueResponse.statusCode,
      });
      return null;
    }
    const rescueDecision = parsePlannerDecision(assistantText);
    if (!rescueDecision.ok) {
      updateWriteRescueDebug(debugState, {
        status: 'planner-invalid',
        responseStatusCode: rescueResponse.statusCode,
        assistantText,
        parseError: rescueDecision.error,
      });
      return null;
    }
    if (rescueDecision.kind !== 'tool') {
      updateWriteRescueDebug(debugState, {
        status: 'non-tool-decision',
        responseStatusCode: rescueResponse.statusCode,
        assistantText,
        decisionKind: rescueDecision.kind,
      });
      return null;
    }
    const rescueTool = String(rescueDecision.tool || '').trim();
    if (!WRITE_TOOL_NAMES.has(rescueTool)) {
      updateWriteRescueDebug(debugState, {
        status: 'non-write-tool',
        responseStatusCode: rescueResponse.statusCode,
        assistantText,
        decisionKind: rescueDecision.kind,
        tool: rescueTool,
      });
      return null;
    }
    const rescueArgs = rescueDecision.args && typeof rescueDecision.args === 'object'
      ? { ...rescueDecision.args }
      : {};
    if (!normalizeProjectLikePath(rescueArgs.path) && exactPath) {
      rescueArgs.path = exactPath;
    }
    const rescuePath = normalizeProjectLikePath(rescueArgs.path);
    const folderTargetedCreate = writeIntent.targetType === 'new-file-in-folder';
    if (folderTargetedCreate && rescueTool !== 'write_project_file') {
      updateWriteRescueDebug(debugState, {
        status: 'non-create-tool',
        responseStatusCode: rescueResponse.statusCode,
        assistantText,
        decisionKind: rescueDecision.kind,
        tool: rescueTool,
        argsPath: rescueArgs.path,
      });
      return null;
    }
    if (exactPath && rescuePath !== exactPath) {
      updateWriteRescueDebug(debugState, {
        status: 'path-mismatch',
        responseStatusCode: rescueResponse.statusCode,
        assistantText,
        decisionKind: rescueDecision.kind,
        tool: rescueTool,
        argsPath: rescueArgs.path,
      });
      return null;
    }
    if (folderTargetedCreate) {
      if (!rescuePath) {
        updateWriteRescueDebug(debugState, {
          status: 'missing-create-path',
          responseStatusCode: rescueResponse.statusCode,
          assistantText,
          decisionKind: rescueDecision.kind,
          tool: rescueTool,
          argsPath: rescueArgs.path,
        });
        return null;
      }
      if (!isPathInsideRequestedFolder(rescuePath, folderPath)) {
        updateWriteRescueDebug(debugState, {
          status: 'path-outside-folder',
          responseStatusCode: rescueResponse.statusCode,
          assistantText,
          decisionKind: rescueDecision.kind,
          tool: rescueTool,
          argsPath: rescueArgs.path,
        });
        return null;
      }
      const requiredExtension = String(writeIntent.preferredExtension || '').trim().toLowerCase();
      if (requiredExtension && !rescuePath.toLowerCase().endsWith(`.${requiredExtension}`)) {
        updateWriteRescueDebug(debugState, {
          status: 'extension-mismatch',
          responseStatusCode: rescueResponse.statusCode,
          assistantText,
          decisionKind: rescueDecision.kind,
          tool: rescueTool,
          argsPath: rescueArgs.path,
        });
        return null;
      }
    }
    if (rescueTool === 'insert_in_project_file') {
      if (!String(rescueArgs.position || '').trim()) rescueArgs.position = 'end';
      if ((rescueArgs.position === 'start' || rescueArgs.position === 'end') && !Object.prototype.hasOwnProperty.call(rescueArgs, 'lineAware')) {
        rescueArgs.lineAware = true;
      }
      if (!String(rescueArgs.text || '').trim()) {
        updateWriteRescueDebug(debugState, {
          status: 'missing-insert-text',
          responseStatusCode: rescueResponse.statusCode,
          assistantText,
          decisionKind: rescueDecision.kind,
          tool: rescueTool,
          argsPath: rescueArgs.path,
        });
        return null;
      }
    }
    if (rescueTool === 'replace_in_project_file') {
      if (!String(rescueArgs.find || '').trim() || !String(rescueArgs.replace || '').trim()) {
        updateWriteRescueDebug(debugState, {
          status: 'missing-replace-fields',
          responseStatusCode: rescueResponse.statusCode,
          assistantText,
          decisionKind: rescueDecision.kind,
          tool: rescueTool,
          argsPath: rescueArgs.path,
        });
        return null;
      }
    }
    if (rescueTool === 'write_project_file' && !String(rescueArgs.content || '').trim()) {
      updateWriteRescueDebug(debugState, {
        status: 'missing-write-content',
        responseStatusCode: rescueResponse.statusCode,
        assistantText,
        decisionKind: rescueDecision.kind,
        tool: rescueTool,
        argsPath: rescueArgs.path,
      });
      return null;
    }

    onToolEvent?.({ type: 'tool', state: 'running', name: rescueTool, label: `using ${rescueTool}` });
    const rescueResult = await executePennyTool(rescueTool, rescueArgs);
    toolsUsed.push({ name: rescueTool, ok: rescueResult.ok, label: rescueResult.label });
    toolRecords.push({ name: rescueTool, args: rescueArgs, result: rescueResult });
    onToolEvent?.({ type: 'tool', state: 'done', name: rescueTool, label: rescueResult.label, ok: rescueResult.ok });
    if (!rescueResult.ok || !rescueResult.data?.path) {
      updateWriteRescueDebug(debugState, {
        status: 'tool-error',
        responseStatusCode: rescueResponse.statusCode,
        assistantText,
        decisionKind: rescueDecision.kind,
        tool: rescueTool,
        argsPath: rescueArgs.path,
        parseError: rescueResult.label,
      });
      return null;
    }
    updateWriteRescueDebug(debugState, {
      status: 'executed',
      responseStatusCode: rescueResponse.statusCode,
      assistantText,
      decisionKind: rescueDecision.kind,
      tool: rescueTool,
      argsPath: rescueResult.data.path || rescueArgs.path,
      parseError: '',
      responseBody: '',
    });
    editedPaths.add(rescueResult.data.path);

    const pendingChecks = [];
    for (const relPath of editedPaths) {
      if (/\.(?:js|cjs|mjs)$/i.test(relPath) && !autoCheckedSyntaxPaths.has(relPath)) {
        pendingChecks.push({ name: 'run_node_check', args: { path: relPath } });
      }
    }
    if (editedPaths.size && autoCheckedGitStatusRef.value !== true) {
      pendingChecks.push({ name: 'get_git_status', args: {} });
    }
    for (const pending of pendingChecks) {
      onToolEvent?.({ type: 'tool', state: 'running', name: pending.name, label: `using ${pending.name}` });
      const result = await executePennyTool(pending.name, pending.args || {});
      toolsUsed.push({ name: pending.name, ok: result.ok, label: result.label });
      toolRecords.push({ name: pending.name, args: pending.args || {}, result });
      onToolEvent?.({ type: 'tool', state: 'done', name: pending.name, label: result.label, ok: result.ok });
      if (pending.name === 'run_node_check' && result.data?.path) autoCheckedSyntaxPaths.add(result.data.path);
      if (pending.name === 'get_git_status') autoCheckedGitStatusRef.value = true;
    }

    return {
      text: composeToolRecordFallback(toolRecords)
        || `i landed the edit in ${normalizeProjectLikePath(rescueResult.data.path || rescueArgs.path || pathLabel)} and i'm not pretending otherwise.\n[MOOD:smug]`,
      toolsUsed,
      toolRecords,
      toolEvidenceFacts,
      toolOutcome: buildToolOutcome({ userText, editedPaths, debug: debugState }),
    };
  }

  async function runLmStudioToolContextAnswer({ userText, messages, memories, toolName, toolData, abortSignal, laneRuntime }) {
    return withLmStudioLaneModel('tool', async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      clearLmStudioThread(memories);
      try {
        const contextMessages = [
          { role: 'system', content: buildLmStudioToolSystemPrompt({ memories, userText }) },
          {
            role: 'system',
            content: `Verified live context for this reply:\nTool: ${toolName}\n${JSON.stringify(toolData, null, 2)}\nUse this concrete context in your answer. Stay recognizably Penny while being technically precise. If it still is not enough, say what else you would inspect next.`,
          },
          ...sanitizeToolMessages(messages, TOOL_DIRECT_HISTORY_LIMIT),
        ];
        if (!contextMessages.some(msg => msg.role === 'user' && msg.content === userText)) {
          contextMessages.push({ role: 'user', content: userText });
        }
        const payload = {
          model,
          messages: contextMessages,
          temperature: LMSTUDIO_TOOL_SUMMARY_TEMPERATURE,
          max_tokens: LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS,
          stream: false,
        };
        const response = await postJsonLongRunning(`${LMSTUDIO_BASE}/chat/completions`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const bodyText = response.bodyText;
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const err = new Error(`LM Studio direct tool assist error ${response.statusCode}: ${bodyText}`);
          err.statusCode = response.statusCode;
          throw err;
        }
        let parsed;
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          throw new Error(`LM Studio direct tool assist: invalid JSON: ${bodyText.slice(0, 400)}`);
        }
        const message = parsed?.choices?.[0]?.message;
        const text = textFromChatMessage(message);
        if (!text) throw new Error(`No assistant text from direct tool assist: ${bodyText.slice(0, 800)}`);
        clearLmStudioThread(memories);
        return text.trim();
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function draftOpenEndedWriteText({ userText, messages, memories, path = '', mode = 'direct_open_ended_append', abortSignal, laneRuntime = null }) {
    return withLmStudioLaneModel('tool', async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      clearLmStudioThread(memories);
      try {
        const draftMessages = [
          {
            role: 'system',
            content: [
              'You are drafting final prose that a separate tool will insert into a local repo file.',
              'Return only the prose content to write.',
              'Do not mention tools, files, editing, verification, applying changes, access limits, confirmation, or next steps.',
              'Do not ask questions.',
              'Sound like Penny: warm, sharp, observant, natural, and a little bratty when the prompt invites it.',
            ].join('\n'),
          },
          {
            role: 'system',
            content: [
              'Open-ended file writing mode:',
              `Target path: ${path || 'target-file.md'}`,
              mode === 'direct_open_ended_write'
                ? 'Return only the full file contents that should be written.'
                : 'Return only the new text that should be appended to the target file.',
              'You are allowed to draft repo-local file content for Penny\'s tool layer.',
              'Do not say you cannot edit files or access the filesystem; the tool layer handles the actual write after your draft.',
              'No markdown fences.',
              'No mood tags.',
              'No tool JSON.',
              'No explanations about editing.',
              'Honor the user\'s requested tone, topic, sentence count, and paragraph count.',
              'Stay recognizably Penny when the user asked for your own voice.',
              'Keep it bounded and immediately usable as file content.',
            ].join('\n'),
          },
          ...sanitizeToolMessages(messages, TOOL_DIRECT_HISTORY_LIMIT),
        ];
        if (!draftMessages.some(msg => msg.role === 'user' && msg.content === userText)) {
          draftMessages.push({ role: 'user', content: userText });
        }
        async function requestDraftText(messagesForDraft, label = 'open-ended write draft') {
          const payload = {
            model,
            messages: messagesForDraft,
            temperature: LMSTUDIO_TOOL_SUMMARY_TEMPERATURE,
            max_tokens: LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS,
            stream: false,
          };
          const response = await postJsonLongRunning(`${LMSTUDIO_BASE}/chat/completions`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          const bodyText = response.bodyText;
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const err = new Error(`LM Studio ${label} error ${response.statusCode}: ${bodyText}`);
            err.statusCode = response.statusCode;
            throw err;
          }
          let parsed;
          try {
            parsed = JSON.parse(bodyText);
          } catch {
            throw new Error(`LM Studio ${label}: invalid JSON: ${bodyText.slice(0, 400)}`);
          }
          const message = parsed?.choices?.[0]?.message;
          const text = cleanOpenEndedWriteDraft(textFromChatMessage(message));
          if (!text) throw new Error(`No assistant text from ${label}: ${bodyText.slice(0, 800)}`);
          return text;
        }

        let text = await requestDraftText(draftMessages);
        let shapeAnalysis = analyzeDraftShape(text, userText);
        if (looksLikeMetaWriteDraft(text) || !shapeAnalysis.ok) {
          const shapeRequirement = describeDraftShapeRequirement(shapeAnalysis);
          const retryMessages = [
            ...draftMessages,
            {
              role: 'system',
              content: [
                looksLikeMetaWriteDraft(text)
                  ? 'The previous draft was invalid because it asked for more context, talked about file access, or included draft scaffolding.'
                  : `The previous draft violated the requested shape: it returned ${shapeAnalysis.sentenceCount} sentence(s) across ${shapeAnalysis.paragraphCount} paragraph(s) instead of ${shapeRequirement || 'the requested shape'}.`,
                'The file already exists when you are appending, and the user already gave permission for bounded file content.',
                'Do not ask questions. Do not mention access limits. Do not give instructions back to the user.',
                shapeRequirement
                  ? `Return only ${shapeRequirement} of final prose that is immediately usable as file content.`
                  : 'Choose a topic yourself and return only the final prose to write now.',
              ].join('\n'),
            },
          ];
          text = await requestDraftText(retryMessages, 'open-ended write retry');
          shapeAnalysis = analyzeDraftShape(text, userText);
        }
        if (looksLikeMetaWriteDraft(text)) {
          throw new Error(`Open-ended write draft stayed meta instead of producing usable file text for ${path || 'that file'}.`);
        }
        if (!shapeAnalysis.ok) {
          throw new Error(`Open-ended write draft violated requested shape (${shapeAnalysis.reason}) for ${path || 'that file'}.`);
        }
        clearLmStudioThread(memories);
        return text;
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  async function runLmStudioToolLoop({ userText, messages, memories, onToolEvent, abortSignal, laneRuntime }) {
    return withLmStudioLaneModel('tool', async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      clearLmStudioThread(memories);

      const toolMessages = [
        { role: 'system', content: buildLmStudioToolSystemPrompt({ memories, userText }) },
        {
          role: 'system',
          content: [
            'Tool-use playbook for Penny:',
            '- You are still Penny while doing engineering work. Keep the same voice and chemistry; do not turn into a dry generic assistant.',
            '- Use tools whenever the user wants code inspection, debugging, edits, verification, repo status, current web info, or a summary of changes.',
            '- If the user is trying to find a folder or file name, use list_project_files with a recursive pattern. search_project_text is for contents inside text files.',
            '- Project tools are repo-root bounded and ignore generated or heavy folders like .git, node_modules, output, tmp, and logs by default.',
            '- If the right file is unknown, start with list_project_files or search_project_text.',
            '- Read before editing unless the user gave an exact snippet and file path.',
            '- Prefer replace_in_project_file for surgical edits. Use write_project_file for new files or intentional full rewrites.',
            '- When the user asks to add or append a line to a known file, prefer insert_in_project_file with position "end" and lineAware true.',
            `- Example write tool call: ${buildWriteExampleSnippet({ userText, plannerMode: false })}`,
            '- If the user names a folder but wants you to choose the filename, pick one concrete repo-relative path inside that folder and create it with write_project_file before you answer.',
            '- After code edits, verify with run_node_check for changed .js/.cjs/.mjs files and use git tools to confirm what changed.',
            '- If a file is attached in the user message, treat that attachment as real source material, but remember tools only operate on repo files.',
            '- In the final reply, say what you inspected, what you changed, and whether checks passed.',
            '- Never invent tool results, fake a file edit, or claim a verification step that did not happen.',
          ].join('\n'),
        },
        ...sanitizeToolMessages(messages),
      ];
      if (!toolMessages.some(msg => msg.role === 'user' && msg.content === userText)) {
        toolMessages.push({ role: 'user', content: userText });
      }

      const toolsUsed = [];
      const toolRecords = [];
      const toolEvidenceFacts = [];
      const pendingToolEvidenceFacts = [];
      const editedPaths = new Set();
      const toolDebug = createToolDebugState();
      const autoCheckedSyntaxPaths = new Set();
      const writeRequiredBeforeFinal = requiresConfirmedWorkspaceWrite(userText);
      const writeIntent = analyzeWorkspaceWriteIntent(userText);
      const autoCheckedGitStatusRef = { value: false };
      if (writeIntent.targetType === 'new-file-in-folder') {
        toolMessages.push({
          role: 'system',
          content: buildWriteRequiredGuidance({ userText, plannerMode: false }),
        });
      }
      try {
        for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
          onToolEvent?.({ type: 'status', stage: step === 0 ? 'planning' : 'tool-followup', label: step === 0 ? 'planning tool move' : 'working the next step' });
          flushPendingToolEvidenceFacts(toolEvidenceFacts, pendingToolEvidenceFacts);
          const payload = {
            model,
            messages: toolMessages,
            tools: PENNY_TOOL_DEFINITIONS,
            tool_choice: 'auto',
            temperature: LMSTUDIO_TOOL_TEMPERATURE,
            max_tokens: LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS,
            stream: false,
          };
          const response = await postJsonLongRunning(`${LMSTUDIO_BASE}/chat/completions`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          const bodyText = response.bodyText;
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const err = new Error(`LM Studio chat/completions tool call error ${response.statusCode}: ${bodyText}`);
            err.statusCode = response.statusCode;
            throw err;
          }
          let parsed;
          try {
            parsed = JSON.parse(bodyText);
          } catch {
            throw new Error(`LM Studio tool chat/completions: invalid JSON: ${bodyText.slice(0, 400)}`);
          }
          const message = parsed?.choices?.[0]?.message || {};
          const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
          if (!toolCalls.length) {
            const text = textFromChatMessage(message);
            const pendingChecks = [];
            for (const relPath of editedPaths) {
              if (!/\.(?:js|cjs|mjs)$/i.test(relPath) || autoCheckedSyntaxPaths.has(relPath)) continue;
              pendingChecks.push({ name: 'run_node_check', args: { path: relPath } });
            }
            if (editedPaths.size && !autoCheckedGitStatusRef.value) {
              pendingChecks.push({ name: 'get_git_status', args: {} });
            }
            if (pendingChecks.length) {
              onToolEvent?.({ type: 'status', stage: 'verifying', label: 'verifying the edit' });
              toolMessages.push({
                role: 'assistant',
                content: typeof message.content === 'string' ? message.content : (text || ''),
              });
              for (const pending of pendingChecks) {
                onToolEvent?.({ type: 'tool', state: 'running', name: pending.name, label: `using ${pending.name}` });
                const result = await executePennyTool(pending.name, pending.args || {});
                toolsUsed.push({ name: pending.name, ok: result.ok, label: result.label });
                toolRecords.push({ name: pending.name, args: pending.args || {}, result });
                onToolEvent?.({ type: 'tool', state: 'done', name: pending.name, label: result.label, ok: result.ok });
                if (pending.name === 'run_node_check' && result.data?.path) autoCheckedSyntaxPaths.add(result.data.path);
                if (pending.name === 'get_git_status') autoCheckedGitStatusRef.value = true;
                queuePromptVisibleToolEvidenceFact(
                  pendingToolEvidenceFacts,
                  {
                    path: 'native_tool_loop',
                    promptVisibility: 'prompt_visible',
                    nonPromptUse: 'none',
                    renderForm: 'auto_verification_json',
                    modelHop: 'multi',
                  },
                  toolRecords.length - 1,
                );
                toolMessages.push({
                  role: 'system',
                  content: `Automatic verification result from ${pending.name}:\n${JSON.stringify(result.data, null, 2)}`,
                });
              }
              toolMessages.push({
                role: 'system',
                content: "Automatic verification ran after your code edits. Update your final reply to include those verified outcomes in Penny's normal voice.",
              });
              continue;
            }
            if (!text) {
              toolMessages.push({
                role: 'system',
                content: toolsUsed.length
                  ? 'You just produced an empty reply. Answer again now using the verified tool results already in the conversation. Do not leave the assistant content blank.'
                  : "You just produced an empty reply. Try again now. Because this is a tool-enabled coding turn, either call the tool you need or answer in Penny's normal voice with concrete next-step reasoning.",
              });
              if (writeRequiredBeforeFinal && !editedPaths.size) {
                toolMessages.push({
                  role: 'system',
                  content: buildWriteRequiredGuidance({ userText, toolRecords, plannerMode: false }),
                });
              }
              continue;
            }
            if (writeRequiredBeforeFinal && !editedPaths.size) {
              const rescued = await attemptWriteRequiredRescue({
                model,
                controller,
                userText,
                toolsUsed,
                toolRecords,
                toolEvidenceFacts,
                editedPaths,
                autoCheckedSyntaxPaths,
                autoCheckedGitStatusRef,
                onToolEvent,
                debugState: toolDebug,
                phase: 'native',
              });
              if (rescued) return rescued;
              const error = buildMissingWorkspaceWriteError();
              error.toolOutcomeDebug = toolDebug;
              throw error;
            }
            return {
              text: text.trim(),
              toolsUsed,
              toolRecords,
              toolEvidenceFacts,
              toolOutcome: buildToolOutcome({ userText, editedPaths, debug: toolDebug }),
            };
          }

          toolMessages.push({
            role: 'assistant',
            content: typeof message.content === 'string' ? message.content : '',
            tool_calls: toolCalls.map(call => ({
              id: call.id,
              type: call.type || 'function',
              function: {
                name: call?.function?.name || '',
                arguments: typeof call?.function?.arguments === 'string'
                  ? call.function.arguments
                  : JSON.stringify(call?.function?.arguments || {}),
              },
            })),
          });

          for (const call of toolCalls) {
            const name = String(call?.function?.name || '').trim();
            const parsedArgs = parseToolArguments(call?.function?.arguments);
            if (!parsedArgs.ok) {
              const failedResult = {
                ok: false,
                label: `tool args invalid for ${name || 'unknown tool'}`,
                data: { error: parsedArgs.error },
              };
              toolsUsed.push({ name, ok: failedResult.ok, label: failedResult.label });
              toolRecords.push({ name, args: {}, result: failedResult });
              onToolEvent?.({ type: 'tool', state: 'done', name, label: failedResult.label, ok: failedResult.ok });
              queuePromptVisibleToolEvidenceFact(
                pendingToolEvidenceFacts,
                {
                  path: 'native_tool_loop',
                  promptVisibility: 'prompt_visible',
                  nonPromptUse: 'none',
                  renderForm: 'raw_json',
                  modelHop: 'multi',
                },
                toolRecords.length - 1,
              );
              toolMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(failedResult.data),
              });
              continue;
            }
            const args = parsedArgs.value;
            onToolEvent?.({ type: 'tool', state: 'running', name, label: `using ${name}` });
            const result = await executePennyTool(name, args);
            toolsUsed.push({ name, ok: result.ok, label: result.label });
            toolRecords.push({ name, args, result });
            onToolEvent?.({ type: 'tool', state: 'done', name, label: result.label, ok: result.ok });
            if (WRITE_TOOL_NAMES.has(name) && result.ok && result.data?.path) {
              editedPaths.add(result.data.path);
            }
            if (name === 'run_node_check' && result.data?.path) {
              autoCheckedSyntaxPaths.add(result.data.path);
            }
            if (name === 'get_git_status') autoCheckedGitStatusRef.value = true;
            queuePromptVisibleToolEvidenceFact(
              pendingToolEvidenceFacts,
              {
                path: 'native_tool_loop',
                promptVisibility: 'prompt_visible',
                nonPromptUse: 'none',
                renderForm: 'raw_json',
                modelHop: 'multi',
              },
              toolRecords.length - 1,
            );
            toolMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(result.data),
            });
          }
          if (writeRequiredBeforeFinal && !editedPaths.size) {
            toolMessages.push({
              role: 'system',
              content: buildWriteRequiredGuidance({ userText, toolRecords, plannerMode: false }),
            });
          }
        }
        if (toolRecords.length) {
          if (writeRequiredBeforeFinal && !editedPaths.size) {
            const rescued = await attemptWriteRequiredRescue({
              model,
              controller,
              userText,
              toolsUsed,
              toolRecords,
              toolEvidenceFacts,
              editedPaths,
              autoCheckedSyntaxPaths,
              autoCheckedGitStatusRef,
              onToolEvent,
              debugState: toolDebug,
              phase: 'native',
            });
            if (rescued) return rescued;
            return {
              text: buildWriteRequiredFailureText({ userText, toolRecords }),
              toolsUsed,
              toolRecords,
              toolEvidenceFacts,
              toolOutcome: buildToolOutcome({ userText, editedPaths, failureReason: 'write-required-unmet', debug: toolDebug }),
              skipSemanticRender: true,
            };
          }
          const fallbackText = composeToolRecordFallback(toolRecords)
            || "i did the tool work, but the reply brain chewed through its loop budget before it could say something normal.\n[MOOD:annoyed]";
          return {
            text: fallbackText,
            toolsUsed,
            toolRecords,
            toolEvidenceFacts,
            toolOutcome: buildToolOutcome({ userText, editedPaths, debug: toolDebug }),
          };
        }
        throw new Error(`Penny hit the tool-use loop limit (${MAX_TOOL_STEPS}) before finishing the reply.`);
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  function parsePlannerDecision(text = '') {
    const parsed = parseToolArguments(text);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') {
      return { ok: false, error: parsed.error || 'Planner reply was not valid JSON.' };
    }
    const rawKind = String(parsed.value.kind || '').trim().toLowerCase();
    const impliedKind = rawKind
      || (parsed.value.tool || parsed.value.name ? 'tool' : '')
      || (parsed.value.text ? 'final' : '');
    const kind = impliedKind;
    if (kind === 'tool') {
      const tool = String(parsed.value.tool || parsed.value.name || '').trim();
      if (!tool) return { ok: false, error: 'Planner JSON was missing `tool`.' };
      let args = {};
      if (parsed.value.args && typeof parsed.value.args === 'object') {
        args = parsed.value.args;
      } else if (parsed.value.arguments && typeof parsed.value.arguments === 'object') {
        args = parsed.value.arguments;
      } else if (typeof parsed.value.arguments === 'string') {
        const parsedArguments = parseToolArguments(parsed.value.arguments);
        if (!parsedArguments.ok || !parsedArguments.value || typeof parsedArguments.value !== 'object') {
          return { ok: false, error: 'Planner JSON `arguments` field was not valid JSON.' };
        }
        args = parsedArguments.value;
      }
      return { ok: true, kind, tool, args };
    }
    if (kind === 'final') {
      const finalText = String(parsed.value.text || '').trim();
      if (!finalText) return { ok: false, error: 'Planner JSON was missing `text` for the final reply.' };
      return { ok: true, kind, text: finalText };
    }
    return { ok: false, error: 'Planner JSON must use kind "tool" or "final".' };
  }

  function shouldFallbackToManualToolLoop(error) {
    if (error?.code === 'tool_loop_missing_workspace_write') return true;
    const message = String(error?.message || '');
    return /No assistant text from tool-enabled chat\/completions/i.test(message)
      || /confirmed workspace write before final reply/i.test(message)
      || /tool-use loop limit/i.test(message);
  }

  async function runLmStudioManualToolLoop({ userText, messages, memories, onToolEvent, abortSignal, laneRuntime, fallbackDebug = null }) {
    return withLmStudioLaneModel('tool', async (model) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
      bindAbortSignal(controller, abortSignal);
      clearLmStudioThread(memories);

      const plannerMessages = [
        { role: 'system', content: buildLmStudioToolSystemPrompt({ memories, userText }) },
        {
          role: 'system',
          content: [
            'Manual tool planner mode:',
            '- Native function calling was flaky, so you must choose your next action with JSON only.',
            '- Reply with exactly one JSON object and no markdown.',
            '- Tool step schema: {"kind":"tool","tool":"read_project_file","args":{"path":"server.js"}}',
            `- Example write step: ${buildWriteExampleSnippet({ userText, plannerMode: true })}`,
            '- Final step schema: {"kind":"final","text":"your normal Penny reply ending with one mood tag"}',
            `- Valid tool names: ${PENNY_TOOL_DEFINITIONS.map(item => item.function.name).join(', ')}`,
            '- Use one tool at a time.',
            '- Inspect before editing. Prefer targeted replacements over full rewrites.',
            '- If the user names a folder but wants you to choose the filename, choose one concrete repo-relative file path inside that folder and create it with write_project_file before returning kind "final".',
            '- For live/current information, use search_web first and read_web_page only if you need to inspect a result page.',
            '- After code edits, verify before returning kind final.',
            '- Stay recognizably Penny in the final text, but keep the technical facts exact.',
          ].join('\n'),
        },
        ...sanitizeToolMessages(messages),
      ];
      if (!plannerMessages.some(msg => msg.role === 'user' && msg.content === userText)) {
        plannerMessages.push({ role: 'user', content: userText });
      }

      const toolsUsed = [];
      const toolRecords = [];
      const toolEvidenceFacts = [];
      const pendingToolEvidenceFacts = [];
      const editedPaths = new Set();
      const toolDebug = createToolDebugState(fallbackDebug);
      updateManualFallbackDebug(toolDebug, {
        used: true,
        reasonCode: String(toolDebug?.manualFallback?.reasonCode || '').trim(),
        reason: trimToolDebugText(toolDebug?.manualFallback?.reason || '', 180),
      });
      const autoCheckedSyntaxPaths = new Set();
      const writeRequiredBeforeFinal = requiresConfirmedWorkspaceWrite(userText);
      const writeIntent = analyzeWorkspaceWriteIntent(userText);
      const autoCheckedGitStatusRef = { value: false };
      if (writeIntent.targetType === 'new-file-in-folder') {
        plannerMessages.push({
          role: 'system',
          content: buildWriteRequiredGuidance({ userText, plannerMode: true }),
        });
      }

      try {
        for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
          onToolEvent?.({ type: 'status', stage: step === 0 ? 'planning' : 'tool-followup', label: step === 0 ? 'planning tool move' : 'working the next step' });
          flushPendingToolEvidenceFacts(toolEvidenceFacts, pendingToolEvidenceFacts);
          const payload = {
            model,
            messages: plannerMessages,
            temperature: LMSTUDIO_TOOL_TEMPERATURE,
            max_tokens: LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS,
            stream: false,
          };
          const response = await postJsonLongRunning(`${LMSTUDIO_BASE}/chat/completions`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          const bodyText = response.bodyText;
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const err = new Error(`LM Studio manual planner error ${response.statusCode}: ${bodyText}`);
            err.statusCode = response.statusCode;
            throw err;
          }
          let parsed;
          try {
            parsed = JSON.parse(bodyText);
          } catch {
            throw new Error(`LM Studio manual planner: invalid JSON: ${bodyText.slice(0, 400)}`);
          }
          const message = parsed?.choices?.[0]?.message || {};
          const assistantText = textFromChatMessage(message);
          if (!assistantText) {
            updateManualFallbackDebug(toolDebug, {
              lastPlannerStatus: 'empty-reply',
              emptyReplyCount: Number(toolDebug?.manualFallback?.emptyReplyCount || 0) + 1,
            });
            plannerMessages.push({
              role: 'system',
              content: 'Your previous response was empty. Reply again with exactly one JSON object and no markdown.',
            });
            if (writeRequiredBeforeFinal && !editedPaths.size) {
              plannerMessages.push({
                role: 'system',
                content: buildWriteRequiredGuidance({ userText, toolRecords, plannerMode: true }),
              });
            }
            continue;
          }

          const decision = parsePlannerDecision(assistantText);
          if (!decision.ok) {
            updateManualFallbackDebug(toolDebug, {
              lastPlannerStatus: 'invalid-planner-json',
              lastDecisionKind: '',
              lastDecisionTool: '',
              lastDecisionError: decision.error,
              lastAssistantText: assistantText,
              invalidReplyCount: Number(toolDebug?.manualFallback?.invalidReplyCount || 0) + 1,
            });
            plannerMessages.push({ role: 'assistant', content: assistantText });
            plannerMessages.push({
              role: 'system',
              content: `That was not valid planner JSON. ${decision.error} Reply again with exactly one JSON object and no markdown.`,
            });
            if (writeRequiredBeforeFinal && !editedPaths.size) {
              plannerMessages.push({
                role: 'system',
                content: buildWriteRequiredGuidance({ userText, toolRecords, plannerMode: true }),
              });
            }
            continue;
          }

          if (decision.kind === 'tool') {
            updateManualFallbackDebug(toolDebug, {
              lastPlannerStatus: 'tool',
              lastDecisionKind: decision.kind,
              lastDecisionTool: decision.tool,
              lastDecisionError: '',
              lastAssistantText: assistantText,
            });
            plannerMessages.push({ role: 'assistant', content: assistantText });
            onToolEvent?.({ type: 'tool', state: 'running', name: decision.tool, label: `using ${decision.tool}` });
            const result = await executePennyTool(decision.tool, decision.args || {});
            toolsUsed.push({ name: decision.tool, ok: result.ok, label: result.label });
            toolRecords.push({ name: decision.tool, args: decision.args || {}, result });
            onToolEvent?.({ type: 'tool', state: 'done', name: decision.tool, label: result.label, ok: result.ok });
            if (WRITE_TOOL_NAMES.has(decision.tool) && result.ok && result.data?.path) {
              editedPaths.add(result.data.path);
            }
            if (decision.tool === 'run_node_check' && result.data?.path) {
              autoCheckedSyntaxPaths.add(result.data.path);
            }
            if (decision.tool === 'get_git_status') autoCheckedGitStatusRef.value = true;
            queuePromptVisibleToolEvidenceFact(
              pendingToolEvidenceFacts,
              {
                path: 'manual_tool_loop',
                promptVisibility: 'prompt_visible',
                nonPromptUse: 'none',
                renderForm: 'raw_json',
                modelHop: 'multi',
              },
              toolRecords.length - 1,
            );
            plannerMessages.push({
              role: 'system',
              content: `Tool result from ${decision.tool}:\n${JSON.stringify(result.data, null, 2)}`,
            });
            if (writeRequiredBeforeFinal && !editedPaths.size) {
              plannerMessages.push({
                role: 'system',
                content: buildWriteRequiredGuidance({ userText, toolRecords, plannerMode: true }),
              });
            }
            continue;
          }

          if (writeRequiredBeforeFinal && !editedPaths.size) {
            updateManualFallbackDebug(toolDebug, {
              lastPlannerStatus: 'final-before-write',
              lastDecisionKind: decision.kind,
              lastDecisionTool: '',
              lastDecisionError: '',
              lastAssistantText: assistantText,
            });
            const rescued = await attemptWriteRequiredRescue({
              model,
              controller,
              userText,
              toolsUsed,
              toolRecords,
              toolEvidenceFacts,
              editedPaths,
              autoCheckedSyntaxPaths,
              autoCheckedGitStatusRef,
              onToolEvent,
              debugState: toolDebug,
              phase: 'manual',
            });
            if (rescued) return rescued;
            plannerMessages.push({ role: 'assistant', content: assistantText });
            plannerMessages.push({
              role: 'system',
              content: buildWriteRequiredGuidance({ userText, toolRecords, plannerMode: true }),
            });
            continue;
          }

          const pendingChecks = [];
          for (const relPath of editedPaths) {
            if (!/\.(?:js|cjs|mjs)$/i.test(relPath) || autoCheckedSyntaxPaths.has(relPath)) continue;
            pendingChecks.push({ name: 'run_node_check', args: { path: relPath } });
          }
          if (editedPaths.size && !autoCheckedGitStatusRef.value) {
            pendingChecks.push({ name: 'get_git_status', args: {} });
          }
          if (pendingChecks.length) {
            onToolEvent?.({ type: 'status', stage: 'verifying', label: 'verifying the edit' });
            plannerMessages.push({ role: 'assistant', content: assistantText });
            for (const pending of pendingChecks) {
              onToolEvent?.({ type: 'tool', state: 'running', name: pending.name, label: `using ${pending.name}` });
              const result = await executePennyTool(pending.name, pending.args || {});
              toolsUsed.push({ name: pending.name, ok: result.ok, label: result.label });
              toolRecords.push({ name: pending.name, args: pending.args || {}, result });
              onToolEvent?.({ type: 'tool', state: 'done', name: pending.name, label: result.label, ok: result.ok });
              if (pending.name === 'run_node_check' && result.data?.path) autoCheckedSyntaxPaths.add(result.data.path);
              if (pending.name === 'get_git_status') autoCheckedGitStatusRef.value = true;
              queuePromptVisibleToolEvidenceFact(
                pendingToolEvidenceFacts,
                {
                  path: 'manual_tool_loop',
                  promptVisibility: 'prompt_visible',
                  nonPromptUse: 'none',
                  renderForm: 'auto_verification_json',
                  modelHop: 'multi',
                },
                toolRecords.length - 1,
              );
              plannerMessages.push({
                role: 'system',
                content: `Automatic verification result from ${pending.name}:\n${JSON.stringify(result.data, null, 2)}`,
              });
            }
            plannerMessages.push({
              role: 'system',
              content: `Automatic verification ran after your code edits. Reply again with kind "final" and include those verified outcomes in Penny's normal voice.`,
            });
            continue;
          }

          updateManualFallbackDebug(toolDebug, {
            lastPlannerStatus: 'final',
            lastDecisionKind: decision.kind,
            lastDecisionTool: '',
            lastDecisionError: '',
            lastAssistantText: assistantText,
          });
          return {
            text: decision.text.trim(),
            toolsUsed,
            toolRecords,
            toolEvidenceFacts,
            toolOutcome: buildToolOutcome({ userText, editedPaths, debug: toolDebug }),
          };
        }
        if (toolRecords.length) {
          if (writeRequiredBeforeFinal && !editedPaths.size) {
            const rescued = await attemptWriteRequiredRescue({
              model,
              controller,
              userText,
              toolsUsed,
              toolRecords,
              toolEvidenceFacts,
              editedPaths,
              autoCheckedSyntaxPaths,
              autoCheckedGitStatusRef,
              onToolEvent,
              debugState: toolDebug,
              phase: 'manual',
            });
            if (rescued) return rescued;
            return {
              text: buildWriteRequiredFailureText({ userText, toolRecords }),
              toolsUsed,
              toolRecords,
              toolEvidenceFacts,
              toolOutcome: buildToolOutcome({ userText, editedPaths, failureReason: 'write-required-unmet', debug: toolDebug }),
              skipSemanticRender: true,
            };
          }
          const fallbackText = composeToolRecordFallback(toolRecords)
            || "i did the tool work, but the reply brain chewed through its loop budget before it could say something normal.\n[MOOD:annoyed]";
          return {
            text: fallbackText,
            toolsUsed,
            toolRecords,
            toolEvidenceFacts,
            toolOutcome: buildToolOutcome({ userText, editedPaths, debug: toolDebug }),
          };
        }
        throw new Error(`Penny manual tool loop hit the limit (${MAX_TOOL_STEPS}) before finishing the reply.`);
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error(`LM Studio request timed out after ${LMSTUDIO_TIMEOUT_MS}ms`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }, laneRuntime);
  }

  return {
    draftOpenEndedWriteText,
    runLmStudioToolContextAnswer,
    runLmStudioToolLoop,
    parsePlannerDecision,
    shouldFallbackToManualToolLoop,
    runLmStudioManualToolLoop,
  };
}

module.exports = {
  createLmStudioToolLoopApi,
};
