const {
  SEMANTIC_ID_KINDS,
  buildSemanticClaimId,
  buildSemanticEntityId,
  buildSemanticLinkId,
  buildSemanticRenderedContextId,
  buildSemanticSourceId,
  buildSemanticVectorSourceId,
  validateSemanticId,
} = require('./penny-semantic-ids');
const {
  PENNY_SEMANTIC_CLAIM_SCHEMA,
  normalizeSemanticClaim,
  validateSemanticClaim,
} = require('./penny-semantic-claims');
const {
  SEMANTIC_PREDICATE_IDS,
} = require('./penny-semantic-predicates');
const {
  SEMANTIC_DOMAIN_IDS,
} = require('./penny-semantic-domains');

const PENNY_SEMANTIC_SOURCE_AUDIT_SCHEMA = 'penny-semantic-source-audit.v1';

const SOURCE_AUDIT_MEASUREMENT_MODES = Object.freeze({
  FIXTURE_ONLY: 'fixture-only',
  LOCAL_AUDIT: 'local-audit',
});

const SOURCE_AUDIT_FAILURE_MODES = Object.freeze({
  MISSING_SOURCE_ID: 'missing-source-id',
  INVALID_SOURCE_ID: 'invalid-source-id',
  UNSTABLE_SOURCE_ID: 'unstable-source-id',
  CACHE_SOURCE_ID_MISMATCH: 'cache-source-id-mismatch',
  INVALID_VECTOR_SOURCE_ID: 'invalid-vector-source-id',
  RENDERED_ITEM_MISSING_SOURCE_ID: 'rendered-item-missing-source-id',
  TOOL_EVIDENCE_MISSING_SOURCE_ID: 'tool-evidence-missing-source-id',
  DYNAMIC_LINK_MISSING_LINK_ID: 'dynamic-link-missing-link-id',
  DYNAMIC_LINK_INVALID_LINK_ID: 'dynamic-link-invalid-link-id',
  DYNAMIC_LINK_SOURCE_MISSING: 'dynamic-link-source-missing',
  DYNAMIC_LINK_TARGET_MISSING: 'dynamic-link-target-missing',
  SEMANTIC_CLAIM_MISSING_SOURCE_ID: 'semantic-claim-missing-source-id',
  SEMANTIC_CLAIM_INVALID_SOURCE_ID: 'semantic-claim-invalid-source-id',
  SEMANTIC_CLAIM_UNSTABLE_CLAIM_ID: 'semantic-claim-unstable-claim-id',
});

const SOURCE_AUDIT_SURFACES = Object.freeze({
  EXPLICIT_MEMORY: 'explicitMemory',
  ARCHIVE: 'archive',
  RESEARCH_LEDGER: 'researchLedger',
  STATIC_EMBEDDINGS: 'staticEmbeddings',
  PROMPT_TRUTH: 'promptTruth',
  TOOL_EVIDENCE_RECEIPT: 'toolEvidenceReceipt',
  OPEN_LOOPS: 'openLoops',
  DYNAMIC_MEMORY_LINKS: 'dynamicMemoryLinks',
  CANDIDATE_SURVIVAL: 'candidateSurvival',
  SEMANTIC_CLAIMS: 'semanticClaims',
});

const SOURCE_AUDIT_LIMITS = Object.freeze([
  'Source-ID audit does not prove answer quality.',
  'Semantic IDs are local identifiers, not dereference permissions.',
  'Candidate/static/semantic retrieval remains discovery-only unless promoted by existing reviewed paths.',
  'This artifact does not expand PromptTruth or toolEvidenceReceipt.',
  'This artifact does not raise prompt or rendered-memory limits.',
]);

const FAILURE_VALUES = new Set(Object.values(SOURCE_AUDIT_FAILURE_MODES));
const MEASUREMENT_MODE_VALUES = new Set(Object.values(SOURCE_AUDIT_MEASUREMENT_MODES));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function trimText(value = '', limit = 800) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function cleanToken(value = '') {
  return trimText(value, 160).toLowerCase().replace(/[_\s]+/g, '-');
}

function uniqueStrings(values = [], limit = 200) {
  const out = [];
  const seen = new Set();
  for (const value of asArray(values).flat()) {
    const text = trimText(value, 800);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function getPath(source = {}, path = '') {
  if (!path || !isPlainObject(source)) return undefined;
  return path.split('.').reduce((current, part) => (
    current && typeof current === 'object' ? current[part] : undefined
  ), source);
}

function firstValue(source = {}, paths = []) {
  for (const path of paths) {
    const value = getPath(source, path);
    if (Array.isArray(value)) {
      const first = value.map((item) => trimText(item)).find(Boolean);
      if (first) return first;
    } else {
      const text = trimText(value);
      if (text) return text;
    }
  }
  return '';
}

function valuesFromPaths(source = {}, paths = []) {
  const values = [];
  for (const path of paths) {
    const value = getPath(source, path);
    if (Array.isArray(value)) values.push(...value);
    else values.push(value);
  }
  return uniqueStrings(values);
}

function normalizeMeasurementMode(value = SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY) {
  const mode = cleanToken(value);
  if (mode === 'fixture' || mode === 'fixture-only') return SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY;
  if (mode === 'local' || mode === 'local-audit') return SOURCE_AUDIT_MEASUREMENT_MODES.LOCAL_AUDIT;
  return MEASUREMENT_MODE_VALUES.has(mode) ? mode : SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY;
}

function createAuditState(seed = {}) {
  const knownSourceIds = new Set(uniqueStrings(seed.knownSourceIds || []));
  const knownItemIds = new Set(uniqueStrings(seed.knownItemIds || []));
  return {
    failures: [],
    knownSourceIds,
    knownItemIds,
  };
}

function rememberKnownId(state, value = '') {
  const id = trimText(value, 800);
  if (!id) return;
  state.knownSourceIds.add(id);
  state.knownItemIds.add(id);
}

function rememberItemIds(state, item = {}, paths = []) {
  for (const id of valuesFromPaths(item, paths)) rememberKnownId(state, id);
}

function isLikelyUnstableSourceId(sourceId = '') {
  const id = cleanToken(sourceId);
  if (!id) return false;
  if (/^(tmp|temp|scratch|ephemeral|candidate|chunk)(:|-|_)?\d*$/.test(id)) return true;
  if (/^chunk(:|-|_)\d+/.test(id)) return true;
  if (/^candidate(:|-|_)\d+/.test(id)) return true;
  return false;
}

function validateSourceIdValue(sourceId = '', {
  requireSemantic = false,
} = {}) {
  const id = trimText(sourceId, 800);
  if (!id) {
    return { ok: false, missing: true, invalid: false, unstable: false, reason: 'missing source id' };
  }
  if (isLikelyUnstableSourceId(id)) {
    return { ok: false, missing: false, invalid: false, unstable: true, reason: 'source id looks temporary or chunk-local' };
  }
  if (id.startsWith('penny:')) {
    const validation = validateSemanticId(id, SEMANTIC_ID_KINDS.SOURCE);
    return {
      ok: validation.valid,
      missing: false,
      invalid: !validation.valid,
      unstable: false,
      reason: validation.valid ? '' : validation.reason,
    };
  }
  if (requireSemantic) {
    return { ok: false, missing: false, invalid: true, unstable: false, reason: 'source id must be a local penny source id' };
  }
  if (/\s/.test(id)) {
    return { ok: false, missing: false, invalid: false, unstable: true, reason: 'source id contains whitespace' };
  }
  return { ok: true, missing: false, invalid: false, unstable: false, reason: '' };
}

function addFailure(state, {
  surface = '',
  itemId = '',
  failureMode = '',
  message = '',
  expectedSourceId = '',
  actualSourceId = '',
  sourceId = '',
  severity = 'error',
} = {}) {
  const mode = FAILURE_VALUES.has(failureMode) ? failureMode : SOURCE_AUDIT_FAILURE_MODES.INVALID_SOURCE_ID;
  state.failures.push({
    surface: trimText(surface, 120),
    itemId: trimText(itemId, 240),
    failureMode: mode,
    severity,
    message: trimText(message, 500),
    sourceId: trimText(sourceId, 800),
    expectedSourceId: trimText(expectedSourceId, 800),
    actualSourceId: trimText(actualSourceId, 800),
  });
}

function emptySourceSurfaceSummary() {
  return {
    items: 0,
    itemsWithSourceIds: 0,
    missingSourceIds: 0,
    invalidSourceIds: 0,
    unstableIds: 0,
    semanticSourceIds: 0,
  };
}

function auditSourceItemSurface(state, {
  surface = '',
  items = [],
  sourcePaths = ['sourceId', 'semanticSourceId', 'source.sourceId'],
  itemIdPaths = ['id', 'sourceId'],
  requireSemantic = false,
} = {}) {
  const summary = emptySourceSurfaceSummary();
  const list = asArray(items).filter(isPlainObject);
  summary.items = list.length;
  for (const item of list) {
    const itemId = firstValue(item, itemIdPaths) || firstValue(item, sourcePaths);
    const sourceId = firstValue(item, sourcePaths);
    rememberItemIds(state, item, [...itemIdPaths, ...sourcePaths]);
    if (!sourceId) {
      summary.missingSourceIds += 1;
      addFailure(state, {
        surface,
        itemId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.MISSING_SOURCE_ID,
        message: 'Item does not expose a stable source id.',
      });
      continue;
    }
    const validation = validateSourceIdValue(sourceId, { requireSemantic });
    if (validation.ok) {
      summary.itemsWithSourceIds += 1;
      rememberKnownId(state, sourceId);
      if (sourceId.startsWith('penny:')) summary.semanticSourceIds += 1;
    } else if (validation.unstable) {
      summary.unstableIds += 1;
      addFailure(state, {
        surface,
        itemId,
        sourceId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.UNSTABLE_SOURCE_ID,
        message: validation.reason,
      });
    } else {
      summary.invalidSourceIds += 1;
      addFailure(state, {
        surface,
        itemId,
        sourceId,
        failureMode: validation.missing
          ? SOURCE_AUDIT_FAILURE_MODES.MISSING_SOURCE_ID
          : SOURCE_AUDIT_FAILURE_MODES.INVALID_SOURCE_ID,
        message: validation.reason,
      });
    }
  }
  return summary;
}

function normalizePromptTruthRenderedItems(promptTruth = {}) {
  const input = isPlainObject(promptTruth) ? promptTruth : {};
  const renderedItems = [];
  renderedItems.push(...asArray(input.renderedItems).filter(isPlainObject));
  const channelFields = [
    ['sessionArchive', 'renderedSessionIds'],
    ['globalArchive', 'renderedGlobalIds'],
    ['memoryBooks', 'renderedBookIds'],
    ['researchLedger', 'renderedLedgerIds'],
  ];
  for (const [channel, field] of channelFields) {
    for (const sourceId of asArray(input[field])) {
      const id = trimText(sourceId, 800);
      if (id) renderedItems.push({ channel, sourceId: id, id });
    }
  }
  return renderedItems;
}

function auditPromptTruth(state, promptTruth = {}) {
  const renderedItems = normalizePromptTruthRenderedItems(promptTruth);
  const summary = {
    renderedItems: renderedItems.length,
    renderedItemsWithSourceIds: 0,
    renderedItemsMissingSourceIds: 0,
    invalidSourceIds: 0,
    unstableIds: 0,
    renderedContextIds: 0,
    invalidRenderedContextIds: 0,
  };
  for (const item of renderedItems) {
    const itemId = firstValue(item, ['id', 'renderedContextId', 'channel']);
    const sourceId = firstValue(item, ['sourceId', 'source.sourceId']);
    if (!sourceId) {
      summary.renderedItemsMissingSourceIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.PROMPT_TRUTH,
        itemId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.RENDERED_ITEM_MISSING_SOURCE_ID,
        message: 'PromptTruth rendered item lacks a source id.',
      });
      continue;
    }
    const validation = validateSourceIdValue(sourceId);
    if (validation.ok) {
      summary.renderedItemsWithSourceIds += 1;
      rememberKnownId(state, sourceId);
    } else if (validation.unstable) {
      summary.unstableIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.PROMPT_TRUTH,
        itemId,
        sourceId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.UNSTABLE_SOURCE_ID,
        message: validation.reason,
      });
    } else {
      summary.invalidSourceIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.PROMPT_TRUTH,
        itemId,
        sourceId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.INVALID_SOURCE_ID,
        message: validation.reason,
      });
    }
    const renderedContextId = trimText(item.renderedContextId, 800);
    if (renderedContextId) {
      summary.renderedContextIds += 1;
      if (!validateSemanticId(renderedContextId, SEMANTIC_ID_KINDS.RENDERED_CONTEXT).valid) {
        summary.invalidRenderedContextIds += 1;
      }
    }
  }
  return summary;
}

function auditToolEvidenceReceipt(state, receipt = {}) {
  const input = isPlainObject(receipt) ? receipt : {};
  const items = [
    ...asArray(input.items),
    ...asArray(input.sources),
    ...asArray(input.sourceRefs),
    ...asArray(input.evidence),
  ].filter(isPlainObject);
  const summary = emptySourceSurfaceSummary();
  summary.items = items.length;
  for (const item of items) {
    const itemId = firstValue(item, ['id', 'toolCallId', 'sourceId']);
    const sourceId = firstValue(item, ['sourceId', 'source.sourceId']);
    if (!sourceId) {
      summary.missingSourceIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.TOOL_EVIDENCE_RECEIPT,
        itemId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.TOOL_EVIDENCE_MISSING_SOURCE_ID,
        message: 'Tool evidence receipt item lacks a source id.',
      });
      continue;
    }
    const validation = validateSourceIdValue(sourceId);
    if (validation.ok) {
      summary.itemsWithSourceIds += 1;
      rememberKnownId(state, sourceId);
      if (sourceId.startsWith('penny:')) summary.semanticSourceIds += 1;
    } else if (validation.unstable) {
      summary.unstableIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.TOOL_EVIDENCE_RECEIPT,
        itemId,
        sourceId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.UNSTABLE_SOURCE_ID,
        message: validation.reason,
      });
    } else {
      summary.invalidSourceIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.TOOL_EVIDENCE_RECEIPT,
        itemId,
        sourceId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.INVALID_SOURCE_ID,
        message: validation.reason,
      });
    }
  }
  return summary;
}

function auditStaticEmbeddings(state, items = []) {
  const list = asArray(items).filter(isPlainObject);
  const summary = {
    items: list.length,
    itemsWithSourceIds: 0,
    missingSourceIds: 0,
    invalidSourceIds: 0,
    unstableIds: 0,
    vectorSourceIds: 0,
    invalidVectorSourceIds: 0,
    providerAwareSourceIds: true,
    cacheSourceMismatches: 0,
  };
  for (const item of list) {
    const itemId = firstValue(item, ['id', 'vectorSourceId', 'sourceId']);
    const sourceId = firstValue(item, ['sourceId', 'source.sourceId', 'sourceItemId']);
    const cacheSourceId = firstValue(item, ['cacheSourceId', 'cache.sourceId', 'indexedSourceId']);
    const vectorSourceId = firstValue(item, ['vectorSourceId', 'semanticVectorSourceId']);
    if (!sourceId) {
      summary.missingSourceIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.STATIC_EMBEDDINGS,
        itemId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.MISSING_SOURCE_ID,
        message: 'Static embedding item lacks a source id.',
      });
    } else {
      const validation = validateSourceIdValue(sourceId);
      if (validation.ok) {
        summary.itemsWithSourceIds += 1;
        rememberKnownId(state, sourceId);
      } else if (validation.unstable) {
        summary.unstableIds += 1;
        addFailure(state, {
          surface: SOURCE_AUDIT_SURFACES.STATIC_EMBEDDINGS,
          itemId,
          sourceId,
          failureMode: SOURCE_AUDIT_FAILURE_MODES.UNSTABLE_SOURCE_ID,
          message: validation.reason,
        });
      } else {
        summary.invalidSourceIds += 1;
        addFailure(state, {
          surface: SOURCE_AUDIT_SURFACES.STATIC_EMBEDDINGS,
          itemId,
          sourceId,
          failureMode: SOURCE_AUDIT_FAILURE_MODES.INVALID_SOURCE_ID,
          message: validation.reason,
        });
      }
    }
    if (cacheSourceId && sourceId && cacheSourceId !== sourceId) {
      summary.cacheSourceMismatches += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.STATIC_EMBEDDINGS,
        itemId,
        expectedSourceId: sourceId,
        actualSourceId: cacheSourceId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.CACHE_SOURCE_ID_MISMATCH,
        message: 'Static embedding cache source id does not match the indexed source id.',
      });
    }
    if (vectorSourceId) {
      summary.vectorSourceIds += 1;
      if (!validateSemanticId(vectorSourceId, SEMANTIC_ID_KINDS.VECTOR_SOURCE).valid) {
        summary.invalidVectorSourceIds += 1;
        summary.providerAwareSourceIds = false;
        addFailure(state, {
          surface: SOURCE_AUDIT_SURFACES.STATIC_EMBEDDINGS,
          itemId,
          sourceId,
          actualSourceId: vectorSourceId,
          failureMode: SOURCE_AUDIT_FAILURE_MODES.INVALID_VECTOR_SOURCE_ID,
          message: 'Static embedding vectorSourceId is not a valid local vector-source id.',
        });
      }
    } else if (list.length) {
      summary.providerAwareSourceIds = false;
    }
  }
  return summary;
}

function auditSemanticClaims(state, claims = []) {
  const list = asArray(claims).filter(isPlainObject);
  const summary = {
    items: list.length,
    validClaims: 0,
    missingSourceIds: 0,
    invalidSourceIds: 0,
    unstableClaimIds: 0,
    canonicalClaimCount: 0,
    candidateOnlyClaimCount: 0,
  };
  for (const claimLike of list) {
    const rawClaimId = trimText(claimLike.claimId || claimLike.id, 800);
    const normalized = normalizeSemanticClaim(claimLike);
    const validation = validateSemanticClaim(claimLike);
    const itemId = rawClaimId || normalized?.claimId || firstValue(claimLike, ['source.sourceId', 'sourceId']);
    const sourceId = normalized?.source?.sourceId || '';
    const rawSourceId = firstValue(claimLike, ['source.sourceId', 'sourceId']);

    if (validation.valid) summary.validClaims += 1;
    if (normalized?.authority?.canonicality === 'canonical') summary.canonicalClaimCount += 1;
    if (normalized?.authority?.sourceAuthority === 'candidate-only'
      || normalized?.authority?.supportState === 'candidate-only') {
      summary.candidateOnlyClaimCount += 1;
    }

    if (!sourceId && !normalized?.source?.fixtureOnly) {
      summary.missingSourceIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.SEMANTIC_CLAIMS,
        itemId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.SEMANTIC_CLAIM_MISSING_SOURCE_ID,
        message: 'Semantic claim lacks source.sourceId.',
      });
    } else if (sourceId) {
      rememberKnownId(state, sourceId);
      if (!validateSemanticId(sourceId, SEMANTIC_ID_KINDS.SOURCE).valid) {
        summary.invalidSourceIds += 1;
        addFailure(state, {
          surface: SOURCE_AUDIT_SURFACES.SEMANTIC_CLAIMS,
          itemId,
          sourceId,
          failureMode: SOURCE_AUDIT_FAILURE_MODES.SEMANTIC_CLAIM_INVALID_SOURCE_ID,
          message: 'Semantic claim source.sourceId is not a valid local source id.',
        });
      }
    }

    if (rawSourceId && sourceId && rawSourceId !== sourceId && rawSourceId.startsWith('penny:')) {
      summary.invalidSourceIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.SEMANTIC_CLAIMS,
        itemId,
        expectedSourceId: sourceId,
        actualSourceId: rawSourceId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.SEMANTIC_CLAIM_INVALID_SOURCE_ID,
        message: 'Semantic claim raw source id changed during normalization.',
      });
    }

    if (rawClaimId) {
      const stableClaimId = buildSemanticClaimId({
        subject: normalized?.subject,
        predicate: normalized?.predicate,
        object: normalized?.object,
        source: normalized?.source,
        domainId: normalized?.domainId,
        temporal: normalized?.temporal,
      });
      if (!validateSemanticId(rawClaimId, SEMANTIC_ID_KINDS.CLAIM).valid || rawClaimId !== stableClaimId) {
        summary.unstableClaimIds += 1;
        addFailure(state, {
          surface: SOURCE_AUDIT_SURFACES.SEMANTIC_CLAIMS,
          itemId,
          sourceId,
          expectedSourceId: stableClaimId,
          actualSourceId: rawClaimId,
          failureMode: SOURCE_AUDIT_FAILURE_MODES.SEMANTIC_CLAIM_UNSTABLE_CLAIM_ID,
          message: 'Semantic claim id is invalid or does not match normalized claim fields.',
        });
      }
    }
  }
  return summary;
}

function auditDynamicMemoryLinks(state, links = [], {
  requireKnownEndpoints = true,
} = {}) {
  const list = asArray(links).filter(isPlainObject);
  const summary = {
    items: list.length,
    linksWithIds: 0,
    missingLinkIds: 0,
    endpointsChecked: 0,
    missingSourceEndpoints: 0,
    missingTargetEndpoints: 0,
    invalidSemanticLinkIds: 0,
  };
  for (const link of list) {
    const linkId = firstValue(link, ['linkId', 'semanticLinkId', 'semanticContract.linkId', 'id']);
    const sourceId = firstValue(link, [
      'sourceClaimId',
      'semanticContract.sourceClaimId',
      'sourceId',
      'source.sourceId',
      'source.claimId',
      'from',
    ]);
    const targetId = firstValue(link, [
      'targetClaimId',
      'semanticContract.targetClaimId',
      'targetId',
      'target.sourceId',
      'target.claimId',
      'to',
    ]);
    const itemId = linkId || `${sourceId}->${targetId}`;
    if (linkId) {
      summary.linksWithIds += 1;
      if (linkId.startsWith('penny:') && !validateSemanticId(linkId, SEMANTIC_ID_KINDS.LINK).valid) {
        summary.invalidSemanticLinkIds += 1;
        addFailure(state, {
          surface: SOURCE_AUDIT_SURFACES.DYNAMIC_MEMORY_LINKS,
          itemId,
          failureMode: SOURCE_AUDIT_FAILURE_MODES.DYNAMIC_LINK_INVALID_LINK_ID,
          message: 'Dynamic memory link has an invalid local semantic link id.',
          sourceId: linkId,
        });
      }
    } else {
      summary.missingLinkIds += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.DYNAMIC_MEMORY_LINKS,
        itemId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.DYNAMIC_LINK_MISSING_LINK_ID,
        message: 'Dynamic memory link lacks a stable link id.',
      });
    }

    summary.endpointsChecked += 2;
    if (!sourceId || (requireKnownEndpoints && !state.knownSourceIds.has(sourceId) && !state.knownItemIds.has(sourceId))) {
      summary.missingSourceEndpoints += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.DYNAMIC_MEMORY_LINKS,
        itemId,
        sourceId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.DYNAMIC_LINK_SOURCE_MISSING,
        message: sourceId
          ? 'Dynamic memory link source endpoint is not present in audited source ids.'
          : 'Dynamic memory link lacks a source endpoint id.',
      });
    }
    if (!targetId || (requireKnownEndpoints && !state.knownSourceIds.has(targetId) && !state.knownItemIds.has(targetId))) {
      summary.missingTargetEndpoints += 1;
      addFailure(state, {
        surface: SOURCE_AUDIT_SURFACES.DYNAMIC_MEMORY_LINKS,
        itemId,
        sourceId: targetId,
        failureMode: SOURCE_AUDIT_FAILURE_MODES.DYNAMIC_LINK_TARGET_MISSING,
        message: targetId
          ? 'Dynamic memory link target endpoint is not present in audited source ids.'
          : 'Dynamic memory link lacks a target endpoint id.',
      });
    }
  }
  return summary;
}

function preloadKnownIds(state, input = {}) {
  for (const id of uniqueStrings(input.knownSourceIds || [])) rememberKnownId(state, id);
  for (const id of uniqueStrings(input.knownItemIds || [])) {
    state.knownItemIds.add(id);
  }
  const sourceSurfaces = [
    input.explicitMemory,
    input.archive,
    input.researchLedger,
    input.openLoops,
    input.candidateSurvival,
  ];
  for (const surfaceItems of sourceSurfaces) {
    for (const item of asArray(surfaceItems).filter(isPlainObject)) {
      rememberItemIds(state, item, [
        'id',
        'sourceId',
        'semanticSourceId',
        'source.sourceId',
        'topicId',
        'loopId',
        'claimId',
      ]);
    }
  }
  for (const item of normalizePromptTruthRenderedItems(input.promptTruth)) {
    rememberItemIds(state, item, ['id', 'sourceId', 'renderedContextId']);
  }
  for (const claim of asArray(input.semanticClaims).filter(isPlainObject)) {
    const normalized = normalizeSemanticClaim(claim);
    rememberKnownId(normalized?.source?.sourceId || '');
    rememberKnownId(normalized?.claimId || '');
  }
}

function summarizeFailures(failures = []) {
  const byFailureMode = {};
  const bySurface = {};
  for (const failure of failures) {
    byFailureMode[failure.failureMode] = (byFailureMode[failure.failureMode] || 0) + 1;
    bySurface[failure.surface] = (bySurface[failure.surface] || 0) + 1;
  }
  return { byFailureMode, bySurface };
}

function summarizeAudit({ surfaces = {}, failures = [] } = {}) {
  const failureSummary = summarizeFailures(failures);
  const totalItems = Object.values(surfaces).reduce((sum, surface) => (
    sum
      + Number(surface.items || 0)
      + Number(surface.renderedItems || 0)
  ), 0);
  return {
    surfaceCount: Object.keys(surfaces).length,
    totalItems,
    failureCount: failures.length,
    byFailureMode: failureSummary.byFailureMode,
    bySurface: failureSummary.bySurface,
    allSourceIdsPresent: failures.every((failure) => ![
      SOURCE_AUDIT_FAILURE_MODES.MISSING_SOURCE_ID,
      SOURCE_AUDIT_FAILURE_MODES.RENDERED_ITEM_MISSING_SOURCE_ID,
      SOURCE_AUDIT_FAILURE_MODES.TOOL_EVIDENCE_MISSING_SOURCE_ID,
      SOURCE_AUDIT_FAILURE_MODES.SEMANTIC_CLAIM_MISSING_SOURCE_ID,
    ].includes(failure.failureMode)),
    cacheSourceMismatches: surfaces.staticEmbeddings?.cacheSourceMismatches || 0,
    renderedItemsWithSourceIds: surfaces.promptTruth?.renderedItemsWithSourceIds || 0,
    renderedItemsMissingSourceIds: surfaces.promptTruth?.renderedItemsMissingSourceIds || 0,
    dynamicLinkMissingTargets: surfaces.dynamicMemoryLinks?.missingTargetEndpoints || 0,
    candidateOnlyVerifiedSupport: false,
    behaviorChanged: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrites: false,
    uriDereferencing: false,
  };
}

function buildCleanSemanticSourceAuditFixtureInput() {
  const userId = buildSemanticEntityId({ entityType: 'user', entityKey: 'self' });
  const explicitSourceId = buildSemanticSourceId({
    sourceType: 'explicit-memory',
    sourceId: 'memory:current-coding-mascot',
  });
  const archiveEpisodeSourceId = buildSemanticSourceId({
    sourceType: 'archive-episode',
    sourceId: 'archive:episode:brass-fox-correction',
  });
  const archiveSummarySourceId = buildSemanticSourceId({
    sourceType: 'archive-summary',
    sourceId: 'archive:summary:mascot-corrections',
  });
  const ledgerSourceId = buildSemanticSourceId({
    sourceType: 'research-ledger',
    sourceId: 'ledger:topic:semantic-contracts',
  });
  const openLoopSourceId = buildSemanticSourceId({
    sourceType: 'open-loop',
    sourceId: 'open-loop:source-id-audit',
  });
  const toolEvidenceSourceId = buildSemanticSourceId({
    sourceType: 'tool-evidence',
    sourceId: 'tool:read:docs-readme',
  });
  const vectorSourceId = buildSemanticVectorSourceId({
    providerId: 'fixture-static',
    modelId: 'potion-base-8m',
    sourceId: archiveEpisodeSourceId,
    sourceHash: 'fixture-archive-episode-hash',
  });
  const claimLike = {
    claimId: '',
    domainId: SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY,
    subject: { id: userId, type: 'user', label: 'the user' },
    predicate: { id: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT },
    object: { type: 'text', text: 'copper rabbit' },
    source: {
      sourceId: explicitSourceId,
      sourceType: 'explicit-memory',
      excerpt: 'current coding mascot = copper rabbit',
      observedAt: '2026-04-22T12:00:00.000Z',
    },
    authority: {
      sourceAuthority: 'canonical',
      supportState: 'verified',
      canonicality: 'canonical',
    },
    temporal: {
      temporalScope: 'current',
      observedAt: '2026-04-22T12:00:00.000Z',
    },
    status: { stale: false },
  };
  const semanticClaim = {
    ...claimLike,
    claimId: buildSemanticClaimId(claimLike),
  };
  const staleClaimLike = {
    claimId: '',
    domainId: SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    subject: { id: userId, type: 'user', label: 'the user' },
    predicate: { id: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT },
    object: { type: 'text', text: 'brass fox' },
    source: {
      sourceId: archiveEpisodeSourceId,
      sourceType: 'archive-episode',
      excerpt: 'previous coding mascot = brass fox',
      observedAt: '2026-04-21T12:00:00.000Z',
    },
    authority: {
      sourceAuthority: 'advisory',
      supportState: 'rendered-advisory',
      canonicality: 'advisory',
    },
    temporal: {
      temporalScope: 'historical',
      observedAt: '2026-04-21T12:00:00.000Z',
    },
    status: {
      stale: true,
      contradictedBy: [semanticClaim.claimId],
      supersededBy: [semanticClaim.claimId],
    },
  };
  const staleSemanticClaim = {
    ...staleClaimLike,
    claimId: buildSemanticClaimId(staleClaimLike),
  };
  const semanticLinkId = buildSemanticLinkId({
    sourceClaimId: semanticClaim.claimId,
    predicateId: SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
    targetClaimId: staleSemanticClaim.claimId,
    domainId: SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY,
    sourceAuthority: 'canonical',
    supportState: 'verified',
  });
  const renderedContextId = buildSemanticRenderedContextId({
    channel: 'session-archive',
    sourceId: archiveEpisodeSourceId,
    claimId: semanticClaim.claimId,
    promptTurnId: 'turn:fixture-source-audit',
    renderedAt: '2026-04-22T12:00:00.000Z',
  });

  return {
    knownSourceIds: [
      explicitSourceId,
      archiveEpisodeSourceId,
      archiveSummarySourceId,
      ledgerSourceId,
      openLoopSourceId,
      toolEvidenceSourceId,
    ],
    knownItemIds: [
      semanticClaim.claimId,
      staleSemanticClaim.claimId,
    ],
    explicitMemory: [
      { id: explicitSourceId, sourceId: explicitSourceId, key: 'current-coding-mascot' },
    ],
    archive: [
      { id: archiveEpisodeSourceId, sourceId: archiveEpisodeSourceId, sourceType: 'archive-episode' },
      { id: archiveSummarySourceId, sourceId: archiveSummarySourceId, sourceType: 'archive-summary' },
    ],
    researchLedger: [
      { id: ledgerSourceId, topicId: ledgerSourceId, sourceId: ledgerSourceId },
    ],
    staticEmbeddings: [
      {
        id: 'static:archive:brass-fox-correction',
        sourceId: archiveEpisodeSourceId,
        cacheSourceId: archiveEpisodeSourceId,
        providerId: 'fixture-static',
        vectorSourceId,
      },
    ],
    promptTruth: {
      renderedItems: [
        {
          channel: 'sessionArchive',
          id: archiveEpisodeSourceId,
          sourceId: archiveEpisodeSourceId,
          renderedContextId,
        },
      ],
    },
    toolEvidenceReceipt: {
      items: [
        {
          id: 'tool-evidence:docs-readme',
          sourceId: toolEvidenceSourceId,
          evidenceType: 'deterministic-read',
        },
      ],
    },
    openLoops: [
      {
        id: openLoopSourceId,
        loopId: openLoopSourceId,
        sourceId: openLoopSourceId,
      },
    ],
    dynamicMemoryLinks: [
      {
        id: 'link:current-coding-mascot-correction',
        linkId: semanticLinkId,
        sourceId: explicitSourceId,
        targetId: archiveEpisodeSourceId,
        sourceClaimId: semanticClaim.claimId,
        targetClaimId: staleSemanticClaim.claimId,
        predicateId: SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
        sourceAuthority: 'canonical',
        supportState: 'verified',
        evidence: [
          {
            sourceId: explicitSourceId,
            excerpt: 'current coding mascot = copper rabbit',
            observedAt: '2026-04-22T12:00:00.000Z',
          },
        ],
        relation: 'correction-of',
      },
    ],
    candidateSurvival: [
      {
        id: archiveEpisodeSourceId,
        sourceId: archiveEpisodeSourceId,
        semanticClaim,
      },
    ],
    semanticClaims: [semanticClaim, staleSemanticClaim],
  };
}

function buildSemanticSourceAuditArtifact({
  generatedAt = new Date().toISOString(),
  measurementMode = SOURCE_AUDIT_MEASUREMENT_MODES.FIXTURE_ONLY,
  input = buildCleanSemanticSourceAuditFixtureInput(),
} = {}) {
  const mode = normalizeMeasurementMode(measurementMode);
  const auditInput = isPlainObject(input) ? input : {};
  const state = createAuditState({
    knownSourceIds: auditInput.knownSourceIds,
    knownItemIds: auditInput.knownItemIds,
  });
  preloadKnownIds(state, auditInput);

  const surfaces = {
    [SOURCE_AUDIT_SURFACES.EXPLICIT_MEMORY]: auditSourceItemSurface(state, {
      surface: SOURCE_AUDIT_SURFACES.EXPLICIT_MEMORY,
      items: auditInput.explicitMemory,
      sourcePaths: ['sourceId', 'semanticSourceId', 'id'],
      itemIdPaths: ['id', 'key', 'sourceId'],
    }),
    [SOURCE_AUDIT_SURFACES.ARCHIVE]: auditSourceItemSurface(state, {
      surface: SOURCE_AUDIT_SURFACES.ARCHIVE,
      items: auditInput.archive,
      sourcePaths: ['sourceId', 'semanticSourceId', 'id'],
      itemIdPaths: ['id', 'episodeId', 'summaryId', 'sourceId'],
    }),
    [SOURCE_AUDIT_SURFACES.RESEARCH_LEDGER]: auditSourceItemSurface(state, {
      surface: SOURCE_AUDIT_SURFACES.RESEARCH_LEDGER,
      items: auditInput.researchLedger,
      sourcePaths: ['sourceId', 'semanticSourceId', 'topicId', 'id'],
      itemIdPaths: ['id', 'topicId', 'sourceId'],
    }),
    [SOURCE_AUDIT_SURFACES.STATIC_EMBEDDINGS]: auditStaticEmbeddings(state, auditInput.staticEmbeddings),
    [SOURCE_AUDIT_SURFACES.PROMPT_TRUTH]: auditPromptTruth(state, auditInput.promptTruth),
    [SOURCE_AUDIT_SURFACES.TOOL_EVIDENCE_RECEIPT]: auditToolEvidenceReceipt(state, auditInput.toolEvidenceReceipt),
    [SOURCE_AUDIT_SURFACES.OPEN_LOOPS]: auditSourceItemSurface(state, {
      surface: SOURCE_AUDIT_SURFACES.OPEN_LOOPS,
      items: auditInput.openLoops,
      sourcePaths: ['sourceId', 'semanticSourceId', 'loopId', 'id'],
      itemIdPaths: ['id', 'loopId', 'sourceId'],
    }),
    [SOURCE_AUDIT_SURFACES.CANDIDATE_SURVIVAL]: auditSourceItemSurface(state, {
      surface: SOURCE_AUDIT_SURFACES.CANDIDATE_SURVIVAL,
      items: auditInput.candidateSurvival,
      sourcePaths: ['sourceId', 'semanticSourceId', 'semanticClaim.sourceId', 'semanticClaim.source.sourceId', 'id'],
      itemIdPaths: ['id', 'candidateId', 'sourceId'],
    }),
    [SOURCE_AUDIT_SURFACES.SEMANTIC_CLAIMS]: auditSemanticClaims(state, auditInput.semanticClaims),
  };

  surfaces[SOURCE_AUDIT_SURFACES.DYNAMIC_MEMORY_LINKS] = auditDynamicMemoryLinks(state, auditInput.dynamicMemoryLinks, {
    requireKnownEndpoints: auditInput.requireKnownLinkEndpoints !== false,
  });

  const failures = state.failures;
  return {
    schema: PENNY_SEMANTIC_SOURCE_AUDIT_SCHEMA,
    claimSchema: PENNY_SEMANTIC_CLAIM_SCHEMA,
    artifactKind: 'semantic-source-id-audit',
    generatedAt,
    measurementMode: mode,
    runnerMode: mode,
    behaviorChanged: false,
    liveModelCalls: false,
    liveChatTouched: false,
    runtimeVoiceChanged: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrites: false,
    graphDbMigration: false,
    rdfParserAdded: false,
    sparqlAdded: false,
    uriDereferencing: false,
    surfaces,
    summary: summarizeAudit({ surfaces, failures }),
    failures,
    limits: [...SOURCE_AUDIT_LIMITS],
  };
}

module.exports = {
  PENNY_SEMANTIC_SOURCE_AUDIT_SCHEMA,
  SOURCE_AUDIT_FAILURE_MODES,
  SOURCE_AUDIT_LIMITS,
  SOURCE_AUDIT_MEASUREMENT_MODES,
  SOURCE_AUDIT_SURFACES,
  buildCleanSemanticSourceAuditFixtureInput,
  buildSemanticSourceAuditArtifact,
  normalizeMeasurementMode,
  validateSourceIdValue,
};
