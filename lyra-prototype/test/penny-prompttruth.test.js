const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveResearchLedgerPromptInjected,
  hasPromptTruthReceipt,
  normalizePromptTruth,
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
  assert.equal(deriveResearchLedgerPromptInjected({
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
  }, true), false);

  assert.equal(deriveResearchLedgerPromptInjected({
    schema: 'penny-prompttruth.v1',
    channels: {
      researchLedger: {
        candidateCount: 1,
        renderedCount: 1,
        candidateSourceIds: ['path-package-json'],
        renderedSourceIds: ['path-package-json'],
      },
    },
  }, false), true);
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
