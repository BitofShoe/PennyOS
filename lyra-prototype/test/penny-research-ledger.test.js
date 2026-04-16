const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createResearchLedgerApi } = require('../lib/penny-research-ledger');

function buildApi(now = Date.UTC(2026, 3, 16, 12, 0, 0)) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-ledger-test-'));
  const ledgerFile = path.join(tmpDir, 'penny-memory-ledger.test.json');
  const api = createResearchLedgerApi({
    fs,
    path,
    LEDGER_FILE: ledgerFile,
    nowMs: () => now,
  });
  return {
    api,
    ledgerFile,
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

test('research ledger ignores casual chat without verified evidence', () => {
  const { api, cleanup } = buildApi();
  try {
    const result = api.updateResearchLedgerFromTurn({
      sessionId: 'demo',
      userText: 'be a little flirty and dangerous',
      assistantText: 'cute. come here then.',
      selectedLane: 'chat',
      backend: 'local-lmstudio',
    });
    assert.equal(result.updated, false);
    assert.equal(Object.keys(api.readLedgerStore().topics).length, 0);
  } finally {
    cleanup();
  }
});

test('research ledger stores verified repo investigations and exposes bounded prompt context', () => {
  const { api, cleanup } = buildApi();
  try {
    const result = api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'What is the npm test script in package.json, and do we still need to verify a Vitest migration?',
      assistantText: 'package.json still uses node --test test/*.test.js. We should verify the Vitest migration separately before claiming anything.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [
        {
          name: 'read_project_file',
          result: {
            ok: true,
            label: 'read package.json',
            data: {
              path: 'package.json',
              textPreview: '"test": "node --test test/*.test.js"',
            },
          },
        },
      ],
    });

    assert.equal(result.updated, true);
    assert.equal(result.topic.topicLabel, 'package.json');
    assert.equal(result.topic.status, 'open');
    assert.equal(result.topic.evidenceRefs.length, 1);

    const promptContext = api.getPromptContext({
      sessionId: 'qa-ledger',
      userText: 'check package.json again',
    });
    assert.equal(promptContext.topics.length, 1);
    assert.equal(promptContext.topics[0].topicLabel, 'package.json');
    assert.match(promptContext.topics[0].summary, /open follow-up/i);
    assert.deepEqual(promptContext.topics[0].sourceSessionIds, ['qa-ledger']);
    assert.equal(promptContext.topics[0].sourceTurnIds.length > 0, true);
  } finally {
    cleanup();
  }
});

test('research ledger tracks contradiction-driven updates and session purge clears session topics', () => {
  const { api, cleanup } = buildApi();
  try {
    const result = api.updateResearchLedgerFromTurn({
      sessionId: 'memory-demo',
      userText: 'Actually, my favorite tea is lapsang souchong now.',
      assistantText: 'Noted. Favorite tea is lapsang souchong now, replacing the old oolong note.',
      selectedLane: 'chat',
      backend: 'local-lmstudio',
      provenance: [
        {
          conflictKey: 'favorite tea',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
        },
      ],
    });

    assert.equal(result.updated, true);
    assert.equal(result.topic.status, 'provisional');
    assert.equal(result.topic.contradictions.length, 1);

    const inspector = api.getResearchLedgerInspector({ sessionId: 'memory-demo' });
    assert.equal(inspector.topicCount, 1);
    assert.equal(inspector.provisionalCount, 1);

    const purge = api.purgeResearchLedger({
      sessionId: 'memory-demo',
      clearSessionLedger: true,
    });
    assert.equal(purge.clearedSessionTopics, 1);
    assert.equal(api.getResearchLedgerInspector({ sessionId: 'memory-demo' }).topicCount, 0);
  } finally {
    cleanup();
  }
});
