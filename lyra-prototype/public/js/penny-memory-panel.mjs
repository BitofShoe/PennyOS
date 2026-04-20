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

  const toolbar = host.ownerDocument.createElement('div');
  toolbar.className = 'memory-toolbar';
  toolbar.innerHTML = `
    <div>
      <div class="section-label">Hybrid memory inspector</div>
      <div class="memory-toolbar-note">
        Explicit facts stay canonical. Archive recall, summaries, patterns, and review items live here.
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
  host.append(toolbar, panel);
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
  const researchLedgerPromptInjected = artifact.researchLedgerPromptInjected === true;
  const researchLedgerPromptChannel = promptTruth?.channels?.researchLedger && typeof promptTruth.channels.researchLedger === 'object'
    ? promptTruth.channels.researchLedger
    : {};
  const researchLedgerPromptCandidateCount = Number(researchLedgerPromptChannel.candidateCount || 0);
  const researchLedgerPromptRenderedCount = Number(researchLedgerPromptChannel.renderedCount || 0);
  const researchLedgerPromptHoldbackReason = String(researchLedgerPromptChannel.heldBackReason || '').trim();
  const researchLedgerPromptState = (
    researchLedgerPromptRenderedCount > 0
    || (!researchLedgerPromptCandidateCount && !researchLedgerPromptRenderedCount && researchLedgerPromptInjected)
  )
    ? 'rendered'
    : (researchLedgerPromptCandidateCount > 0
      ? (researchLedgerPromptHoldbackReason ? 'held back' : 'not rendered')
      : 'absent');
  const researchLedgerPromptDetail = researchLedgerPromptState === 'rendered'
    ? `${Math.max(1, researchLedgerPromptRenderedCount)} research continuity topic${Math.max(1, researchLedgerPromptRenderedCount) === 1 ? '' : 's'} rendered into the prompt.`
    : (researchLedgerPromptCandidateCount > 0
      ? (researchLedgerPromptHoldbackReason
        ? `Candidate ledger context was held back (${researchLedgerPromptHoldbackReason}).`
        : `${researchLedgerPromptCandidateCount} candidate research continuity topic${researchLedgerPromptCandidateCount === 1 ? '' : 's'} were not rendered into the prompt.`)
      : 'No research-ledger prompt candidates were selected for this turn.');
  const promptTruthBits = ['stableFacts', 'memoryBooks', 'sessionArchive', 'globalArchive', 'researchLedger']
    .map((channelKey) => {
      const channel = promptTruth?.channels?.[channelKey] && typeof promptTruth.channels[channelKey] === 'object'
        ? promptTruth.channels[channelKey]
        : null;
      if (!channel) return '';
      const candidateCount = Number(channel.candidateCount || 0);
      const renderedCount = Number(channel.renderedCount || 0);
      const heldBackReason = String(channel.heldBackReason || '').trim();
      if (!candidateCount && !renderedCount && !heldBackReason) return '';
      return `${channelKey} ${renderedCount}/${candidateCount}${heldBackReason ? ` (${heldBackReason})` : ''}`;
    })
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
        Authority pressure: <strong>${escapeHtmlFn(canonicalSummary)}</strong> &middot; ${escapeHtmlFn(overrideSummary)} &middot; advisory rendered ${escapeHtmlFn(String(Number(authorityPressure.advisoryItemsInjected || 0)))} item(s) across ${escapeHtmlFn(String(Number(authorityPressure.advisoryChannelsInjected || 0)))} channel(s)
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
    .map((item) => `${item?.channel || 'archive'}:${item?.injected === false ? 'not-rendered' : 'rendered'}:${item?.sourceLabel || item?.sourceId || 'source'}`)
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
      item?.injected === false ? 'not rendered' : 'rendered',
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
      .map((key) => {
        const channel = promptTruth[key] && typeof promptTruth[key] === 'object' ? promptTruth[key] : {};
        const candidateCount = Number(channel.candidateCount || 0);
        const renderedCount = Number(channel.renderedCount || 0);
        const heldBackReason = String(channel.heldBackReason || '').trim();
        if (!candidateCount && !renderedCount && !heldBackReason) return '';
        return `${key} ${renderedCount}/${candidateCount}${heldBackReason ? ` (${heldBackReason})` : ''}`;
      })
      .filter(Boolean);
    const retrievalBits = [
      retrieval.mode ? `${retrieval.mode}/${retrieval.reasonCode || 'reason-unknown'}` : '',
      Array.isArray(retrieval.selectedSessionIds) && retrieval.selectedSessionIds.length ? `session ${retrieval.selectedSessionIds.length}` : '',
      Array.isArray(retrieval.selectedGlobalIds) && retrieval.selectedGlobalIds.length ? `global ${retrieval.selectedGlobalIds.length}` : '',
      Array.isArray(retrieval.selectedBookIds) && retrieval.selectedBookIds.length ? `books ${retrieval.selectedBookIds.length}` : '',
      Array.isArray(retrieval.selectedLedgerIds) && retrieval.selectedLedgerIds.length ? `ledger ${retrieval.selectedLedgerIds.length}` : '',
      retrieval.compression?.used ? 'compression used' : '',
      retrieval.semanticReady ? 'semantic ready' : 'keyword path',
      retrieval.semanticDowngrade ? 'semantic downgraded' : '',
    ].filter(Boolean);
    const ledgerChannel = promptTruth.researchLedger && typeof promptTruth.researchLedger === 'object'
      ? promptTruth.researchLedger
      : {};
    const ledgerCandidateCount = Number(ledgerChannel.candidateCount || 0);
    const ledgerRenderedCount = Number(ledgerChannel.renderedCount || 0);
    const ledgerHeldBackReason = String(ledgerChannel.heldBackReason || '').trim();
    const ledgerPromptState = artifactSummary.researchLedgerPromptInjected
      ? 'ledger rendered'
      : (ledgerCandidateCount > 0
        ? (ledgerHeldBackReason ? 'ledger held back' : 'ledger not rendered')
        : 'ledger absent');
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

export function renderMemoryInspector({ els = {}, inspector = null, escapeHtmlFn = escapeHtml } = {}) {
  ensureMemoryInspectorUi(els);
  if (!els.memoryInspectorPanel) return null;
  if (!inspector) {
    els.memoryInspectorPanel.className = 'list-block empty';
    els.memoryInspectorPanel.textContent = 'Inspector data will appear here once Penny has a chat to archive.';
    return null;
  }

  const viewModel = buildMemoryInspectorViewModel(inspector);
  const runtimeReadiness = viewModel.runtime?.readiness || {};
  els.memoryInspectorPanel.className = 'list-block';
  els.memoryInspectorPanel.innerHTML = `
    <div class="list-item">
      <div class="memory-copy">
        Semantic memory is <strong>${escapeHtmlFn(viewModel.semantic.ready ? 'active' : 'fallback')}</strong>.
        <small>${escapeHtmlFn(`${viewModel.semantic.configuredModel || 'no embedding model configured'}${runtimeReadiness.warmState ? ` · ${runtimeReadiness.warmState}` : ''}${Number.isFinite(Number(runtimeReadiness.cacheAgeMs)) ? ` · ${formatCacheAge(runtimeReadiness.cacheAgeMs)}` : ''}`)}</small>
      </div>
    </div>
    <div class="list-item">
      <div class="memory-copy">
        Explicit facts: ${escapeHtmlFn(String(viewModel.explicit.count || 0))} &middot; Memory books: ${escapeHtmlFn(String(viewModel.books.enabledCount || 0))} enabled &middot; Session archive: ${escapeHtmlFn(String(viewModel.session.episodeCount || 0))} episodes / ${escapeHtmlFn(String(viewModel.session.chapterCount || 0))} chapters &middot; Global patterns: ${escapeHtmlFn(String(viewModel.global.patternCount || 0))} &middot; Investigations: ${escapeHtmlFn(String(viewModel.ledger.topicCount || 0))}
      </div>
    </div>
    <div class="section-label" style="margin-top:12px;">Background vectorization</div>
    ${renderBackgroundVectorizationSummary(viewModel.backgroundVectorization, viewModel.session, escapeHtmlFn)}
    ${renderRoutingSummary(viewModel.routing, escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Runtime artifact</div>
    ${renderArtifactSummary(viewModel.artifact, escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Trace artifact</div>
    ${renderTraceArtifactSummary(viewModel.artifact, escapeHtmlFn)}
    ${renderTraceProvenance(viewModel.artifact, escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Research continuity ledger</div>
    ${renderResearchLedger(viewModel.ledger, escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Recency protection</div>
    ${renderRecencyProtection(viewModel.session.recencyProtection, escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Recent audit trail</div>
    ${renderRecentAuditTrail(viewModel.recentAuditTrail, escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Last retrieval for Penny's reply</div>
    ${renderItems([...(viewModel.retrieval.session || []), ...(viewModel.retrieval.global || [])], 'No archive memories were retrieved for the last reply.', escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Active contradictions</div>
    ${renderActiveContradictions(viewModel.activeContradictions, escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Matched memory books</div>
    ${renderItems(viewModel.matchedBooks, 'No memory books matched on the last reply.', escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Compression fallback</div>
    ${viewModel.compression.used
      ? `${renderCompressionExplanation(viewModel.compression, escapeHtmlFn)}${renderItems(viewModel.compression.chapters || [], `Compression fallback was used because ${viewModel.compression.reason || 'session chapters were needed'}.`, escapeHtmlFn)}`
      : '<div class="list-item"><div class="memory-copy">Compression fallback was not used on the last reply.</div></div>'}
    <div class="section-label" style="margin-top:12px;">Session archive</div>
    ${renderItems(viewModel.session.recentEpisodes || [], 'No archived session episodes yet.', escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Session chapters</div>
    ${renderItems(viewModel.session.chapters || [], 'No session chapters yet.', escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Longer-term summaries and patterns</div>
    ${renderItems([...(viewModel.global.summaries || []), ...(viewModel.global.patterns || [])], 'No global summaries or patterns yet.', escapeHtmlFn)}
    <div class="section-label" style="margin-top:12px;">Promotion queue</div>
    ${renderQueue(viewModel.queue, escapeHtmlFn)}
  `;
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
