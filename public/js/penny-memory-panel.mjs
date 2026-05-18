/**
 * @typedef {Object} PennyAppState
 * @property {string} panel
 * @property {Array<Object>} messages
 * @property {string} mood
 * @property {string} presence
 * @property {boolean} loading
 * @property {boolean} consolidating
 * @property {boolean} syncingMemory
 * @property {number} turns
 * @property {Object|null} backendStatus
 * @property {Object} memory
 * @property {Object|null} memoryInspector
 */

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function ensureMemoryInspectorUi(els = {}) {
  if (els.memoryInspectorPanel) return els.memoryInspectorPanel;
  const host = els.memoryList?.parentElement;
  if (!host) return null;

  const details = host.ownerDocument.createElement('details');
  details.className = 'memory-diagnostics-details';
  details.innerHTML = `
    <summary>
      Advanced diagnostics
      <small>Review suggestions, corrections, and Prompt/runtime receipts</small>
    </summary>
  `;
  const toolbar = host.ownerDocument.createElement('div');
  toolbar.className = 'memory-toolbar';
  toolbar.innerHTML = `
    <div>
      <div class="section-label">Prompt/runtime receipts</div>
      <div class="memory-toolbar-note">
        Default Memory above is the ordinary user view. This advanced inspector is for review suggestions, corrections, forget controls, diagnostics, and receipts.
      </div>
    </div>
    <div class="memory-toolbar-actions">
      <button id="refreshMemoryInspector" class="secondary-btn tiny" type="button">Refresh inspector</button>
      <button id="purgeSessionArchive" class="secondary-btn tiny danger" type="button">Clear session archive</button>
      <button id="purgeGlobalArchive" class="secondary-btn tiny danger" type="button">Clear archive</button>
      <button id="purgeEmbeddings" class="secondary-btn tiny danger" type="button">Clear embeddings</button>
    </div>
  `;
  const panel = host.ownerDocument.createElement('div');
  panel.id = 'memoryInspectorPanel';
  panel.className = 'list-block empty';
  panel.textContent = 'Inspector data will appear here once Penny has a chat to archive.';
  details.append(toolbar, panel);
  host.append(details);
  els.memoryDiagnosticsDetails = details;
  els.memoryInspectorToolbar = toolbar;
  els.memoryInspectorPanel = panel;
  return panel;
}

export function buildMemoryPanelViewModel(memory = {}) {
  return {
    userName: String(memory.userName || ''),
    voiceOn: memory.voiceOn === true,
    memories: Array.isArray(memory.memories)
      ? memory.memories.map((item, index) => ({
          index,
          text: String(item?.text || ''),
          kind: String(item?.kind || 'memory'),
        }))
      : [],
  };
}

export function buildMemoryInspectorViewModel(inspector = null) {
  const explicit = inspector?.explicit || {};
  const session = {
    ...(inspector?.archive?.session || {}),
    sessionId: String(inspector?.sessionId || inspector?.archive?.session?.sessionId || ''),
  };
  const global = inspector?.archive?.global || {};
  const books = inspector?.memoryBooks || {};
  const semantic = inspector?.embeddings?.semanticMemory || {};
  const backgroundVectorization = inspector?.embeddings?.backgroundVectorization || {};
  const ledger = inspector?.ledger || {};
  const routing = inspector?.routing || {};
  const artifact = inspector?.artifact || routing?.artifact || null;
  const retrieval = session.lastRetrieval || { session: [], global: [] };
  const recentAuditTrail = Array.isArray(session.recentAuditTrail) ? session.recentAuditTrail : [];
  const matchedBooks = Array.isArray(books.matchedBooks) ? books.matchedBooks : [];
  const compression = inspector?.compression || retrieval.compression || { used: false, chapters: [] };
  const activeContradictions = Array.isArray(session.activeContradictions) ? session.activeContradictions : [];
  const queue = Array.isArray(global.promotionQueue) ? global.promotionQueue : [];
  const runtime = inspector?.runtime || {};

  return {
    explicit,
    session,
    global,
    books,
    semantic,
    backgroundVectorization,
    ledger,
    routing,
    artifact,
    retrieval,
    recentAuditTrail,
    matchedBooks,
    compression,
    activeContradictions,
    queue,
    runtime,
  };
}

function formatDurationMs(value = 0) {
  const ms = Math.max(0, Math.round(Number(value || 0)));
  if (!ms) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  return `${Math.round((ms / 1000) * 100) / 100}s`;
}

function formatCacheAge(cacheAgeMs = 0) {
  const seconds = Math.max(0, Math.round(Number(cacheAgeMs || 0) / 1000));
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m old`;
}

function normalizePromptTruthChannel(channel = null) {
  const value = channel && typeof channel === 'object' ? channel : {};
  const candidateCount = Math.max(0, Number(value.candidateCount || 0));
  const renderedCount = Math.max(0, Number(value.renderedCount || 0));
  const heldBackReason = String(value.heldBackReason || '').trim();
  let state = String(value.state || '').trim().toLowerCase();
  if (!state) {
    if (renderedCount > 0) state = 'rendered';
    else if (heldBackReason === 'ledger-prompt-disabled') state = 'disabled';
    else if (candidateCount > 0 && heldBackReason) state = 'held_back';
    else if (candidateCount > 0) state = 'candidate';
    else state = 'unknown';
  }
  return {
    state,
    candidateCount,
    renderedCount,
    heldBackReason,
  };
}

function formatPromptTruthStateLabel(state = 'unknown') {
  return String(state || 'unknown').trim().toLowerCase().replaceAll('_', ' ') || 'unknown';
}

function summarizePromptTruthChannel(channelKey = '', channel = null) {
  const normalized = normalizePromptTruthChannel(channel);
  if (
    normalized.state === 'unknown'
    && !normalized.candidateCount
    && !normalized.renderedCount
    && !normalized.heldBackReason
  ) {
    return '';
  }
  const countText = normalized.candidateCount || normalized.renderedCount
    ? ` ${normalized.renderedCount}/${normalized.candidateCount}`
    : '';
  const reasonText = normalized.heldBackReason ? ` (${normalized.heldBackReason})` : '';
  return `${channelKey} ${formatPromptTruthStateLabel(normalized.state)}${countText}${reasonText}`;
}

function summarizeResearchLedgerPromptState(channel = null, rendered = false) {
  const normalized = normalizePromptTruthChannel(channel);
  if (normalized.state === 'unknown' && rendered === true) return 'rendered';
  return normalized.state;
}

function normalizeToolEvidenceReceipt(receipt = null) {
  if (!receipt || typeof receipt !== 'object') return null;
  const summary = receipt.summary && typeof receipt.summary === 'object' ? receipt.summary : {};
  return {
    schema: String(receipt.schema || '').trim(),
    summary: {
      toolRecordCount: Math.max(0, Number(summary.toolRecordCount || 0)),
      itemCount: Math.max(0, Number(summary.itemCount || 0)),
      promptVisibleItemCount: Math.max(0, Number(summary.promptVisibleItemCount || 0)),
      deterministicOnlyItemCount: Math.max(0, Number(summary.deterministicOnlyItemCount || 0)),
      provenanceOnlyItemCount: Math.max(0, Number(summary.provenanceOnlyItemCount || 0)),
      unknownItemCount: Math.max(0, Number(summary.unknownItemCount || 0)),
      rawJsonItemCount: Math.max(0, Number(summary.rawJsonItemCount || 0)),
      autoVerificationItemCount: Math.max(0, Number(summary.autoVerificationItemCount || 0)),
      summarizedItemCount: Math.max(0, Number(summary.summarizedItemCount || 0)),
      multiHopItemCount: Math.max(0, Number(summary.multiHopItemCount || 0)),
    },
    items: Array.isArray(receipt.items) ? receipt.items : [],
  };
}

function preferRenderedCompatibilityBoolean(value = null, renderedKey = '', aliasKey = '', fallback = false) {
  const source = value && typeof value === 'object' ? value : {};
  if (source[renderedKey] === true) return true;
  if (source[renderedKey] === false) return false;
  if (source[aliasKey] === true) return true;
  if (source[aliasKey] === false) return false;
  return fallback === true;
}

function isResearchLedgerRendered(value = null) {
  return preferRenderedCompatibilityBoolean(
    value,
    'researchLedgerRendered',
    'researchLedgerPromptInjected',
    false,
  );
}

function renderedAdvisoryCount(value = null, key = 'items') {
  const source = value && typeof value === 'object' ? value : {};
  if (key === 'channels') {
    return Number(source.advisoryChannelsRendered ?? source.advisoryChannelsInjected ?? 0);
  }
  return Number(source.advisoryItemsRendered ?? source.advisoryItemsInjected ?? 0);
}

function isRetrievalTraceRendered(item = null) {
  return preferRenderedCompatibilityBoolean(item, 'rendered', 'injected', true);
}

function formatInspectorMoment(value = '') {
  const text = String(value || '').trim();
  return text || 'not yet';
}

export function renderMemoryList({ els = {}, memory = {}, escapeHtmlFn = escapeHtml } = {}) {
  const viewModel = buildMemoryPanelViewModel(memory);
  if (els.memoryList) {
    els.memoryList.className = `list-block${viewModel.memories.length ? '' : ' empty'}`;
    els.memoryList.innerHTML = viewModel.memories.length
      ? viewModel.memories.map((item) => `<div class="list-item memory-item"><div class="memory-copy">${escapeHtmlFn(item.text)}<small>${escapeHtmlFn(item.kind)}</small></div><button class="memory-remove" data-kind="memory" data-index="${item.index}" type="button">x</button></div>`).join('')
      : 'Nothing stored yet. Penny will start picking things up as you talk.';
  }
  if (els.clearAllMemories) els.clearAllMemories.textContent = 'Clear explicit facts';
  if (els.nameInput) els.nameInput.value = viewModel.userName;
  if (els.voiceToggle) els.voiceToggle.checked = viewModel.voiceOn;
  return viewModel;
}

function renderItems(items = [], emptyText = 'None right now.', escapeHtmlFn = escapeHtml) {
  if (!items.length) return `<div class="list-item"><div class="memory-copy">${escapeHtmlFn(emptyText)}</div></div>`;
  return items.map((item) => `
    <div class="list-item memory-item">
      <div class="memory-copy">
        ${escapeHtmlFn(item.text || item.excerpt || '')}
        <small>${escapeHtmlFn(item.sourceLabel || item.source || item.sourceType || item.type || 'memory')} &middot; ${escapeHtmlFn(item.sensitivity || 'normal')}${item.evidenceSnippet ? ` &middot; ${escapeHtmlFn(item.evidenceSnippet)}` : ''}</small>
      </div>
    </div>
  `).join('');
}

function renderQueue(queue = [], escapeHtmlFn = escapeHtml) {
  if (!queue.length) return `<div class="list-item"><div class="memory-copy">Promotion queue is empty.</div></div>`;
  return queue.map((item) => `
    <div class="list-item memory-item">
      <div class="memory-copy">
        ${escapeHtmlFn(item.text || '')}
        <small>${escapeHtmlFn(item.sourceLabel || item.sourceType || 'review-candidate')} &middot; evidence ${escapeHtmlFn(String(item.evidenceCount || 0))} &middot; confidence ${escapeHtmlFn(String(Math.round((item.confidence || 0) * 100)))}%${item.evidenceSnippet ? ` &middot; ${escapeHtmlFn(item.evidenceSnippet)}` : ''}</small>
        ${item.promotionPacket
          ? `<small>${escapeHtmlFn(`thread ${item.promotionPacket.sourceThreadId || 'unknown'} · turns ${(item.promotionPacket.sourceTurnIds || []).length} · ${item.promotionPacket.temporalScope?.label || 'temporal scope pending'}`)}</small>`
          : ''}
      </div>
      <div class="memory-toolbar-actions">
        <button class="secondary-btn tiny" type="button" data-review-action="approve" data-review-id="${escapeHtmlFn(item.id || '')}">Approve</button>
        <button class="secondary-btn tiny danger" type="button" data-review-action="reject" data-review-id="${escapeHtmlFn(item.id || '')}">Reject</button>
      </div>
    </div>
  `).join('');
}

function renderRoutingSummary(routing = {}, escapeHtmlFn = escapeHtml) {
  const selectedLane = String(routing.selectedLane || routing.localLane || '').trim() || 'chat';
  const requestedMode = String(routing.requestedMode || '').trim() || 'local';
  const backend = String(routing.backend || '').trim() || 'unknown';
  const repair = routing.repair && typeof routing.repair === 'object' ? routing.repair : null;
  const repairBits = [];
  if (repair?.repairAttempted) repairBits.push(`repair attempted (${repair.finalCandidateSource || 'first-pass'})`);
  if (Array.isArray(repair?.firstPassGuardCodes) && repair.firstPassGuardCodes.length) {
    repairBits.push(`guards: ${repair.firstPassGuardCodes.join(', ')}`);
  }
  if (repair?.repairRejectedReason) repairBits.push(`repair rejected: ${repair.repairRejectedReason}`);
  return `
    <div class="list-item">
      <div class="memory-copy">
        Requested mode: <strong>${escapeHtmlFn(requestedMode)}</strong> &middot; Selected lane: <strong>${escapeHtmlFn(selectedLane)}</strong> &middot; Backend: <strong>${escapeHtmlFn(backend)}</strong>
        <small>${escapeHtmlFn(repairBits.join(' · ') || 'No runtime repair was needed on the last reply.')}</small>
      </div>
    </div>
  `;
}

function renderBackgroundVectorizationSummary(background = {}, session = {}, escapeHtmlFn = escapeHtml) {
  const status = String(background.status || 'disabled').trim() || 'disabled';
  const backgroundCandidateCount = Number(background.backgroundCandidateCount ?? background.selectedCount ?? 0);
  const backgroundCreatedCount = Number(background.backgroundCreatedCount ?? background.createdCount ?? 0);
  const sourceSessionId = String(background.sourceSessionId || '').trim();
  const inspectedSessionId = String(session?.sessionId || '').trim();
  const detailBits = [
    `semantic ready ${background.semanticReady ? 'yes' : 'no'}`,
    `batch ${Math.max(0, Number(background.batchLimit || 0))}`,
    `eager ${Math.max(0, Number(background.eagerEmbeddingCount || 0))}`,
    `selected ${Math.max(0, backgroundCandidateCount)}`,
    `created ${Math.max(0, backgroundCreatedCount)}`,
  ];
  if (sourceSessionId) {
    detailBits.push(sourceSessionId === inspectedSessionId ? 'source this session' : `source ${sourceSessionId}`);
  }
  if (background.archivePending) detailBits.push('archive update still pending');
  if (background.skippedReason) detailBits.push(background.skippedReason);
  return `
    <div class="list-item">
      <div class="memory-copy">
        Background vectors: <strong>${escapeHtmlFn(status)}</strong> &middot; Attempted ${escapeHtmlFn(formatInspectorMoment(background.attemptedAt))} &middot; Last archived ${escapeHtmlFn(formatInspectorMoment(session?.lastArchivedAt))}
        <small>${escapeHtmlFn(detailBits.join(' | '))}</small>
      </div>
    </div>
  `;
}

function renderArtifactSummary(artifact = null, escapeHtmlFn = escapeHtml) {
  if (!artifact || typeof artifact !== 'object') {
    return `<div class="list-item"><div class="memory-copy">No runtime artifact is available for the last turn yet.</div></div>`;
  }
  const scope = artifact.scope && typeof artifact.scope === 'object' ? artifact.scope : {};
  const authority = artifact.authority && typeof artifact.authority === 'object' ? artifact.authority : {};
  const summary = artifact.summary && typeof artifact.summary === 'object' ? artifact.summary : {};
  const evidence = Array.isArray(artifact.evidence) ? artifact.evidence : [];
  const artifacts = Array.isArray(artifact.artifacts) ? artifact.artifacts : [];
  const sideEffects = Array.isArray(artifact.sideEffects) ? artifact.sideEffects : [];
  const reasonCodes = Array.isArray(artifact.reasonCodes) ? artifact.reasonCodes : [];
  const epistemics = artifact.epistemics && typeof artifact.epistemics === 'object' ? artifact.epistemics : {};
  const synthesis = artifact.synthesis && typeof artifact.synthesis === 'object' ? artifact.synthesis : {};
  const modelAdvisory = artifact.modelAdvisory && typeof artifact.modelAdvisory === 'object' ? artifact.modelAdvisory : {};
  const cleanup = modelAdvisory.cleanup && typeof modelAdvisory.cleanup === 'object' ? modelAdvisory.cleanup : {};
  const cleanupTransform = modelAdvisory.cleanupTransform && typeof modelAdvisory.cleanupTransform === 'object'
    ? modelAdvisory.cleanupTransform
    : {};
  const authorityPressure = modelAdvisory.authorityPressure && typeof modelAdvisory.authorityPressure === 'object'
    ? modelAdvisory.authorityPressure
    : {};
  const promptComposition = modelAdvisory.promptComposition && typeof modelAdvisory.promptComposition === 'object'
    ? modelAdvisory.promptComposition
    : {};
  const promptTruth = artifact.promptTruth && typeof artifact.promptTruth === 'object'
    ? artifact.promptTruth
    : (modelAdvisory.promptTruth && typeof modelAdvisory.promptTruth === 'object' ? modelAdvisory.promptTruth : {});
  const approximatePath = modelAdvisory.approximatePath && typeof modelAdvisory.approximatePath === 'object'
    ? modelAdvisory.approximatePath
    : {};
  const reasoningPolicy = modelAdvisory.reasoningPolicy && typeof modelAdvisory.reasoningPolicy === 'object'
    ? modelAdvisory.reasoningPolicy
    : (artifact?.trace?.reasoningPolicy && typeof artifact.trace.reasoningPolicy === 'object' ? artifact.trace.reasoningPolicy : {});
  const advisoryMerge = modelAdvisory.advisoryMerge && typeof modelAdvisory.advisoryMerge === 'object'
    ? modelAdvisory.advisoryMerge
    : {};
  const performance = artifact.performance && typeof artifact.performance === 'object' ? artifact.performance : {};
  const readiness = artifact.readiness && typeof artifact.readiness === 'object' ? artifact.readiness : {};
  const toolOutcome = artifact.toolOutcome && typeof artifact.toolOutcome === 'object' ? artifact.toolOutcome : {};
  const toolEvidenceReceipt = normalizeToolEvidenceReceipt(artifact.toolEvidenceReceipt);
  const toolDebug = toolOutcome.debug && typeof toolOutcome.debug === 'object' ? toolOutcome.debug : {};
  const manualFallbackDebug = toolDebug.manualFallback && typeof toolDebug.manualFallback === 'object'
    ? toolDebug.manualFallback
    : {};
  const writeRescueDebug = toolDebug.writeRescue && typeof toolDebug.writeRescue === 'object'
    ? toolDebug.writeRescue
    : {};
  const executionPath = String(artifact.executionPath || artifact.context?.executionPath || '').trim() || 'llm-chat';
  const researchLedgerUpdate = artifact.researchLedgerUpdate && typeof artifact.researchLedgerUpdate === 'object'
    ? artifact.researchLedgerUpdate
    : { status: 'skipped', reason: '' };
  const researchLedgerPromptRendered = isResearchLedgerRendered(artifact);
  const researchLedgerPromptChannel = normalizePromptTruthChannel(promptTruth?.channels?.researchLedger);
  const researchLedgerPromptCandidateCount = researchLedgerPromptChannel.candidateCount;
  const researchLedgerPromptRenderedCount = researchLedgerPromptChannel.renderedCount;
  const researchLedgerPromptHoldbackReason = researchLedgerPromptChannel.heldBackReason;
  const researchLedgerPromptState = summarizeResearchLedgerPromptState(researchLedgerPromptChannel, researchLedgerPromptRendered);
  const advisoryItemsRendered = renderedAdvisoryCount(authorityPressure, 'items');
  const advisoryChannelsRendered = renderedAdvisoryCount(authorityPressure, 'channels');
  const researchLedgerPromptDetail = researchLedgerPromptState === 'rendered'
    ? `${Math.max(1, researchLedgerPromptRenderedCount)} research continuity topic${Math.max(1, researchLedgerPromptRenderedCount) === 1 ? '' : 's'} rendered into the prompt.`
    : (researchLedgerPromptState === 'held_back'
      ? `Candidate ledger context was held back${researchLedgerPromptHoldbackReason ? ` (${researchLedgerPromptHoldbackReason})` : ''}.`
      : (researchLedgerPromptState === 'candidate'
        ? `${researchLedgerPromptCandidateCount} candidate research continuity topic${researchLedgerPromptCandidateCount === 1 ? '' : 's'} were not rendered into the prompt.`
        : (researchLedgerPromptState === 'disabled'
          ? (researchLedgerPromptCandidateCount > 0
            ? `Research-ledger prompt channel was disabled for this turn; ${researchLedgerPromptCandidateCount} candidate topic${researchLedgerPromptCandidateCount === 1 ? '' : 's'} were not rendered.`
            : 'Research-ledger prompt channel was disabled for this turn.')
          : (researchLedgerPromptState === 'ineligible'
            ? 'Research-ledger prompt channel was ineligible for this turn.'
            : (researchLedgerPromptState === 'unavailable'
              ? 'Research-ledger prompt channel was unavailable for this turn.'
              : (researchLedgerPromptState === 'no_candidate'
                ? 'No research-ledger prompt candidates were selected for this turn.'
                : 'Research-ledger prompt state is unknown for this turn.'))))));
  const promptTruthBits = ['stableFacts', 'memoryBooks', 'sessionArchive', 'globalArchive', 'researchLedger']
    .map((channelKey) => summarizePromptTruthChannel(channelKey, promptTruth?.channels?.[channelKey]))
    .filter(Boolean);
  const modelUsage = String(readiness.modelUsage || 'used').trim() === 'not-used' ? 'not-used' : 'used';
  const modelTimingText = modelUsage === 'not-used'
    ? 'not used'
    : formatDurationMs(performance.modelRoundTrip?.durationMs || 0);
  const toolLabels = Array.isArray(modelAdvisory.toolsUsed)
    ? modelAdvisory.toolsUsed
        .map((item) => String(item?.label || item?.name || '').trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const evidencePreview = evidence.slice(0, 3).map((item) => {
    const source = String(item?.source || 'runtime').trim();
    const label = String(item?.label || item?.type || 'evidence').trim();
    const text = String(item?.text || item?.target || '').trim();
    return [source, label, text].filter(Boolean).join(' - ');
  }).filter(Boolean);
  const artifactPreview = artifacts.slice(0, 3).map((item) => {
    const type = String(item?.type || 'artifact').trim();
    const value = String(item?.value || '').trim();
    return [type, value].filter(Boolean).join(': ');
  }).filter(Boolean);
  const cleanupSummary = cleanup.reconstructedReply
    ? (cleanup.usedReasoningFallback ? 'reconstructed from reasoning spill' : 'reconstructed from cleanup salvage')
    : (cleanup.cleanupApplied
      ? (cleanup.materialChange ? 'material cleanup' : 'strip-only cleanup')
      : 'no meaningful cleanup');
  const cleanupBits = [];
  if (cleanup.reasonCode) cleanupBits.push(`reason ${cleanup.reasonCode}`);
  if (cleanup.usedReasoningFallback) cleanupBits.push('reasoning fallback');
  if (!cleanup.cleanupApplied) cleanupBits.push('reply passed through cleanly');
  const cleanupTransformBits = [];
  if (cleanupTransform.scope) cleanupTransformBits.push(cleanupTransform.scope);
  if (cleanupTransform.materiality) cleanupTransformBits.push(`materiality ${cleanupTransform.materiality}`);
  if (Array.isArray(cleanupTransform.operations) && cleanupTransform.operations.length) {
    cleanupTransformBits.push(cleanupTransform.operations.slice(0, 4).join(', '));
  }
  const canonicalSummary = authorityPressure.canonicalFactsPresent ? 'canon present' : 'canon silent';
  const overrideSummary = authorityPressure.canonicalOverrideActive ? 'override active' : 'override idle';
  const promptSlotDetails = Array.isArray(promptComposition.slots)
    ? promptComposition.slots
        .filter((slot) => slot && slot.eligible)
        .slice(0, 5)
        .map((slot) => `${slot.id}:${slot.state}`)
    : [];
  const approximateBits = [];
  if (approximatePath.policyMode) approximateBits.push(approximatePath.policyMode);
  if (Array.isArray(approximatePath.reasons) && approximatePath.reasons.length) {
    approximateBits.push(approximatePath.reasons.slice(0, 4).join(', '));
  }
  const reasoningBits = [];
  if (reasoningPolicy.executionPreference) reasoningBits.push(`preference ${reasoningPolicy.executionPreference}`);
  if (reasoningPolicy.verifierUsed === true) reasoningBits.push('verifier used');
  if (reasoningPolicy.shortCircuitApplied === true) {
    reasoningBits.push(`short circuit ${reasoningPolicy.shortCircuitReason || 'applied'}`);
  }
  if (Array.isArray(reasoningPolicy.reasonCodes) && reasoningPolicy.reasonCodes.length) {
    reasoningBits.push(reasoningPolicy.reasonCodes.slice(0, 4).join(', '));
  }
  const toolDebugBits = [];
  if (manualFallbackDebug.used === true) {
    toolDebugBits.push(`manual fallback ${manualFallbackDebug.lastPlannerStatus || 'used'}`);
    if (manualFallbackDebug.reasonCode) toolDebugBits.push(`reason ${manualFallbackDebug.reasonCode}`);
    if (manualFallbackDebug.lastDecisionTool) toolDebugBits.push(`last tool ${manualFallbackDebug.lastDecisionTool}`);
    if (manualFallbackDebug.lastDecisionError) toolDebugBits.push(manualFallbackDebug.lastDecisionError);
    if (manualFallbackDebug.lastAssistantText) toolDebugBits.push(`planner "${manualFallbackDebug.lastAssistantText}"`);
  }
  if (writeRescueDebug.attempted === true) {
    toolDebugBits.push(`rescue ${writeRescueDebug.phase || 'write-rescue'} ${writeRescueDebug.status || 'attempted'}`);
    if (writeRescueDebug.tool) toolDebugBits.push(`tool ${writeRescueDebug.tool}`);
    if (writeRescueDebug.argsPath) toolDebugBits.push(`path ${writeRescueDebug.argsPath}`);
    if (writeRescueDebug.parseError) toolDebugBits.push(writeRescueDebug.parseError);
    if (writeRescueDebug.assistantText) toolDebugBits.push(`reply "${writeRescueDebug.assistantText}"`);
  }
  const advisoryMergeBits = [];
  if (Array.isArray(advisoryMerge.mergeBasis) && advisoryMerge.mergeBasis.length) {
    advisoryMergeBits.push(`basis ${advisoryMerge.mergeBasis.slice(0, 3).join(', ')}`);
  }
  if (Array.isArray(advisoryMerge.discardedDetailSummary) && advisoryMerge.discardedDetailSummary.length) {
    advisoryMergeBits.push(`discarded ${advisoryMerge.discardedDetailSummary.slice(0, 2).join(', ')}`);
  }
  const toolEvidenceSummary = toolEvidenceReceipt?.summary || null;
  const toolEvidenceBits = toolEvidenceSummary
    ? [
      `tool records ${toolEvidenceSummary.toolRecordCount}`,
      `prompt-visible ${toolEvidenceSummary.promptVisibleItemCount}`,
      `deterministic-only ${toolEvidenceSummary.deterministicOnlyItemCount}`,
      `provenance-only ${toolEvidenceSummary.provenanceOnlyItemCount}`,
      `raw json ${toolEvidenceSummary.rawJsonItemCount}`,
      `multi-hop ${toolEvidenceSummary.multiHopItemCount}`,
      toolEvidenceSummary.unknownItemCount > 0 ? `unknown ${toolEvidenceSummary.unknownItemCount}` : '',
      'runtime artifact receipt only; not a PromptTruth channel',
    ].filter(Boolean)
    : ['No tool-evidence receipt recorded for this turn.', 'runtime artifact receipt only; not a PromptTruth channel'];
  return `
    <div class="list-item">
      <div class="memory-copy">
        Artifact: <strong>${escapeHtmlFn(artifact.version || 'unknown')}</strong> &middot; Kind: <strong>${escapeHtmlFn(artifact.kind || 'unknown')}</strong> &middot; Scope: <strong>${escapeHtmlFn(scope.requestedMode || 'local')}</strong>/<strong>${escapeHtmlFn(scope.selectedLane || 'chat')}</strong> &middot; Execution <strong>${escapeHtmlFn(executionPath)}</strong>
        <small>${escapeHtmlFn(summary.text || 'No artifact summary available.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Authority: reply ${escapeHtmlFn(authority.reply || 'unknown')} &middot; memory ${escapeHtmlFn(authority.memory || 'unknown')} &middot; archive ${escapeHtmlFn(authority.archive || 'unknown')}
        <small>${escapeHtmlFn(reasonCodes.join(', ') || 'No reason codes recorded.')}</small>
      </div>
    </div>
    ${(manualFallbackDebug.used === true || writeRescueDebug.attempted === true)
      ? `<div class="list-item"><div class="memory-copy">Write debug: <strong>${escapeHtmlFn(toolOutcome.failureReason || 'observed')}</strong><small>${escapeHtmlFn(toolDebugBits.join(' | ') || 'No write-debug details were recorded.')}</small></div></div>`
      : ''}
    <div class="list-item">
      <div class="memory-copy">
        Visible reply cleanup: <strong>${escapeHtmlFn(cleanupSummary)}</strong>
        <small>${escapeHtmlFn(cleanupBits.join(' | ') || 'No cleanup metadata recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Cleanup transform: <strong>${escapeHtmlFn(cleanupTransform.class || 'pass-through')}</strong> &middot; idempotent ${escapeHtmlFn(cleanupTransform.idempotent === false ? 'no' : 'yes')}
        <small>${escapeHtmlFn(cleanupTransformBits.join(' | ') || 'Presentation cleanup stayed on the pass-through path.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Authority pressure: <strong>${escapeHtmlFn(canonicalSummary)}</strong> &middot; ${escapeHtmlFn(overrideSummary)} &middot; advisory rendered ${escapeHtmlFn(String(advisoryItemsRendered))} item(s) across ${escapeHtmlFn(String(advisoryChannelsRendered))} channel(s)
        <small>${escapeHtmlFn(`same session rendered ${Number(authorityPressure.sameSessionAdvisoryItems || 0)} | cross session rendered ${Number(authorityPressure.crossSessionAdvisoryItems || 0)}`)}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Prompt composition: <strong>${escapeHtmlFn(promptComposition.lane || 'chat')}</strong>/<strong>${escapeHtmlFn(promptComposition.mode || 'local')}</strong> &middot; filled ${escapeHtmlFn(String(Number(promptComposition.filledSlotCount || 0)))} of ${escapeHtmlFn(String(Number(promptComposition.eligibleSlotCount || 0)))}
        <small>${escapeHtmlFn(promptSlotDetails.join(' | ') || 'No prompt-slot summary recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Prompt truth: <strong>${escapeHtmlFn(promptTruth.canonicalOverrideActive ? 'canon-first holdback' : (promptTruth.canonicalFactsPresent ? 'canon rendered' : 'canon silent'))}</strong>
        <small>${escapeHtmlFn(promptTruthBits.join(' | ') || 'No prompt-truth receipt recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Tool evidence receipt: <strong>${escapeHtmlFn(toolEvidenceSummary ? `${toolEvidenceSummary.itemCount} item(s)` : 'none')}</strong>
        <small>${escapeHtmlFn(toolEvidenceBits.join(' | '))}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Reasoning policy: <strong>${escapeHtmlFn(reasoningPolicy.mode || 'unknown')}</strong> &middot; latency ${escapeHtmlFn(reasoningPolicy.sourceLatencyClass || approximatePath.latencyClass || 'casual-companion')}
        <small>${escapeHtmlFn(reasoningBits.join(' | ') || 'No reasoning-policy receipt recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Approximate path: <strong>${escapeHtmlFn(approximatePath.status || 'exact')}</strong> &middot; latency ${escapeHtmlFn(approximatePath.latencyClass || 'casual-companion')}
        <small>${escapeHtmlFn(approximateBits.join(' | ') || (approximatePath.policyNote || 'No approximate-path metadata recorded.'))}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Advisory merge: <strong>${escapeHtmlFn(String(Number(advisoryMerge.advisoryItems || 0)))}</strong> item(s) &middot; lossy ${escapeHtmlFn(String(Number(advisoryMerge.lossyItems || 0)))} &middot; review-gated ${escapeHtmlFn(String(Number(advisoryMerge.reviewGatedItems || 0)))}
        <small>${escapeHtmlFn(advisoryMergeBits.join(' | ') || 'No advisory-merge summary recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Latency class: <strong>${escapeHtmlFn(performance.latencyClass || 'casual-companion')}</strong> &middot; Request ${escapeHtmlFn(formatDurationMs(performance.request?.durationMs || 0))} &middot; Model ${escapeHtmlFn(modelTimingText)}
        <small>${escapeHtmlFn(`Prompt ${formatDurationMs(performance.promptAssembly?.durationMs || 0)} · Archive ${formatDurationMs(performance.archiveRetrieval?.durationMs || 0)} · First token ${performance.firstToken?.available ? formatDurationMs(performance.firstToken?.durationMs || 0) : 'n/a'}`)}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Readiness: <strong>${escapeHtmlFn(readiness.warmState || 'cold')}</strong> &middot; model ${escapeHtmlFn(modelUsage)} &middot; chat ${escapeHtmlFn(readiness.chatModelReady ? 'ready' : 'pending')} &middot; tool ${escapeHtmlFn(readiness.toolModelReady ? 'ready' : 'pending')} &middot; embeddings ${escapeHtmlFn(readiness.embeddingReady ? 'ready' : 'fallback')}
        <small>${escapeHtmlFn(Number.isFinite(Number(readiness.cacheAgeMs)) ? formatCacheAge(readiness.cacheAgeMs) : 'No cache age recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Research ledger prompt: <strong>${escapeHtmlFn(researchLedgerPromptState)}</strong> &middot; Post-reply ledger update <strong>${escapeHtmlFn(researchLedgerUpdate.status || 'skipped')}</strong>
        <small>${escapeHtmlFn([researchLedgerPromptDetail, researchLedgerUpdate.reason || ''].filter(Boolean).join(' | ') || 'No research-ledger update details were recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Epistemic caution: <strong>${escapeHtmlFn(epistemics.enabled ? (epistemics.triggered ? `triggered (${epistemics.stance || 'answer'})` : 'enabled, idle') : 'off')}</strong>
        <small>${escapeHtmlFn((Array.isArray(epistemics.signals) && epistemics.signals.length ? epistemics.signals.join(', ') : (epistemics.note || 'No caution signals recorded.')) || 'No caution signals recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Archive synthesis: <strong>${escapeHtmlFn(synthesis.enabled ? (synthesis.generated ? 'generated' : 'enabled, idle') : 'off')}</strong>
        <small>${escapeHtmlFn(synthesis.summary || 'No archive synthesis summary recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Evidence items: ${escapeHtmlFn(String(evidence.length))} &middot; Artifacts: ${escapeHtmlFn(String(artifacts.length))} &middot; Side effects: ${escapeHtmlFn(String(sideEffects.length))}
        <small>${escapeHtmlFn(evidencePreview.join(' | ') || 'No evidence preview recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Tool labels: ${escapeHtmlFn(toolLabels.join(', ') || 'none recorded')}
        <small>${escapeHtmlFn(artifactPreview.join(' | ') || (modelAdvisory.repair?.repairAttempted ? 'Repair metadata recorded.' : 'No repair metadata recorded.'))}</small>
      </div>
    </div>
  `;
}

function renderTraceArtifactSummary(artifact = null, escapeHtmlFn = escapeHtml) {
  const trace = artifact?.trace && typeof artifact.trace === 'object' ? artifact.trace : null;
  if (!trace) {
    return '<div class="list-item"><div class="memory-copy">No trace artifact details are available for the last turn yet.</div></div>';
  }
  const laneChoice = trace.laneChoice && typeof trace.laneChoice === 'object' ? trace.laneChoice : {};
  const reasoningPolicy = trace.reasoningPolicy && typeof trace.reasoningPolicy === 'object'
    ? trace.reasoningPolicy
    : (artifact?.modelAdvisory?.reasoningPolicy && typeof artifact.modelAdvisory.reasoningPolicy === 'object'
      ? artifact.modelAdvisory.reasoningPolicy
      : {});
  const wakeHierarchy = Array.isArray(trace.wakeHierarchy) ? trace.wakeHierarchy : [];
  const retrievalChannels = Array.isArray(trace.retrievalChannels) ? trace.retrievalChannels : [];
  const contradictions = Array.isArray(trace.contradictions) ? trace.contradictions : [];
  const openQuestions = Array.isArray(trace.openQuestions) ? trace.openQuestions : [];
  const ongoingInvestigations = Array.isArray(trace.ongoingInvestigations) ? trace.ongoingInvestigations : [];
  const evidenceAccepted = Array.isArray(trace.evidenceAccepted) ? trace.evidenceAccepted : [];
  const evidenceRejected = Array.isArray(trace.evidenceRejected) ? trace.evidenceRejected : [];
  const qaValidity = trace.qaValidity && typeof trace.qaValidity === 'object' ? trace.qaValidity : { active: false, verdict: 'n/a', reasons: [] };
  const wakeSummary = wakeHierarchy
    .slice(0, 5)
    .map((item) => {
      const countText = Number(item?.count || 0) > 0 ? ` (${Number(item.count)})` : '';
      return `${item?.label || item?.layer || 'trace'}: ${item?.status || 'noted'}${countText}`;
    })
    .filter(Boolean);
  const retrievalSummary = retrievalChannels
    .slice(0, 4)
    .map((item) => `${item?.channel || 'archive'}:${isRetrievalTraceRendered(item) ? 'rendered' : 'not-rendered'}:${item?.sourceLabel || item?.sourceId || 'source'}`)
    .filter(Boolean);
  const contradictionSummary = contradictions
    .slice(0, 2)
    .map((item) => `${item?.label || 'correction'}: ${item?.detail || ''}`)
    .filter(Boolean);
  const openQuestionSummary = openQuestions
    .slice(0, 2)
    .map((item) => `${item?.status || 'open'}: ${item?.detail || ''}`)
    .filter(Boolean);
  const investigationSummary = ongoingInvestigations
    .slice(0, 2)
    .map((item) => `${item?.label || 'investigation'}: ${item?.detail || item?.status || ''}`)
    .filter(Boolean);
  const acceptedSummary = evidenceAccepted
    .slice(0, 3)
    .map((item) => `${item?.channel || item?.type || 'trace'} - ${item?.label || 'entry'}${item?.detail ? ` - ${item.detail}` : ''}`)
    .filter(Boolean);
  const rejectedSummary = evidenceRejected
    .slice(0, 3)
    .map((item) => `${item?.channel || item?.type || 'trace'} - ${item?.label || 'entry'}${item?.detail ? ` - ${item.detail}` : ''}`)
    .filter(Boolean);
  const reasoningSummary = [
    reasoningPolicy.mode ? `mode ${reasoningPolicy.mode}` : '',
    reasoningPolicy.sourceLatencyClass ? `latency ${reasoningPolicy.sourceLatencyClass}` : '',
    reasoningPolicy.executionPreference ? `preference ${reasoningPolicy.executionPreference}` : '',
    reasoningPolicy.verifierUsed === true ? 'verifier used' : '',
    reasoningPolicy.shortCircuitApplied === true
      ? `short circuit ${reasoningPolicy.shortCircuitReason || 'applied'}`
      : '',
    Array.isArray(reasoningPolicy.reasonCodes) && reasoningPolicy.reasonCodes.length
      ? reasoningPolicy.reasonCodes.slice(0, 4).join(', ')
      : '',
  ].filter(Boolean);
  return `
    <div class="list-item">
      <div class="memory-copy">
        Trace lane: <strong>${escapeHtmlFn(laneChoice.requestedMode || 'local')}</strong>/<strong>${escapeHtmlFn(laneChoice.selectedLane || 'chat')}</strong> &middot; Backend <strong>${escapeHtmlFn(laneChoice.backend || 'unknown')}</strong>
        <small>${escapeHtmlFn(`Route ${laneChoice.route || '/api/penny/chat'} · requested ${laneChoice.requestedModel || 'n/a'} · resolved ${laneChoice.resolvedModel || 'n/a'}${laneChoice.laneFallback ? ' · lane fallback' : ''}${laneChoice.usedFallback ? ' · runtime fallback' : ''}`)}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Trace reasoning: <strong>${escapeHtmlFn(reasoningPolicy.mode || 'unknown')}</strong>
        <small>${escapeHtmlFn(reasoningSummary.join(' | ') || 'No trace reasoning-policy details were recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Wake hierarchy
        <small>${escapeHtmlFn(wakeSummary.join(' | ') || 'No wake hierarchy details were recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Retrieval channels: ${escapeHtmlFn(String(retrievalChannels.length))}
        <small>${escapeHtmlFn(retrievalSummary.join(' | ') || 'No retrieval channels were recorded.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Contradictions: ${escapeHtmlFn(String(contradictions.length))} &middot; Open questions: ${escapeHtmlFn(String(openQuestions.length))} &middot; Investigations: ${escapeHtmlFn(String(ongoingInvestigations.length))}
        <small>${escapeHtmlFn([...contradictionSummary, ...openQuestionSummary, ...investigationSummary].join(' | ') || 'No contradictions, open questions, or investigations were active.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Evidence accepted: ${escapeHtmlFn(String(evidenceAccepted.length))} &middot; Rejected: ${escapeHtmlFn(String(evidenceRejected.length))}
        <small>${escapeHtmlFn(acceptedSummary.join(' | ') || rejectedSummary.join(' | ') || 'No trace evidence ledger was recorded.')}</small>
      </div>
    </div>
    ${qaValidity.active
      ? `<div class="list-item"><div class="memory-copy">QA validity: <strong>${escapeHtmlFn(qaValidity.verdict || 'unknown')}</strong><small>${escapeHtmlFn((qaValidity.reasons || []).join(' | ') || 'No QA validity notes recorded.')}</small></div></div>`
      : ''}
  `;
}

function summarizeEvidenceRefs(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 3)
    .map((item) => item?.ref || item?.label || item?.note || '')
    .filter(Boolean)
    .join(', ');
}

function renderTraceProvenance(artifact = null, escapeHtmlFn = escapeHtml) {
  const provenance = artifact?.provenance && typeof artifact.provenance === 'object' ? artifact.provenance : null;
  if (!provenance) {
    return '<div class="list-item"><div class="memory-copy">No trace provenance details are available for the last turn yet.</div></div>';
  }
  const retrieval = Array.isArray(provenance.retrieval) ? provenance.retrieval : [];
  const contradictions = Array.isArray(provenance.contradictions) ? provenance.contradictions : [];
  const openQuestions = Array.isArray(provenance.openQuestions) ? provenance.openQuestions : [];
  const ongoingInvestigations = Array.isArray(provenance.ongoingInvestigations) ? provenance.ongoingInvestigations : [];
  const acceptedEvidence = Array.isArray(provenance.acceptedEvidence) ? provenance.acceptedEvidence : [];
  const rejectedEvidence = Array.isArray(provenance.rejectedEvidence) ? provenance.rejectedEvidence : [];
  const wakeContext = [
    contradictions.length ? `contradictions ${contradictions.slice(0, 2).map((item) => item?.label || item?.detail || 'correction').filter(Boolean).join(', ')}` : '',
    openQuestions.length ? `open ${openQuestions.slice(0, 2).map((item) => item?.detail || item?.label || 'question').filter(Boolean).join(', ')}` : '',
    ongoingInvestigations.length ? `investigations ${ongoingInvestigations.slice(0, 2).map((item) => item?.label || item?.detail || 'topic').filter(Boolean).join(', ')}` : '',
  ].filter(Boolean);
  const evidenceLedger = [
    acceptedEvidence.length ? `accepted ${acceptedEvidence.length}` : '',
    rejectedEvidence.length ? `not rendered ${rejectedEvidence.length}` : '',
  ].filter(Boolean).join(' · ');
    const retrievalRows = retrieval.slice(0, 6).map((item) => {
      const identity = [
      isRetrievalTraceRendered(item) ? 'rendered' : 'not rendered',
      item?.channel || '',
      item?.scope || '',
      item?.reason || '',
      Array.isArray(item?.sourceSessionIds) && item.sourceSessionIds.length ? `sessions ${item.sourceSessionIds.join(', ')}` : '',
      Array.isArray(item?.sourceTurnIds) && item.sourceTurnIds.length ? `turns ${item.sourceTurnIds.slice(0, 3).join(', ')}` : '',
      Array.isArray(item?.sourceEpisodeIds) && item.sourceEpisodeIds.length ? `episodes ${item.sourceEpisodeIds.slice(0, 3).join(', ')}` : '',
      summarizeEvidenceRefs(item?.evidenceRefs) ? `evidence ${summarizeEvidenceRefs(item.evidenceRefs)}` : '',
    ].filter(Boolean).join(' · ');
    return `
      <div class="list-item memory-item">
        <div class="memory-copy">
          ${escapeHtmlFn(item?.sourceLabel || item?.sourceId || item?.channel || 'source')}
          <small>${escapeHtmlFn(identity || 'No provenance identity details were recorded.')}</small>
          ${item?.snippet ? `<small>${escapeHtmlFn(item.snippet)}</small>` : ''}
        </div>
      </div>
    `;
  }).join('');
  return `
    <div class="list-item">
      <div class="memory-copy">
        Trace provenance
        <small>${escapeHtmlFn(wakeContext.join(' | ') || 'No contradiction, open-loop, or investigation context was attached to this trace.')}</small>
        ${evidenceLedger ? `<small>${escapeHtmlFn(evidenceLedger)}</small>` : ''}
      </div>
    </div>
    ${retrievalRows || '<div class="list-item"><div class="memory-copy">No retrieval provenance rows were recorded for the last turn.</div></div>'}
  `;
}

function renderResearchLedger(ledger = {}, escapeHtmlFn = escapeHtml) {
  const contextTopics = Array.isArray(ledger?.context?.topics) ? ledger.context.topics : [];
  const recentTopics = Array.isArray(ledger?.recentTopics) ? ledger.recentTopics : [];
  const items = contextTopics.length ? contextTopics : recentTopics;
  if (!items.length) {
    return '<div class="list-item"><div class="memory-copy">No research continuity topics are stored right now.</div></div>';
  }
  return items.map((item) => {
    const identity = item?.identity && typeof item.identity === 'object' ? item.identity : {};
    const evidenceCount = Array.isArray(item?.evidenceRefs) ? item.evidenceRefs.length : 0;
    const followUp = Array.isArray(item?.openFollowUps) && item.openFollowUps.length ? item.openFollowUps[0] : '';
    const detail = item?.summary || item?.conclusion || item?.question || '';
    const evidenceSummary = summarizeEvidenceRefs(item?.evidenceRefs);
    const summaryEvidenceSummary = summarizeEvidenceRefs(item?.summaryEvidenceRefs);
    const identitySummary = [
      identity.kind ? `kind ${identity.kind}` : '',
      identity.anchorRef ? `${identity.anchorType || 'anchor'}: ${identity.anchorRef}` : '',
      identity.scopeLabel ? `scope ${identity.scopeLabel}` : '',
    ].filter(Boolean).join(' Â· ');
    const truthSummary = [
      item?.sourceClass ? `source ${item.sourceClass}` : '',
      item?.summaryClass ? `summary ${item.summaryClass}` : '',
    ].filter(Boolean).join(' Â· ');
    const sourceSummary = [
      Array.isArray(item?.sourceSessionIds) && item.sourceSessionIds.length ? `sessions ${item.sourceSessionIds.join(', ')}` : '',
      Array.isArray(item?.sourceTurnIds) && item.sourceTurnIds.length ? `turns ${item.sourceTurnIds.slice(0, 3).join(', ')}` : '',
      Array.isArray(item?.contradictions) && item.contradictions.length
        ? `contradictions ${item.contradictions.map((entry) => entry?.conflictKey || entry?.newText || '').filter(Boolean).slice(0, 2).join(', ')}`
        : '',
    ].filter(Boolean).join(' · ');
    return `
      <div class="list-item memory-item">
        <div class="memory-copy">
          ${escapeHtmlFn(item?.topicLabel || item?.topicId || 'investigation')}
          <small>${escapeHtmlFn(`${item?.status || 'advisory'}${evidenceCount ? ` · evidence ${evidenceCount}` : ''}${followUp ? ` · ${followUp}` : ''}`)}</small>
          ${detail ? `<small>${escapeHtmlFn(detail)}</small>` : ''}
          ${identitySummary ? `<small>${escapeHtmlFn(identitySummary)}</small>` : ''}
          ${truthSummary ? `<small>${escapeHtmlFn(truthSummary)}</small>` : ''}
          ${evidenceSummary ? `<small>${escapeHtmlFn(`Evidence refs: ${evidenceSummary}`)}</small>` : ''}
          ${summaryEvidenceSummary ? `<small>${escapeHtmlFn(`Summary refs: ${summaryEvidenceSummary}`)}</small>` : ''}
          ${sourceSummary ? `<small>${escapeHtmlFn(`Source trail: ${sourceSummary}`)}</small>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentAuditTrail(items = [], escapeHtmlFn = escapeHtml) {
  const trail = Array.isArray(items) ? items.slice(0, 4) : [];
  if (!trail.length) {
    return '<div class="list-item"><div class="memory-copy">No recent audit slices are stored for this session yet.</div></div>';
  }
  return trail.map((item) => {
    const retrieval = item?.retrieval && typeof item.retrieval === 'object' ? item.retrieval : {};
    const promptTruth = item?.promptTruth?.channels && typeof item.promptTruth.channels === 'object'
      ? item.promptTruth.channels
      : {};
    const artifactSummary = item?.artifactSummary && typeof item.artifactSummary === 'object' ? item.artifactSummary : {};
    const ledger = item?.researchLedger && typeof item.researchLedger === 'object' ? item.researchLedger : {};
    const promptBits = ['stableFacts', 'memoryBooks', 'sessionArchive', 'globalArchive', 'researchLedger']
      .map((key) => summarizePromptTruthChannel(key, promptTruth[key]))
      .filter(Boolean);
    const retrievalIdentityBits = [
      {
        label: 'session',
        selected: retrieval.selectedSessionIds,
        rendered: retrieval.renderedSessionIds,
      },
      {
        label: 'global',
        selected: retrieval.selectedGlobalIds,
        rendered: retrieval.renderedGlobalIds,
      },
      {
        label: 'books',
        selected: retrieval.selectedBookIds,
        rendered: retrieval.renderedBookIds,
      },
      {
        label: 'ledger',
        selected: retrieval.selectedLedgerIds,
        rendered: retrieval.renderedLedgerIds,
      },
    ]
      .map((entry) => {
        const selectedCount = Array.isArray(entry.selected) ? entry.selected.length : 0;
        const renderedCount = Array.isArray(entry.rendered) ? entry.rendered.length : 0;
        if (!selectedCount && !renderedCount) return '';
        return `${entry.label} selected ${selectedCount} rendered ${renderedCount}`;
      })
      .filter(Boolean);
    const retrievalBits = [
      retrieval.mode ? `${retrieval.mode}/${retrieval.reasonCode || 'reason-unknown'}` : '',
      ...retrievalIdentityBits,
      retrieval.compression?.used ? 'compression used' : '',
      retrieval.semanticReady ? 'semantic ready' : 'keyword path',
      retrieval.semanticDowngrade ? 'semantic downgraded' : '',
    ].filter(Boolean);
    const ledgerPromptState = `ledger ${formatPromptTruthStateLabel(
      summarizeResearchLedgerPromptState(promptTruth.researchLedger, isResearchLedgerRendered(artifactSummary)),
    )}`;
    const artifactBits = [
      artifactSummary.kind ? `kind ${artifactSummary.kind}` : '',
      artifactSummary.authority?.reply ? `reply ${artifactSummary.authority.reply}` : '',
      artifactSummary.approximatePath?.status ? `approx ${artifactSummary.approximatePath.status}` : '',
      ledgerPromptState,
    ].filter(Boolean);
    const ledgerBits = [
      ledger.updateStatus ? `post-reply update ${ledger.updateStatus}` : '',
      ledger.topicLabel || ledger.topicId || '',
    ].filter(Boolean);
    return `
      <div class="list-item memory-item">
        <div class="memory-copy">
          ${escapeHtmlFn(item?.userTextExcerpt || item?.turnId || 'audit slice')}
          <small>${escapeHtmlFn(`${item?.usedAt || 'not yet'} Â· ${item?.requestedMode || 'local'}/${item?.selectedLane || 'chat'} Â· ${item?.executionPath || 'llm-chat'}`)}</small>
          <small>${escapeHtmlFn(retrievalBits.join(' | ') || 'No retrieval summary recorded.')}</small>
          <small>${escapeHtmlFn(promptBits.join(' | ') || 'No prompt-truth summary recorded.')}</small>
          <small>${escapeHtmlFn(artifactBits.join(' | ') || 'No artifact summary recorded.')}</small>
          ${ledgerBits.length ? `<small>${escapeHtmlFn(ledgerBits.join(' | '))}</small>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderActiveContradictions(items = [], escapeHtmlFn = escapeHtml) {
  if (!items.length) return `<div class="list-item"><div class="memory-copy">No active contradictions are being tracked right now.</div></div>`;
  return items.map((item) => `
    <div class="list-item memory-item">
      <div class="memory-copy">
        ${escapeHtmlFn(item.newText || '')}
        <small>replaces ${escapeHtmlFn(item.oldText || '')} &middot; ${escapeHtmlFn(item.conflictKey || 'fact')} &middot; deps ${(item.dependentEpisodeIds || []).length}/${(item.dependentChapterIds || []).length}</small>
      </div>
    </div>
  `).join('');
}

function renderCompressionExplanation(compression = {}, escapeHtmlFn = escapeHtml) {
  const explanation = compression?.explanation && typeof compression.explanation === 'object'
    ? compression.explanation
    : {};
  const bits = [];
  if (compression?.reason) bits.push(`reason: ${compression.reason}`);
  if (Array.isArray(explanation.selectedSignals) && explanation.selectedSignals.length) {
    bits.push(`signals: ${explanation.selectedSignals.join(', ')}`);
  }
  if (Array.isArray(explanation.penalties) && explanation.penalties.length) {
    bits.push(`penalties: ${explanation.penalties.join(', ')}`);
  }
  if (Number.isFinite(Number(explanation.omittedEpisodeCount)) && Number(explanation.omittedEpisodeCount) > 0) {
    bits.push(`omitted episodes: ${Number(explanation.omittedEpisodeCount)}`);
  }
  if (Array.isArray(explanation.carriedContradictions) && explanation.carriedContradictions.length) {
    bits.push(`carried contradictions: ${explanation.carriedContradictions.length}`);
  }
  if (!bits.length) return '';
  return `<div class="list-item"><div class="memory-copy"><small>${escapeHtmlFn(bits.join(' · '))}</small></div></div>`;
}

function renderRecencyProtection(recencyProtection = {}, escapeHtmlFn = escapeHtml) {
  if (!recencyProtection || recencyProtection.enabled !== true) {
    return '<div class="list-item"><div class="memory-copy">Recency protection is not active.</div></div>';
  }
  const ids = Array.isArray(recencyProtection.protectedEpisodeIds)
    ? recencyProtection.protectedEpisodeIds.slice(-4)
    : [];
  return `
    <div class="list-item">
      <div class="memory-copy">
        Recency protection keeps the newest <strong>${escapeHtmlFn(String(recencyProtection.protectedEpisodeCount || 0))}</strong> session episode(s) out of chapter compression.
        <small>${escapeHtmlFn(ids.length ? `Protected ids: ${ids.join(', ')}` : 'No protected episode ids recorded yet.')}</small>
      </div>
    </div>
  `;
}

function hasOwn(value = null, key = '') {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeLatestRetrievalSummary(value = null) {
  const source = value && typeof value === 'object' ? value : {};
  const compression = source.compression && typeof source.compression === 'object'
    ? source.compression
    : null;
  const hasRecordedSummary = [
    'mode',
    'reasonCode',
    'selectedSessionIds',
    'selectedGlobalIds',
    'selectedBookIds',
    'selectedLedgerIds',
    'renderedSessionIds',
    'renderedGlobalIds',
    'renderedBookIds',
    'renderedLedgerIds',
    'semanticReady',
    'semanticDowngrade',
  ].some((key) => hasOwn(source, key));
  return {
    mode: String(source.mode || '').trim(),
    modeRecorded: hasOwn(source, 'mode'),
    reasonCode: String(source.reasonCode || '').trim(),
    reasonCodeRecorded: hasOwn(source, 'reasonCode'),
    selectedSessionIds: Array.isArray(source.selectedSessionIds) ? source.selectedSessionIds : [],
    selectedSessionIdsRecorded: hasOwn(source, 'selectedSessionIds'),
    selectedGlobalIds: Array.isArray(source.selectedGlobalIds) ? source.selectedGlobalIds : [],
    selectedGlobalIdsRecorded: hasOwn(source, 'selectedGlobalIds'),
    selectedBookIds: Array.isArray(source.selectedBookIds) ? source.selectedBookIds : [],
    selectedBookIdsRecorded: hasOwn(source, 'selectedBookIds'),
    selectedLedgerIds: Array.isArray(source.selectedLedgerIds) ? source.selectedLedgerIds : [],
    selectedLedgerIdsRecorded: hasOwn(source, 'selectedLedgerIds'),
    renderedSessionIds: Array.isArray(source.renderedSessionIds) ? source.renderedSessionIds : [],
    renderedSessionIdsRecorded: hasOwn(source, 'renderedSessionIds'),
    renderedGlobalIds: Array.isArray(source.renderedGlobalIds) ? source.renderedGlobalIds : [],
    renderedGlobalIdsRecorded: hasOwn(source, 'renderedGlobalIds'),
    renderedBookIds: Array.isArray(source.renderedBookIds) ? source.renderedBookIds : [],
    renderedBookIdsRecorded: hasOwn(source, 'renderedBookIds'),
    renderedLedgerIds: Array.isArray(source.renderedLedgerIds) ? source.renderedLedgerIds : [],
    renderedLedgerIdsRecorded: hasOwn(source, 'renderedLedgerIds'),
    semanticReady: source.semanticReady === true ? true : (source.semanticReady === false ? false : null),
    semanticReadyRecorded: hasOwn(source, 'semanticReady'),
    semanticDowngrade: source.semanticDowngrade === true ? true : (source.semanticDowngrade === false ? false : null),
    semanticDowngradeRecorded: hasOwn(source, 'semanticDowngrade'),
    compression,
    compressionRecorded: hasOwn(source, 'compression'),
    compressionUsed: compression?.used === true ? true : (compression?.used === false ? false : null),
    hasRecordedSummary,
  };
}

function countRecordedRetrievalIds(summary = {}) {
  return [
    summary.selectedSessionIds,
    summary.selectedGlobalIds,
    summary.selectedBookIds,
    summary.selectedLedgerIds,
    summary.renderedSessionIds,
    summary.renderedGlobalIds,
    summary.renderedBookIds,
    summary.renderedLedgerIds,
  ].reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0);
}

function summarizeLatestReplyRetrievalSource(label = '', selected = [], rendered = [], recorded = false) {
  if (!recorded) return `${label} not recorded`;
  const selectedCount = Array.isArray(selected) ? selected.length : 0;
  const renderedCount = Array.isArray(rendered) ? rendered.length : 0;
  return `${label} rendered ${renderedCount} of ${selectedCount} selected`;
}

const REPLY_CONTEXT_MAP_SOURCE_LIMIT = 8;
const REPLY_CONTEXT_HISTORY_LIMIT = 4;

function normalizeReplyContextStatus(value = '') {
  const status = String(value || '').trim().toLowerCase().replaceAll('_', ' ');
  if (status === 'rendered') return 'rendered';
  if (status === 'held back' || status === 'held-back' || status === 'disabled') return 'held back';
  if (status === 'candidate') return 'candidate';
  if (status === 'fallback') return 'fallback';
  if (status === 'verified' || status === 'applied') return 'verified';
  return 'not recorded';
}

function replyContextStatusClass(status = '') {
  return normalizeReplyContextStatus(status).replace(/\s+/g, '-');
}

function normalizeReplyContextAuthority(value = 'advisory') {
  return String(value || 'advisory').trim().toLowerCase() || 'advisory';
}

function formatReplyContextText(value = '') {
  const text = String(value ?? '').trim();
  return text || 'not recorded';
}

function formatReplyContextCount(value = null) {
  return Number.isFinite(Number(value))
    ? String(Math.max(0, Number(value)))
    : 'not recorded';
}

function formatReplyContextBoolean(value = null, trueLabel = 'yes', falseLabel = 'no') {
  if (value === true) return trueLabel;
  if (value === false) return falseLabel;
  return 'not recorded';
}

function buildReplyContextMetadata(label = '', value = '') {
  return {
    label: formatReplyContextText(label),
    value: formatReplyContextText(value),
  };
}

function hasRecordedPromptTruthChannel(channel = null) {
  const source = channel && typeof channel === 'object' ? channel : null;
  if (!source) return false;
  return hasOwn(source, 'candidateCount')
    || hasOwn(source, 'renderedCount')
    || Boolean(String(source.heldBackReason || '').trim())
    || Boolean(String(source.state || '').trim());
}

function promptTruthChannelMapNode({
  id = '',
  label = '',
  authority = 'advisory',
  channel = null,
  explanation = '',
} = {}) {
  const normalized = normalizePromptTruthChannel(channel);
  const rawState = String(channel?.state || '').trim();
  const hasCounts = normalized.candidateCount > 0 || normalized.renderedCount > 0;
  const hasRecordedChannel = hasCounts || normalized.heldBackReason || rawState;
  const status = hasRecordedChannel
    ? normalizeReplyContextStatus(normalized.state)
    : 'not recorded';
  const detail = hasRecordedChannel
    ? `${normalized.renderedCount} rendered / ${normalized.candidateCount} candidate${normalized.heldBackReason ? ` | ${normalized.heldBackReason}` : ''}`
    : 'no prompt receipt recorded';
  return {
    id,
    label,
    authority,
    status,
    detail,
    explanation: formatReplyContextText(explanation),
    metadata: [
      buildReplyContextMetadata('Prompt state', hasRecordedChannel ? status : 'not recorded'),
      buildReplyContextMetadata('Candidate count', hasRecordedChannel ? formatReplyContextCount(normalized.candidateCount) : 'not recorded'),
      buildReplyContextMetadata('Rendered count', hasRecordedChannel ? formatReplyContextCount(normalized.renderedCount) : 'not recorded'),
      buildReplyContextMetadata('Holdback reason', normalized.heldBackReason || 'not recorded'),
    ],
  };
}

function normalizeReplyContextSelection(map = {}, selectedId = 'latest-reply') {
  const candidates = [map.center, ...(Array.isArray(map.nodes) ? map.nodes : [])]
    .filter(Boolean);
  const fallback = candidates[0] || {
    id: 'latest-reply',
    label: 'Latest reply',
    authority: 'runtime receipt',
    status: 'not recorded',
    detail: 'not recorded',
    explanation: 'Reply Context Map is waiting for a reply receipt.',
    metadata: [],
  };
  const requestedId = String(selectedId || '').trim();
  const selected = candidates.find((node) => node.id === requestedId) || fallback;
  return {
    ...map,
    selectedId: selected.id,
    selected,
  };
}

function buildReplyContextSnapshotRecords(viewModel = {}) {
  const recentAuditTrail = Array.isArray(viewModel?.recentAuditTrail) ? viewModel.recentAuditTrail : [];
  return recentAuditTrail.slice(0, REPLY_CONTEXT_HISTORY_LIMIT).map((audit, index) => ({
    id: `reply-snapshot-${index}`,
    latest: index === 0,
    audit: audit && typeof audit === 'object' ? audit : {},
    artifact: index === 0 && viewModel?.artifact && typeof viewModel.artifact === 'object'
      ? viewModel.artifact
      : null,
  }));
}

function normalizeReplyContextSnapshotSelection(history = {}, selectedSnapshotId = '') {
  const items = Array.isArray(history.items) ? history.items : [];
  const requestedId = String(selectedSnapshotId || '').trim();
  const selected = items.find((item) => item.id === requestedId) || items[0] || null;
  return {
    ...history,
    selectedId: selected?.id || '',
    selected,
  };
}

function summarizeReplyContextSnapshotHint(promptTruth = {}, toolEvidenceReceipt = null) {
  const stableFacts = normalizePromptTruthChannel(promptTruth?.channels?.stableFacts);
  const rawStableFacts = promptTruth?.channels?.stableFacts && typeof promptTruth.channels.stableFacts === 'object'
    ? promptTruth.channels.stableFacts
    : {};
  const hasCanonReceipt = Boolean(
    stableFacts.candidateCount
    || stableFacts.renderedCount
    || stableFacts.heldBackReason
    || String(rawStableFacts.state || '').trim(),
  );
  const advisoryStates = ['memoryBooks', 'sessionArchive', 'globalArchive', 'researchLedger']
    .map((channelKey) => {
      const normalized = normalizePromptTruthChannel(promptTruth?.channels?.[channelKey]);
      const rawChannel = promptTruth?.channels?.[channelKey] && typeof promptTruth.channels[channelKey] === 'object'
        ? promptTruth.channels[channelKey]
        : {};
      const hasReceipt = Boolean(
        normalized.candidateCount
        || normalized.renderedCount
        || normalized.heldBackReason
        || String(rawChannel.state || '').trim(),
      );
      return hasReceipt ? normalizeReplyContextStatus(normalized.state) : 'not recorded';
    });
  const parts = [];
  if (hasCanonReceipt) {
    parts.push(`canon ${normalizeReplyContextStatus(stableFacts.state)}`);
  }
  if (advisoryStates.some((state) => state === 'rendered')) {
    parts.push('advisory rendered');
  }
  if (advisoryStates.some((state) => state === 'held back')) {
    parts.push('advisory held back');
  }
  if (toolEvidenceReceipt?.summary?.itemCount > 0) {
    parts.push(`tool receipt ${toolEvidenceReceipt.summary.itemCount}`);
  }
  return parts.join(' | ') || 'not recorded';
}

export function buildReplyContextHistoryViewModel(viewModel = {}, selectedSnapshotId = '') {
  const snapshots = buildReplyContextSnapshotRecords(viewModel);
  if (!snapshots.length) {
    return normalizeReplyContextSnapshotSelection({
      available: false,
      items: [],
      omittedCount: 0,
      summary: 'Recent reply snapshots are not recorded yet.',
    }, selectedSnapshotId);
  }

  return normalizeReplyContextSnapshotSelection({
    available: true,
    items: snapshots.map((snapshot, index) => {
      const scope = snapshot.artifact?.scope && typeof snapshot.artifact.scope === 'object'
        ? snapshot.artifact.scope
        : {};
      const promptTruth = snapshot.artifact?.promptTruth && typeof snapshot.artifact.promptTruth === 'object'
        ? snapshot.artifact.promptTruth
        : (snapshot.audit?.promptTruth && typeof snapshot.audit.promptTruth === 'object' ? snapshot.audit.promptTruth : {});
      const toolEvidenceReceipt = normalizeToolEvidenceReceipt(snapshot.artifact?.toolEvidenceReceipt);
      const requestedMode = String(snapshot.audit?.requestedMode || scope.requestedMode || '').trim();
      const selectedLane = String(snapshot.audit?.selectedLane || scope.selectedLane || '').trim();
      const executionPath = String(snapshot.audit?.executionPath || snapshot.artifact?.executionPath || '').trim();
      return {
        id: snapshot.id,
        latest: snapshot.latest,
        label: snapshot.latest ? 'Latest' : `Reply ${index + 1}`,
        timestamp: formatReplyContextText(snapshot.audit?.usedAt || ''),
        turnHint: `reply ${index + 1}`,
        pathHint: `${requestedMode || 'not recorded'} / ${selectedLane || 'not recorded'} / ${executionPath || 'not recorded'}`,
        summaryHint: summarizeReplyContextSnapshotHint(promptTruth, toolEvidenceReceipt),
      };
    }),
    omittedCount: Math.max(0, (Array.isArray(viewModel?.recentAuditTrail) ? viewModel.recentAuditTrail.length : 0) - snapshots.length),
    summary: `${snapshots.length} recent reply snapshot${snapshots.length === 1 ? '' : 's'} available.`,
  }, selectedSnapshotId);
}

function pickReplyContextSummarySources(viewModel = {}, selectedSnapshotId = '') {
  const snapshots = buildReplyContextSnapshotRecords(viewModel);
  const selectedSnapshot = snapshots.find((item) => item.id === String(selectedSnapshotId || '').trim()) || snapshots[0] || null;
  const useLatestFallback = !selectedSnapshot || selectedSnapshot.latest;
  const artifact = selectedSnapshot?.artifact && typeof selectedSnapshot.artifact === 'object'
    ? selectedSnapshot.artifact
    : (useLatestFallback && viewModel?.artifact && typeof viewModel.artifact === 'object' ? viewModel.artifact : null);
  const latestAudit = selectedSnapshot?.audit && typeof selectedSnapshot.audit === 'object'
    ? selectedSnapshot.audit
    : (useLatestFallback && Array.isArray(viewModel?.recentAuditTrail) && viewModel.recentAuditTrail.length
      ? viewModel.recentAuditTrail[0]
      : null);
  const modelAdvisory = artifact?.modelAdvisory && typeof artifact.modelAdvisory === 'object'
    ? artifact.modelAdvisory
    : {};
  const promptTruth = artifact?.promptTruth && typeof artifact.promptTruth === 'object'
    ? artifact.promptTruth
    : (modelAdvisory.promptTruth && typeof modelAdvisory.promptTruth === 'object'
      ? modelAdvisory.promptTruth
      : (latestAudit?.promptTruth && typeof latestAudit.promptTruth === 'object' ? latestAudit.promptTruth : {}));
  const retrievalSource = useLatestFallback
    ? (viewModel?.session?.lastRetrieval?.summary && typeof viewModel.session.lastRetrieval.summary === 'object'
      ? viewModel.session.lastRetrieval.summary
      : (viewModel?.session?.lastRetrieval && typeof viewModel.session.lastRetrieval === 'object'
        ? viewModel.session.lastRetrieval
        : (latestAudit?.retrieval && typeof latestAudit.retrieval === 'object' ? latestAudit.retrieval : {})))
    : (latestAudit?.retrieval && typeof latestAudit.retrieval === 'object' ? latestAudit.retrieval : {});
  const routing = useLatestFallback && viewModel?.routing && typeof viewModel.routing === 'object'
    ? viewModel.routing
    : {};
  const runtimeReadiness = useLatestFallback && viewModel?.runtime?.readiness && typeof viewModel.runtime.readiness === 'object'
    ? viewModel.runtime.readiness
    : {};
  const runtimePerformance = useLatestFallback && viewModel?.runtime?.performance && typeof viewModel.runtime.performance === 'object'
    ? viewModel.runtime.performance
    : {};
  return {
    artifact,
    selectedAudit: latestAudit,
    promptTruth,
    retrieval: normalizeLatestRetrievalSummary(retrievalSource),
    routing,
    runtimeReadiness,
    runtimePerformance,
    modelAdvisory,
    toolEvidenceReceipt: normalizeToolEvidenceReceipt(artifact?.toolEvidenceReceipt),
    selectedSnapshot,
  };
}

export function buildReplyContextMapViewModel(viewModel = {}, selectedId = 'latest-reply', selectedSnapshotId = '') {
  const {
    artifact,
    selectedAudit,
    promptTruth,
    retrieval,
    routing,
    runtimeReadiness,
    runtimePerformance,
    modelAdvisory,
    toolEvidenceReceipt,
    selectedSnapshot,
  } = pickReplyContextSummarySources(viewModel, selectedSnapshotId);
  const scope = artifact?.scope && typeof artifact.scope === 'object' ? artifact.scope : {};
  const requestedMode = String(scope.requestedMode || routing.requestedMode || selectedAudit?.requestedMode || '').trim();
  const selectedLane = String(scope.selectedLane || routing.selectedLane || selectedAudit?.selectedLane || '').trim();
  const executionPath = String(artifact?.executionPath || selectedAudit?.executionPath || '').trim();
  const latencyClass = String(
    artifact?.performance?.latencyClass
    || runtimePerformance?.latencyClass
    || modelAdvisory?.reasoningPolicy?.sourceLatencyClass
    || '',
  ).trim();
  const hasLatestReplyContext = Boolean(
    artifact
    || selectedAudit
    || requestedMode
    || selectedLane
    || executionPath
    || latencyClass
    || runtimeReadiness?.warmState
    || countRecordedRetrievalIds(retrieval)
  );
  const selectedReplyLabel = selectedSnapshot && !selectedSnapshot.latest ? 'Selected reply' : 'Latest reply';
  const selectedReplyExplanation = selectedSnapshot && !selectedSnapshot.latest
    ? 'This node appears because the inspector can summarize the selected reply route from existing audit receipts.'
    : 'This node appears because the inspector can summarize the newest reply route from existing runtime and audit receipts.';

  if (!hasLatestReplyContext) {
    return normalizeReplyContextSelection({
      available: false,
      center: {
        id: 'latest-reply',
        label: 'Latest reply',
        authority: 'runtime receipt',
        status: 'not recorded',
        detail: 'waiting for a route receipt',
        explanation: 'This node appears because the inspector can summarize the newest reply route only when a runtime or audit receipt is available.',
        metadata: [
          buildReplyContextMetadata('Requested mode', 'not recorded'),
          buildReplyContextMetadata('Selected lane', 'not recorded'),
          buildReplyContextMetadata('Execution path', 'not recorded'),
          buildReplyContextMetadata('Latency class', 'not recorded'),
        ],
      },
      nodes: [],
      omittedCount: 0,
      summary: 'Reply Context Map is waiting for a reply receipt.',
    }, selectedId);
  }

  const channels = promptTruth?.channels || {};
  const retrievalPath = retrieval.semanticReady ? 'semantic path' : 'keyword path';
  const retrievalStatus = retrieval.semanticReady ? 'verified' : 'fallback';
  const researchLedgerPromptChannel = normalizePromptTruthChannel(channels.researchLedger);
  const researchLedgerUpdate = artifact?.researchLedgerUpdate && typeof artifact.researchLedgerUpdate === 'object'
    ? artifact.researchLedgerUpdate
    : {
        status: String(selectedAudit?.researchLedger?.updateStatus || '').trim(),
        reason: '',
      };
  const ledgerUpdateStatus = normalizeReplyContextStatus(researchLedgerUpdate.status === 'applied'
    ? 'verified'
    : (researchLedgerPromptChannel.state || researchLedgerUpdate.status));
  const toolEvidenceSummary = toolEvidenceReceipt?.summary || null;
  const nodes = [
    promptTruthChannelMapNode({
      id: 'explicit-facts',
      label: 'Explicit facts',
      authority: 'canonical',
      channel: channels.stableFacts,
      explanation: 'This node appears because prompt-time receipts track whether canonical explicit facts rendered into the latest reply context.',
    }),
    promptTruthChannelMapNode({
      id: 'memory-books',
      label: 'Memory books',
      authority: 'advisory',
      channel: channels.memoryBooks,
      explanation: 'This node appears because prompt-time receipts separately track advisory memory-book context from canonical explicit facts.',
    }),
    promptTruthChannelMapNode({
      id: 'session-archive',
      label: 'Session archive',
      authority: 'advisory',
      channel: channels.sessionArchive,
      explanation: 'This node appears because prompt-time receipts record whether advisory session-archive context was selected and rendered for the reply.',
    }),
    promptTruthChannelMapNode({
      id: 'global-archive',
      label: 'Global archive',
      authority: 'advisory',
      channel: channels.globalArchive,
      explanation: 'This node appears because prompt-time receipts record whether longer-range advisory archive context rendered for the reply.',
    }),
    promptTruthChannelMapNode({
      id: 'research-ledger',
      label: 'Research ledger',
      authority: 'advisory',
      channel: channels.researchLedger,
      explanation: 'This node appears because prompt-time receipts track research-ledger context separately from the later post-reply ledger update.',
    }),
    {
      id: 'retrieval-path',
      label: 'Retrieval path',
      authority: 'candidate',
      status: retrievalStatus,
      detail: `${retrievalPath}${retrieval.semanticDowngrade ? ' | semantic downgraded' : ''}${retrieval.reasonCode ? ` | ${retrieval.reasonCode}` : ''}`,
      explanation: 'This node appears because the latest retrieval summary records which archive retrieval path ran for the reply and whether it downgraded to fallback behavior.',
      metadata: [
        buildReplyContextMetadata('Path', retrievalPath),
        buildReplyContextMetadata('Semantic ready', formatReplyContextBoolean(retrieval.semanticReady)),
        buildReplyContextMetadata('Semantic downgraded', formatReplyContextBoolean(retrieval.semanticDowngrade)),
        buildReplyContextMetadata('Reason code', retrieval.reasonCode || 'not recorded'),
      ],
    },
    {
      id: 'tool-evidence',
      label: 'Tool evidence',
      authority: 'runtime receipt',
      status: toolEvidenceSummary?.itemCount > 0 ? 'verified' : 'not recorded',
      detail: toolEvidenceSummary?.itemCount > 0
        ? `${toolEvidenceSummary.itemCount} receipt item(s); not PromptTruth`
        : 'no runtime receipt recorded',
      explanation: 'This node appears because the runtime artifact can carry a sibling tool-evidence receipt that stays separate from PromptTruth.',
      metadata: [
        buildReplyContextMetadata('Receipt items', toolEvidenceSummary ? formatReplyContextCount(toolEvidenceSummary.itemCount) : 'not recorded'),
        buildReplyContextMetadata('Prompt-visible items', toolEvidenceSummary ? formatReplyContextCount(toolEvidenceSummary.promptVisibleItemCount) : 'not recorded'),
        buildReplyContextMetadata('Deterministic-only items', toolEvidenceSummary ? formatReplyContextCount(toolEvidenceSummary.deterministicOnlyItemCount) : 'not recorded'),
        buildReplyContextMetadata('Provenance-only items', toolEvidenceSummary ? formatReplyContextCount(toolEvidenceSummary.provenanceOnlyItemCount) : 'not recorded'),
      ],
    },
    {
      id: 'post-reply-ledger',
      label: 'Post-reply ledger',
      authority: 'advisory',
      status: ledgerUpdateStatus,
      detail: `prompt ${normalizeReplyContextStatus(researchLedgerPromptChannel.state)} | update ${researchLedgerUpdate.status || 'not recorded'}`,
      explanation: 'This node appears because the inspector keeps prompt-time research-ledger rendering separate from the later post-reply ledger update receipt.',
      metadata: [
        buildReplyContextMetadata('Prompt state', normalizeReplyContextStatus(researchLedgerPromptChannel.state)),
        buildReplyContextMetadata('Prompt holdback reason', researchLedgerPromptChannel.heldBackReason || 'not recorded'),
        buildReplyContextMetadata('Update status', researchLedgerUpdate.status || 'not recorded'),
        buildReplyContextMetadata('Update reason', researchLedgerUpdate.reason || 'not recorded'),
      ],
    },
  ];
  const visibleNodes = nodes.slice(0, REPLY_CONTEXT_MAP_SOURCE_LIMIT);
  const recordedCount = visibleNodes.filter((node) => node.status !== 'not recorded').length;

  return normalizeReplyContextSelection({
    available: true,
    center: {
      id: 'latest-reply',
      label: selectedReplyLabel,
      authority: 'runtime receipt',
      status: hasLatestReplyContext ? 'verified' : 'not recorded',
      detail: [requestedMode || 'mode not recorded', selectedLane || 'lane not recorded', executionPath || 'path not recorded']
        .join(' / '),
      explanation: selectedReplyExplanation,
      metadata: [
        buildReplyContextMetadata('Requested mode', requestedMode || 'not recorded'),
        buildReplyContextMetadata('Selected lane', selectedLane || 'not recorded'),
        buildReplyContextMetadata('Execution path', executionPath || 'not recorded'),
        buildReplyContextMetadata('Latency class', latencyClass || 'not recorded'),
      ],
    },
    nodes: visibleNodes,
    omittedCount: Math.max(0, nodes.length - visibleNodes.length),
    summary: `${recordedCount} of ${visibleNodes.length} context surfaces recorded for this reply.`,
  }, selectedId);
}

function renderReplyContextHistory(history = {}, escapeHtmlFn = escapeHtml) {
  if (!history.available) {
    return `
      <div class="reply-context-history empty">
        <div class="memory-copy">
          ${renderScopedSectionHeading('Recent reply snapshots', 'Selected snapshot', escapeHtmlFn)}
          <small>${escapeHtmlFn(history.summary || 'Recent reply snapshots are not recorded yet.')}</small>
        </div>
      </div>
    `;
  }
  return `
    <div class="reply-context-history" data-reply-context-snapshot-selected-id="${escapeHtmlFn(history.selectedId || '')}">
      <div class="reply-context-history-heading">
        <div>
          ${renderScopedSectionHeading('Recent reply snapshots', 'Selected snapshot', escapeHtmlFn)}
          <small>${escapeHtmlFn(`${history.summary}${history.omittedCount ? ` ${history.omittedCount} older snapshot(s) hidden by the compact cap.` : ''}`)}</small>
        </div>
      </div>
      <div class="reply-context-history-strip" aria-label="Recent reply snapshots">
        ${history.items.map((item) => `
          <button
            class="reply-context-snapshot${item.id === history.selectedId ? ' is-selected' : ''}"
            type="button"
            data-reply-context-snapshot-id="${escapeHtmlFn(item.id || '')}"
            aria-pressed="${item.id === history.selectedId ? 'true' : 'false'}"
          >
            <span class="reply-context-snapshot-title">${escapeHtmlFn(item.label || 'Reply')}</span>
            <span class="reply-context-snapshot-meta">${escapeHtmlFn(`${item.timestamp || 'not recorded'} | ${item.turnHint || 'not recorded'}`)}</span>
            <span class="reply-context-snapshot-path">${escapeHtmlFn(item.pathHint || 'not recorded')}</span>
            <span class="reply-context-snapshot-summary">${escapeHtmlFn(item.summaryHint || 'not recorded')}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderReplyContextNode(node = {}, selectedId = 'latest-reply', escapeHtmlFn = escapeHtml, center = false) {
  const status = normalizeReplyContextStatus(node.status);
  const authority = normalizeReplyContextAuthority(node.authority);
  const selected = String(node.id || '').trim() === String(selectedId || '').trim();
  const className = center ? 'reply-context-center' : 'reply-context-node';
  return `
    <button
      class="${className} status-${escapeHtmlFn(replyContextStatusClass(status))} authority-${escapeHtmlFn(authority.replace(/\s+/g, '-'))}${selected ? ' is-selected' : ''}"
      type="button"
      data-reply-context-node-id="${escapeHtmlFn(node.id || '')}"
      aria-pressed="${selected ? 'true' : 'false'}"
    >
      ${center ? '' : '<span class="reply-context-edge" aria-hidden="true"></span>'}
      <span class="reply-context-node-label">${escapeHtmlFn(node.label || 'Context')}</span>
      <span class="reply-context-node-meta">${escapeHtmlFn(`${authority} | ${status}`)}</span>
      <span class="reply-context-node-detail">${escapeHtmlFn(node.detail || 'not recorded')}</span>
    </button>
  `;
}

function renderReplyContextDetails(node = {}, escapeHtmlFn = escapeHtml) {
  const authority = normalizeReplyContextAuthority(node.authority);
  const status = normalizeReplyContextStatus(node.status);
  const metadata = Array.isArray(node.metadata) ? node.metadata : [];
  return `
    <div class="reply-context-details" id="replyContextDetails" data-reply-context-details-id="${escapeHtmlFn(node.id || '')}">
      <div class="reply-context-details-heading">
        <div>
          ${renderScopedSectionHeading('Reply Context Details', 'Selected snapshot', escapeHtmlFn)}
          <div class="reply-context-details-title">${escapeHtmlFn(node.label || 'Context')}</div>
        </div>
        <div class="reply-context-details-badges">
          <span class="reply-context-pill authority-${escapeHtmlFn(authority.replace(/\s+/g, '-'))}">${escapeHtmlFn(authority)}</span>
          <span class="reply-context-pill status-${escapeHtmlFn(replyContextStatusClass(status))}">${escapeHtmlFn(status)}</span>
        </div>
      </div>
      <div class="reply-context-details-copy">${escapeHtmlFn(node.explanation || 'This node appears because the inspector recorded it for the latest reply context.')}</div>
      <div class="reply-context-details-grid">
        ${metadata.length
          ? metadata.map((item) => `
            <div class="reply-context-detail-item">
              <small>${escapeHtmlFn(item.label || 'Detail')}</small>
              <strong>${escapeHtmlFn(item.value || 'not recorded')}</strong>
            </div>
          `).join('')
          : `
            <div class="reply-context-detail-item">
              <small>Detail</small>
              <strong>not recorded</strong>
            </div>
          `}
      </div>
    </div>
  `;
}

function renderReplyContextMap(map = {}, escapeHtmlFn = escapeHtml) {
  if (!map.available) {
    return `
      <div class="list-item reply-context-map empty">
        <div class="memory-copy">
          ${renderScopedSectionHeading('Reply Context Map', 'Selected snapshot', escapeHtmlFn)}
          <small>${escapeHtmlFn(map.summary)}</small>
        </div>
      </div>
    `;
  }
  return `
    <div class="reply-context-map" aria-label="Reply Context Map" data-reply-context-selected-id="${escapeHtmlFn(map.selectedId || 'latest-reply')}">
      <div class="reply-context-map-heading">
        <div>
          ${renderScopedSectionHeading('Reply Context Map', 'Selected snapshot', escapeHtmlFn)}
          <small>${escapeHtmlFn(`${map.summary}${map.omittedCount ? ` ${map.omittedCount} extra surface(s) hidden by the compact map cap.` : ''}`)}</small>
        </div>
      </div>
      <div class="reply-context-core">
        ${renderReplyContextNode(map.center, map.selectedId, escapeHtmlFn, true)}
        <div class="reply-context-nodes">
          ${map.nodes.map((node) => renderReplyContextNode(node, map.selectedId, escapeHtmlFn)).join('')}
        </div>
      </div>
      ${renderReplyContextDetails(map.selected, escapeHtmlFn)}
      <small class="reply-context-footnote">Inspector-only view. It does not write memory, rank memories, or add a PromptTruth/toolEvidenceReceipt channel.</small>
    </div>
  `;
}

function bindReplyContextSelection(els = {}, inspector = null, escapeHtmlFn = escapeHtml) {
  const panel = els.memoryInspectorPanel;
  if (!panel || typeof panel.addEventListener !== 'function' || panel.__replyContextSelectionBound) return;
  panel.__replyContextSelectionBound = true;
  panel.addEventListener('click', (event) => {
    const snapshotButton = event?.target?.closest?.('[data-reply-context-snapshot-id]');
    if (snapshotButton) {
      const nextSnapshotId = String(snapshotButton.dataset?.replyContextSnapshotId || '').trim();
      if (!nextSnapshotId) return;
      panel.__replyContextSnapshotId = nextSnapshotId;
      if (panel.dataset) panel.dataset.replyContextSnapshotId = nextSnapshotId;
      const scrollTop = typeof panel.scrollTop === 'number' ? panel.scrollTop : null;
      renderMemoryInspector({
        els: panel.__replyContextEls || els,
        inspector: panel.__replyContextInspector || inspector,
        escapeHtmlFn: panel.__replyContextEscapeHtmlFn || escapeHtmlFn,
      });
      if (scrollTop !== null) panel.scrollTop = scrollTop;
      return;
    }
    const button = event?.target?.closest?.('[data-reply-context-node-id]');
    if (!button) return;
    const nextSelectedId = String(button.dataset?.replyContextNodeId || '').trim();
    if (!nextSelectedId) return;
    panel.__replyContextSelectedId = nextSelectedId;
    if (panel.dataset) panel.dataset.replyContextSelectedId = nextSelectedId;
    const scrollTop = typeof panel.scrollTop === 'number' ? panel.scrollTop : null;
    renderMemoryInspector({
      els: panel.__replyContextEls || els,
      inspector: panel.__replyContextInspector || inspector,
      escapeHtmlFn: panel.__replyContextEscapeHtmlFn || escapeHtmlFn,
    });
    if (scrollTop !== null) panel.scrollTop = scrollTop;
  });
}

function summarizeLatestReplyCanonicalState(promptTruth = {}, authorityPressure = {}) {
  const stableFacts = normalizePromptTruthChannel(promptTruth?.channels?.stableFacts);
  const hasCanonReceipt = hasRecordedPromptTruthChannel(promptTruth?.channels?.stableFacts)
    || hasOwn(promptTruth, 'canonicalFactsPresent')
    || hasOwn(authorityPressure, 'canonicalFactsPresent')
    || promptTruth?.canonicalOverrideActive === true
    || authorityPressure?.canonicalOverrideActive === true;
  if (!hasCanonReceipt) {
    return 'not recorded';
  }
  if (promptTruth?.canonicalOverrideActive === true || authorityPressure?.canonicalOverrideActive === true) {
    return 'canon-first holdback active';
  }
  if (
    promptTruth?.canonicalFactsPresent === true
    || authorityPressure?.canonicalFactsPresent === true
    || stableFacts.renderedCount > 0
  ) {
    return 'canon rendered';
  }
  const status = normalizeReplyContextStatus(stableFacts.state);
  if (status === 'held back') return 'canon held back';
  if (status === 'candidate') return 'canon candidate';
  return 'canon silent';
}

function summarizeLatestReplyRetrievalPath(retrieval = {}) {
  const mode = String(retrieval.mode || '').trim().toLowerCase();
  if (mode === 'semantic') return 'semantic path';
  if (mode === 'keyword') return 'keyword path';
  if (retrieval.semanticReady === true) return 'semantic path';
  if (retrieval.semanticReady === false && retrieval.semanticReadyRecorded) return 'keyword path';
  return 'not recorded';
}

function summarizeLatestReplyCompression(retrieval = {}) {
  if (!retrieval.compressionRecorded) return 'compression not recorded';
  return `compression ${retrieval.compressionUsed === true ? 'used' : 'not used'}`;
}

function buildReplySummaryHeading(selectedSnapshot = null) {
  return selectedSnapshot && selectedSnapshot.latest === false
    ? 'Selected reply at a glance'
    : 'Last reply at a glance';
}

function buildReplySummaryFallbackText(selectedSnapshot = null) {
  return selectedSnapshot && selectedSnapshot.latest === false
    ? 'Selected snapshot summary is based on the recorded audit receipt.'
    : 'Latest reply summary is based on the newest recorded inspector data.';
}

function normalizeInspectorScopeClass(scope = '') {
  const normalized = String(scope || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized ? `scope-${normalized}` : '';
}

function renderScopedSectionHeading(title = '', scope = '', escapeHtmlFn = escapeHtml, options = {}) {
  const note = String(options?.note || '').trim();
  const withGap = options?.withGap === true;
  const scopeClass = normalizeInspectorScopeClass(scope);
  return `
    <div class="inspector-section-heading${withGap ? ' with-gap' : ''}">
      <div class="inspector-section-heading-row">
        <div class="section-label">${escapeHtmlFn(title)}</div>
        ${scope
          ? `<span class="inspector-scope-pill${scopeClass ? ` ${scopeClass}` : ''}">${escapeHtmlFn(scope)}</span>`
          : ''}
      </div>
      ${note ? `<small class="inspector-section-note">${escapeHtmlFn(note)}</small>` : ''}
    </div>
  `;
}

function renderInspectorScopeGroup(title = '', scope = '', content = '', escapeHtmlFn = escapeHtml, options = {}) {
  const scopeClass = normalizeInspectorScopeClass(scope);
  return `
    <section class="inspector-scope-group${scopeClass ? ` ${scopeClass}` : ''}">
      ${renderScopedSectionHeading(title, scope, escapeHtmlFn, options)}
      <div class="inspector-scope-group-body">
        ${content}
      </div>
    </section>
  `;
}

function renderLatestReplySummary(viewModel = {}, escapeHtmlFn = escapeHtml, selectedSnapshotId = '') {
  const {
    artifact,
    selectedAudit,
    promptTruth,
    retrieval,
    routing,
    runtimeReadiness,
    runtimePerformance,
    modelAdvisory,
    toolEvidenceReceipt,
    selectedSnapshot,
  } = pickReplyContextSummarySources(viewModel, selectedSnapshotId);
  const authorityPressure = modelAdvisory.authorityPressure && typeof modelAdvisory.authorityPressure === 'object'
    ? modelAdvisory.authorityPressure
    : {};
  const scope = artifact?.scope && typeof artifact.scope === 'object' ? artifact.scope : {};
  const requestedMode = String(scope.requestedMode || routing.requestedMode || selectedAudit?.requestedMode || '').trim();
  const selectedLane = String(scope.selectedLane || routing.selectedLane || selectedAudit?.selectedLane || '').trim();
  const executionPath = String(artifact?.executionPath || selectedAudit?.executionPath || '').trim();
  const latencyClass = String(
    artifact?.performance?.latencyClass
    || runtimePerformance?.latencyClass
    || modelAdvisory?.reasoningPolicy?.sourceLatencyClass
    || '',
  ).trim();
  const hasReplySummaryData = Boolean(
    artifact
    || selectedAudit
    || requestedMode
    || selectedLane
    || executionPath
    || latencyClass
    || countRecordedRetrievalIds(retrieval)
    || retrieval.hasRecordedSummary
    || runtimeReadiness?.warmState
    || runtimeReadiness?.checkedAt,
  );

  if (!hasReplySummaryData) {
    return `
      <div class="list-item">
        <div class="memory-copy">
          Last-reply summary is not available yet.
          <small>Penny will start filling this in once a reply has route and inspector data to summarize. The compact sections below still show latest/current or session-wide state based on their scope pills.</small>
        </div>
      </div>
    `;
  }

  const promptTruthBits = ['stableFacts', 'memoryBooks', 'sessionArchive', 'globalArchive', 'researchLedger']
    .map((channelKey) => summarizePromptTruthChannel(channelKey, promptTruth?.channels?.[channelKey]))
    .filter(Boolean);
  const retrievalBits = [
    summarizeLatestReplyRetrievalSource(
      'session',
      retrieval.selectedSessionIds,
      retrieval.renderedSessionIds,
      retrieval.selectedSessionIdsRecorded || retrieval.renderedSessionIdsRecorded,
    ),
    summarizeLatestReplyRetrievalSource(
      'global',
      retrieval.selectedGlobalIds,
      retrieval.renderedGlobalIds,
      retrieval.selectedGlobalIdsRecorded || retrieval.renderedGlobalIdsRecorded,
    ),
    summarizeLatestReplyRetrievalSource(
      'books',
      retrieval.selectedBookIds,
      retrieval.renderedBookIds,
      retrieval.selectedBookIdsRecorded || retrieval.renderedBookIdsRecorded,
    ),
    summarizeLatestReplyRetrievalSource(
      'ledger',
      retrieval.selectedLedgerIds,
      retrieval.renderedLedgerIds,
      retrieval.selectedLedgerIdsRecorded || retrieval.renderedLedgerIdsRecorded,
    ),
  ];
  const retrievalPath = summarizeLatestReplyRetrievalPath(retrieval);
  const readinessBits = [
    `chat ${formatReplyContextBoolean(runtimeReadiness.chatModelReady, 'ready', 'pending')}`,
    `tool ${formatReplyContextBoolean(runtimeReadiness.toolModelReady, 'ready', 'pending')}`,
    `embeddings ${formatReplyContextBoolean(runtimeReadiness.embeddingReady, 'ready', 'fallback')}`,
    Number.isFinite(Number(runtimeReadiness.cacheAgeMs)) ? `cache ${formatCacheAge(runtimeReadiness.cacheAgeMs)}` : 'cache age not recorded',
  ];
  const toolEvidenceSummary = toolEvidenceReceipt?.summary || null;
  const researchLedgerPromptChannel = normalizePromptTruthChannel(promptTruth?.channels?.researchLedger);
  const researchLedgerPromptState = summarizeResearchLedgerPromptState(
    researchLedgerPromptChannel,
    isResearchLedgerRendered(artifact) || isResearchLedgerRendered(selectedAudit?.artifactSummary),
  );
  const researchLedgerPromptLabel = normalizeReplyContextStatus(researchLedgerPromptState);
  const researchLedgerUpdate = artifact?.researchLedgerUpdate && typeof artifact.researchLedgerUpdate === 'object'
    ? artifact.researchLedgerUpdate
    : {
        status: String(selectedAudit?.researchLedger?.updateStatus || '').trim(),
        reason: '',
      };
  const ledgerBits = [
    researchLedgerPromptChannel.heldBackReason ? `reason ${researchLedgerPromptChannel.heldBackReason}` : '',
    String(selectedAudit?.researchLedger?.topicLabel || selectedAudit?.researchLedger?.topicId || '').trim(),
    String(researchLedgerUpdate.reason || '').trim(),
  ].filter(Boolean);

  return `
    <div class="list-item">
      <div class="memory-copy">
        Reply path: <strong>${escapeHtmlFn(`${requestedMode || 'not recorded'}/${selectedLane || 'not recorded'} · ${executionPath || 'not recorded'} · ${latencyClass || 'latency not recorded'}`)}</strong>
        <small>${escapeHtmlFn(artifact?.summary?.text || buildReplySummaryFallbackText(selectedSnapshot))}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        What rendered: <strong>${escapeHtmlFn(summarizeLatestReplyCanonicalState(promptTruth, authorityPressure))}</strong>
        <small>${escapeHtmlFn(promptTruthBits.join(' | ') || 'No prompt-truth summary was recorded for this reply.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Memory used: <strong>${escapeHtmlFn(`${retrievalPath}${retrieval.semanticDowngrade === true ? ' · semantic downgraded' : ''}`)}</strong>
        <small>${escapeHtmlFn(`${retrievalBits.join(' | ')} | ${summarizeLatestReplyCompression(retrieval)}${retrieval.reasonCode ? ` | ${retrieval.reasonCode}` : ''}`)}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Readiness: <strong>${escapeHtmlFn(runtimeReadiness.warmState || 'not recorded')}</strong>
        <small>${escapeHtmlFn(readinessBits.join(' | '))}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Tool evidence: <strong>${escapeHtmlFn(toolEvidenceSummary ? `${toolEvidenceSummary.itemCount} item(s)` : 'not recorded')}</strong>
        <small>${escapeHtmlFn(toolEvidenceSummary
          ? `prompt-visible ${toolEvidenceSummary.promptVisibleItemCount} | deterministic-only ${toolEvidenceSummary.deterministicOnlyItemCount} | provenance-only ${toolEvidenceSummary.provenanceOnlyItemCount}`
          : 'No sibling runtime receipt was recorded for this reply snapshot.')}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Post-reply ledger: <strong>${escapeHtmlFn(`${researchLedgerPromptLabel} · update ${researchLedgerUpdate.status || 'not recorded'}`)}</strong>
        <small>${escapeHtmlFn(ledgerBits.join(' | ') || 'No additional ledger detail was recorded for this reply.')}</small>
      </div>
    </div>
  `;
}

export function renderMemoryInspector({ els = {}, inspector = null, escapeHtmlFn = escapeHtml } = {}) {
  ensureMemoryInspectorUi(els);
  if (!els.memoryInspectorPanel) return null;
  if (!inspector) {
    els.memoryInspectorPanel.className = 'list-block empty';
    els.memoryInspectorPanel.textContent = 'Inspector data will appear here once Penny has a chat to archive.';
    return null;
  }

  const viewModel = buildMemoryInspectorViewModel(inspector);
  const replyContextHistory = buildReplyContextHistoryViewModel(
    viewModel,
    els.memoryInspectorPanel.__replyContextSnapshotId || els.memoryInspectorPanel.dataset?.replyContextSnapshotId || '',
  );
  const replyContextMap = buildReplyContextMapViewModel(
    viewModel,
    els.memoryInspectorPanel.__replyContextSelectedId || els.memoryInspectorPanel.dataset?.replyContextSelectedId || 'latest-reply',
    replyContextHistory.selectedId,
  );
  const runtimeReadiness = viewModel.runtime?.readiness || {};
  const currentInspectorStateGroup = renderInspectorScopeGroup(
    'Current inspector state',
    'Latest/current',
    `
      ${renderScopedSectionHeading('Semantic memory', 'Latest/current', escapeHtmlFn)}
      <div class="list-item">
        <div class="memory-copy">
          Semantic memory is <strong>${escapeHtmlFn(viewModel.semantic.ready ? 'active' : 'fallback')}</strong>.
          <small>${escapeHtmlFn(`${viewModel.semantic.configuredModel || 'no embedding model configured'}${runtimeReadiness.warmState ? ` · ${runtimeReadiness.warmState}` : ''}${Number.isFinite(Number(runtimeReadiness.cacheAgeMs)) ? ` · ${formatCacheAge(runtimeReadiness.cacheAgeMs)}` : ''}`)}</small>
        </div>
      </div>
      ${renderScopedSectionHeading('Memory layer counts', 'Latest/current', escapeHtmlFn, { withGap: true })}
      <div class="list-item">
        <div class="memory-copy">
          Explicit facts: ${escapeHtmlFn(String(viewModel.explicit.count || 0))} &middot; Memory books: ${escapeHtmlFn(String(viewModel.books.enabledCount || 0))} enabled &middot; Session archive: ${escapeHtmlFn(String(viewModel.session.episodeCount || 0))} episodes / ${escapeHtmlFn(String(viewModel.session.chapterCount || 0))} chapters &middot; Global patterns: ${escapeHtmlFn(String(viewModel.global.patternCount || 0))} &middot; Investigations: ${escapeHtmlFn(String(viewModel.ledger.topicCount || 0))}
        </div>
      </div>
      ${renderScopedSectionHeading('Background vectorization', 'Latest/current', escapeHtmlFn, { withGap: true })}
      ${renderBackgroundVectorizationSummary(viewModel.backgroundVectorization, viewModel.session, escapeHtmlFn)}
      ${renderScopedSectionHeading('Routing summary', 'Latest/current', escapeHtmlFn, { withGap: true })}
      ${renderRoutingSummary(viewModel.routing, escapeHtmlFn)}
      ${renderScopedSectionHeading('Runtime artifact', 'Latest/current', escapeHtmlFn, { withGap: true })}
      ${renderArtifactSummary(viewModel.artifact, escapeHtmlFn)}
      ${renderScopedSectionHeading('Trace artifact', 'Latest/current', escapeHtmlFn, { withGap: true })}
      ${renderTraceArtifactSummary(viewModel.artifact, escapeHtmlFn)}
      ${renderScopedSectionHeading('Trace provenance', 'Latest/current', escapeHtmlFn, { withGap: true })}
      ${renderTraceProvenance(viewModel.artifact, escapeHtmlFn)}
    `,
    escapeHtmlFn,
    {
      note: 'Below the selected-reply cluster, these compact sections use the newest inspector and runtime state. They do not switch when you select an older reply snapshot above.',
    },
  );
  const sessionContinuityStateGroup = renderInspectorScopeGroup(
    'Session-wide continuity state',
    'Session-wide',
    `
      ${renderScopedSectionHeading('Research continuity ledger', 'Session-wide', escapeHtmlFn)}
      ${renderResearchLedger(viewModel.ledger, escapeHtmlFn)}
      ${renderScopedSectionHeading('Recency protection', 'Session-wide', escapeHtmlFn, { withGap: true })}
      ${renderRecencyProtection(viewModel.session.recencyProtection, escapeHtmlFn)}
      ${renderScopedSectionHeading('Recent audit trail', 'Session-wide', escapeHtmlFn, { withGap: true })}
      ${renderRecentAuditTrail(viewModel.recentAuditTrail, escapeHtmlFn)}
    `,
    escapeHtmlFn,
    {
      note: 'This block summarizes current session continuity state. It stays session-wide even when the selected reply snapshot changes.',
    },
  );
  els.memoryInspectorPanel.__replyContextEls = els;
  els.memoryInspectorPanel.__replyContextInspector = inspector;
  els.memoryInspectorPanel.__replyContextEscapeHtmlFn = escapeHtmlFn;
  els.memoryInspectorPanel.__replyContextSelectedId = replyContextMap.selectedId;
  els.memoryInspectorPanel.__replyContextSnapshotId = replyContextHistory.selectedId;
  if (els.memoryInspectorPanel.dataset) {
    els.memoryInspectorPanel.dataset.replyContextSelectedId = replyContextMap.selectedId;
    els.memoryInspectorPanel.dataset.replyContextSnapshotId = replyContextHistory.selectedId;
  }
  els.memoryInspectorPanel.className = 'list-block';
  els.memoryInspectorPanel.innerHTML = `
    ${renderScopedSectionHeading(
      buildReplySummaryHeading(replyContextHistory.selected || null),
      'Selected snapshot',
      escapeHtmlFn,
      {
        note: 'Summary, recent snapshots, and the reply-context map below all follow the selected reply snapshot.',
      },
    )}
    ${renderLatestReplySummary(viewModel, escapeHtmlFn, replyContextHistory.selectedId)}
    ${renderReplyContextHistory(replyContextHistory, escapeHtmlFn)}
    ${renderReplyContextMap(replyContextMap, escapeHtmlFn)}
    ${currentInspectorStateGroup}
    ${sessionContinuityStateGroup}
    ${renderScopedSectionHeading('Last retrieval for Penny\'s reply', 'Latest/current', escapeHtmlFn, { withGap: true })}
    ${renderItems([...(viewModel.retrieval.session || []), ...(viewModel.retrieval.global || [])], 'No archive memories were retrieved for the last reply.', escapeHtmlFn)}
    ${renderScopedSectionHeading('Active contradictions', 'Latest/current', escapeHtmlFn, { withGap: true })}
    ${renderActiveContradictions(viewModel.activeContradictions, escapeHtmlFn)}
    ${renderScopedSectionHeading('Matched memory books', 'Latest/current', escapeHtmlFn, { withGap: true })}
    ${renderItems(viewModel.matchedBooks, 'No memory books matched on the last reply.', escapeHtmlFn)}
    ${renderScopedSectionHeading('Compression fallback', 'Latest/current', escapeHtmlFn, { withGap: true })}
    ${viewModel.compression.used
      ? `${renderCompressionExplanation(viewModel.compression, escapeHtmlFn)}${renderItems(viewModel.compression.chapters || [], `Compression fallback was used because ${viewModel.compression.reason || 'session chapters were needed'}.`, escapeHtmlFn)}`
      : '<div class="list-item"><div class="memory-copy">Compression fallback was not used on the last reply.</div></div>'}
    ${renderScopedSectionHeading('Session archive', 'Session-wide', escapeHtmlFn, { withGap: true })}
    ${renderItems(viewModel.session.recentEpisodes || [], 'No archived session episodes yet.', escapeHtmlFn)}
    ${renderScopedSectionHeading('Session chapters', 'Session-wide', escapeHtmlFn, { withGap: true })}
    ${renderItems(viewModel.session.chapters || [], 'No session chapters yet.', escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Longer-term summaries and patterns</div>
    ${renderItems([...(viewModel.global.summaries || []), ...(viewModel.global.patterns || [])], 'No global summaries or patterns yet.', escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Promotion queue</div>
    ${renderQueue(viewModel.queue, escapeHtmlFn)}
  `;
  bindReplyContextSelection(els, inspector, escapeHtmlFn);
  return viewModel;
}

export function buildBrainModeNote({ mode = 'local', meta = null } = {}) {
  if (!meta) {
    return mode === 'shadow'
      ? 'Shadow uses the optional OpenClaw lane. It is still experimental and not Penny\'s main chat brain.'
      : 'LM Studio is Penny\'s main brain right now. Chat and tool lanes route automatically.';
  }
  if (meta.requestedMode === 'shadow' && meta.usedFallback) {
    const reason = meta.shadowError ? ` ${meta.shadowError}` : '';
    return `Shadow failed, so this reply used the local placeholder fallback.${reason}`;
  }
  if (meta.backend === 'openclaw-shadow') {
    return 'Shadow brain handled the last reply.';
  }
  if (meta.requestedMode === 'local' && meta.localLane) {
    const lane = meta.localLane === 'tool' ? 'tool lane' : 'chat lane';
    const modelText = meta.resolvedModel ? ` on ${meta.resolvedModel}` : '';
    const fallbackText = meta.laneFallback ? ' It had to fall back to the best loaded local model.' : '';
    return `LM Studio handled the last reply on the ${lane}${modelText}.${fallbackText}`.trim();
  }
  return mode === 'local'
    ? 'LM Studio handled the last reply.'
    : 'Shadow is selected. This lane is experimental, and Penny will block the reply if OpenClaw fails.';
}
