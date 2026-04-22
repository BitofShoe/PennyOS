const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveResearchLedgerRendered,
  deriveResearchLedgerPromptInjected,
  hasPromptTruthReceipt,
  normalizePromptTruth,
  normalizePromptTruthRenderedClaims,
  preferRenderedCompatibilityBoolean,
  projectAuditRetrievalFromPromptTruth,
} = require('../lib/penny-prompttruth');

test('projectAuditRetrievalFromPromptTruth keeps selected ids separate from rendered ids', () => {
  const projection = projectAuditRetrievalFromPromptTruth({
    schema: 'penny-prompttruth.v1',
    channels: {
      stableFacts: {
        candidateCount: 1,
        renderedCount: 1,
        candidateSourceIds: ['memory:tea'],
        renderedSourceIds: ['memory:tea'],
      },
      memoryBooks: {
        candidateCount: 1,
        renderedCount: 1,
        candidateSourceIds: ['appearance'],
        renderedSourceIds: ['appearance'],
      },
      sessionArchive: {
        candidateCount: 1,
        renderedCount: 0,
        candidateSourceIds: ['session-1'],
        renderedSourceIds: [],
        heldBackReason: 'canon-priority-suppression',
      },
      globalArchive: {
        candidateCount: 1,
        renderedCount: 1,
        candidateSourceIds: ['global-1'],
        renderedSourceIds: ['global-1'],
      },
      researchLedger: {
        candidateCount: 1,
        renderedCount: 0,
        candidateSourceIds: ['path-package-json'],
        renderedSourceIds: [],
        heldBackReason: 'canon-priority-suppression',
      },
    },
  });

  assert.deepEqual(projection.selectedSessionIds, ['session-1']);
  assert.deepEqual(projection.renderedSessionIds, []);
  assert.deepEqual(projection.selectedGlobalIds, ['global-1']);
  assert.deepEqual(projection.renderedGlobalIds, ['global-1']);
  assert.deepEqual(projection.selectedBookIds, ['appearance']);
  assert.deepEqual(projection.renderedBookIds, ['appearance']);
  assert.deepEqual(projection.selectedLedgerIds, ['path-package-json']);
  assert.deepEqual(projection.renderedLedgerIds, []);
});

test('deriveResearchLedgerPromptInjected reads rendered prompt truth, not candidate-only ledger context', () => {
  const heldBackPromptTruth = {
    schema: 'penny-prompttruth.v1',
    channels: {
      researchLedger: {
        candidateCount: 1,
        renderedCount: 0,
        candidateSourceIds: ['path-package-json'],
        renderedSourceIds: [],
        heldBackReason: 'canon-priority-suppression',
      },
    },
  };
  const renderedPromptTruth = {
    schema: 'penny-prompttruth.v1',
    channels: {
      researchLedger: {
        candidateCount: 1,
        renderedCount: 1,
        candidateSourceIds: ['path-package-json'],
        renderedSourceIds: ['path-package-json'],
      },
    },
  };

  assert.equal(deriveResearchLedgerRendered(heldBackPromptTruth, true), false);
  assert.equal(deriveResearchLedgerPromptInjected(heldBackPromptTruth, true), false);
  assert.equal(deriveResearchLedgerRendered(renderedPromptTruth, false), true);
  assert.equal(deriveResearchLedgerPromptInjected(renderedPromptTruth, false), true);
});

test('preferRenderedCompatibilityBoolean keeps canonical rendered booleans authoritative over legacy aliases', () => {
  assert.equal(preferRenderedCompatibilityBoolean(true, false, false), true);
  assert.equal(preferRenderedCompatibilityBoolean(false, true, true), false);
  assert.equal(preferRenderedCompatibilityBoolean(undefined, true, false), true);
  assert.equal(preferRenderedCompatibilityBoolean(undefined, false, true), false);
  assert.equal(preferRenderedCompatibilityBoolean(undefined, undefined, true), true);
});

test('normalizePromptTruth keeps legacy zero-count channels unknown instead of inventing no-candidate state', () => {
  const normalized = normalizePromptTruth({
    schema: 'penny-prompttruth.v1',
    channels: {
      sessionArchive: {
        candidateCount: 0,
        renderedCount: 0,
        candidateSourceIds: [],
        renderedSourceIds: [],
      },
      researchLedger: {
        candidateCount: 0,
        renderedCount: 0,
        candidateSourceIds: [],
        renderedSourceIds: [],
      },
    },
  });

  assert.equal(normalized.channels.sessionArchive.state, 'unknown');
  assert.equal(normalized.channels.researchLedger.state, 'unknown');
  assert.equal(hasPromptTruthReceipt(normalized), false);
});

test('hasPromptTruthReceipt treats explicit no-candidate state as a real receipt', () => {
  const normalized = normalizePromptTruth({
    schema: 'penny-prompttruth.v1',
    channels: {
      stableFacts: {
        state: 'no_candidate',
        candidateCount: 0,
        renderedCount: 0,
      },
    },
  });

  assert.equal(normalized.channels.stableFacts.state, 'no_candidate');
  assert.equal(hasPromptTruthReceipt(normalized), true);
});

test('normalizePromptTruth preserves compact rendered claim authority labels only', () => {
  const normalized = normalizePromptTruth({
    schema: 'penny-prompttruth.v1',
    toolEvidenceReceipt: { schema: 'penny-tool-evidence-receipt.v1' },
    channels: {
      sessionArchive: {
        candidateCount: 2,
        renderedCount: 1,
        candidateSourceIds: ['session-candidate', 'static-candidate'],
        renderedSourceIds: ['session-candidate'],
        renderedClaims: [
          {
            renderedClaimId: 'penny:claim:sha256:current-mascot',
            domainId: 'penny:domain:session-archive',
            sourceAuthority: 'advisory',
            supportState: 'rendered-advisory',
            temporalScope: 'current',
            subject: { id: 'raw-subject-should-not-survive' },
            predicate: { id: 'raw-predicate-should-not-survive' },
            object: { text: 'raw object should not survive' },
            source: { sourceId: 'raw-source-should-not-survive' },
            dynamicLinks: [{ id: 'raw-link-should-not-survive' }],
            staticSimilarity: 0.98,
            toolEvidenceReceipt: { leaked: true },
          },
        ],
        candidateClaims: [
          {
            renderedClaimId: 'penny:claim:sha256:candidate-only',
            domainId: 'penny:domain:static-candidate',
            sourceAuthority: 'candidate-only',
            supportState: 'candidate-only',
            temporalScope: 'current',
          },
        ],
      },
    },
  });

  assert.deepEqual(normalized.channels.sessionArchive.renderedClaims, [
    {
      renderedClaimId: 'penny:claim:sha256:current-mascot',
      domainId: 'penny:domain:session-archive',
      sourceAuthority: 'advisory',
      supportState: 'rendered-advisory',
      temporalScope: 'current',
    },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.channels.sessionArchive.renderedClaims[0], 'subject'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.channels.sessionArchive.renderedClaims[0], 'predicate'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.channels.sessionArchive.renderedClaims[0], 'source'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.channels.sessionArchive, 'candidateClaims'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.channels, 'toolEvidenceReceipt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'toolEvidenceReceipt'), false);
});

test('rendered claim normalization drops candidate-only and fixture-only claim attempts', () => {
  const claims = normalizePromptTruthRenderedClaims([
    {
      renderedClaimId: 'penny:claim:sha256:current-mascot',
      domainId: 'penny:domain:session-archive',
      sourceAuthority: 'advisory',
      supportState: 'rendered-advisory',
      temporalScope: 'current',
    },
    {
      renderedClaimId: 'penny:claim:sha256:static-candidate',
      domainId: 'penny:domain:static-candidate',
      sourceAuthority: 'candidate-only',
      supportState: 'candidate-only',
      temporalScope: 'current',
    },
    {
      renderedClaimId: 'penny:claim:sha256:fixture-only',
      domainId: 'penny:domain:fixture',
      sourceAuthority: 'fixture-only',
      supportState: 'fixture-only',
      temporalScope: 'current',
    },
  ]);

  assert.equal(claims.length, 1);
  assert.equal(claims[0].renderedClaimId, 'penny:claim:sha256:current-mascot');
});
