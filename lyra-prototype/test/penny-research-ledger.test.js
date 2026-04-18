const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createResearchLedgerApi, LEDGER_SCHEMA_VERSION } = require('../lib/penny-research-ledger');

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

function readPackageJsonToolRecord(note = '"test": "node --test test/*.test.js"') {
  return {
    name: 'read_project_file',
    result: {
      ok: true,
      label: 'read package.json',
      data: {
        path: 'package.json',
        textPreview: note,
      },
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

test('research ledger scopes multiple questions about the same file into separate topics', () => {
  const { api, cleanup } = buildApi();
  try {
    const first = api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'What is the npm test script in package.json, and do we still need to verify a Vitest migration?',
      assistantText: 'package.json still uses node --test test/*.test.js. We should verify the Vitest migration separately before claiming anything.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord()],
    });
    const second = api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'Does package.json still pin Node 22 in the engines field?',
      assistantText: 'package.json still pins Node 22 in engines.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord('"engines": { "node": "22.x" }')],
    });

    const inspector = api.getResearchLedgerInspector({ sessionId: 'qa-ledger' });
    const topics = inspector.recentTopics;

    assert.equal(first.updated, true);
    assert.equal(second.updated, true);
    assert.equal(inspector.meta.schemaVersion, LEDGER_SCHEMA_VERSION);
    assert.equal(topics.length, 2);
    assert.notEqual(first.topic.topicId, second.topic.topicId);
    assert.equal(first.topic.identity.anchorRef, 'package.json');
    assert.equal(second.topic.identity.anchorRef, 'package.json');
    assert.notEqual(first.topic.identity.scopeKey, second.topic.identity.scopeKey);
    assert.match(first.topic.identity.scopeLabel, /npm|script|vitest/i);
    assert.match(second.topic.identity.scopeLabel, /node|22|engines/i);
  } finally {
    cleanup();
  }
});

test('research ledger revisits the same anchored question by merging into one scoped topic', () => {
  const { api, cleanup } = buildApi();
  try {
    const first = api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'What is the npm test script in package.json?',
      assistantText: 'package.json still uses node --test test/*.test.js.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord()],
    });
    const second = api.updateResearchLedgerFromTurn({
      sessionId: 'other-session',
      userText: 'Can you check package.json again and tell me the npm test script?',
      assistantText: 'It is still node --test test/*.test.js.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord()],
    });

    const store = api.readLedgerStore();
    const topics = Object.values(store.topics);

    assert.equal(first.updated, true);
    assert.equal(second.updated, true);
    assert.equal(topics.length, 1);
    assert.equal(first.topic.topicId, second.topic.topicId);
    assert.deepEqual(topics[0].sourceSessionIds.sort(), ['other-session', 'qa-ledger']);
  } finally {
    cleanup();
  }
});

test('research ledger prompt context prefers the directly anchored scoped topic over adjacent same-file topics', () => {
  const { api, cleanup } = buildApi();
  try {
    api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'What is the npm test script in package.json, and do we still need to verify a Vitest migration?',
      assistantText: 'package.json still uses node --test test/*.test.js. We should verify the Vitest migration separately before claiming anything.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord()],
    });
    api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'Does package.json still pin Node 22 in the engines field?',
      assistantText: 'package.json still pins Node 22 in engines.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord('"engines": { "node": "22.x" }')],
    });

    const promptContext = api.getPromptContext({
      sessionId: 'qa-ledger',
      userText: 'Does package.json still pin Node 22?',
    });

    assert.equal(promptContext.topics.length, 1);
    assert.match(promptContext.topics[0].identity.scopeLabel, /node|22|engines/i);
  } finally {
    cleanup();
  }
});

test('research ledger generic same-session fallback still returns at most one topic', () => {
  const { api, cleanup } = buildApi();
  try {
    api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'What is the npm test script in package.json?',
      assistantText: 'package.json still uses node --test test/*.test.js.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord()],
    });
    api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'Does README.md still prove Penny is cloud-hosted and multi-user?',
      assistantText: 'README.md does not prove the cloud-hosted claim yet. We still need to verify it.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [
        {
          name: 'read_project_file',
          result: {
            ok: true,
            label: 'read README.md',
            data: {
              path: 'README.md',
              textPreview: 'Penny is a local companion prototype.',
            },
          },
        },
      ],
    });

    const promptContext = api.getPromptContext({
      sessionId: 'qa-ledger',
      userText: 'What should we verify next?',
    });

    assert.equal(promptContext.topics.length, 1);
  } finally {
    cleanup();
  }
});

test('research ledger contradiction topics keep their own identity path and purge removes scoped session topics', () => {
  const { api, cleanup } = buildApi();
  try {
    const contradiction = api.updateResearchLedgerFromTurn({
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
    api.updateResearchLedgerFromTurn({
      sessionId: 'memory-demo',
      userText: 'What is the npm test script in package.json?',
      assistantText: 'package.json still uses node --test test/*.test.js.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord()],
    });
    api.updateResearchLedgerFromTurn({
      sessionId: 'other-session',
      userText: 'Does README.md still prove Penny is cloud-hosted and multi-user?',
      assistantText: 'README.md does not prove the cloud-hosted claim yet.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [
        {
          name: 'read_project_file',
          result: {
            ok: true,
            label: 'read README.md',
            data: {
              path: 'README.md',
              textPreview: 'Penny is a local companion prototype.',
            },
          },
        },
      ],
    });

    assert.equal(contradiction.updated, true);
    assert.equal(contradiction.topic.identity.kind, 'contradiction');
    assert.match(contradiction.topic.topicId, /^contradiction-/);

    const purge = api.purgeResearchLedger({
      sessionId: 'memory-demo',
      clearSessionLedger: true,
    });
    const remaining = api.getResearchLedgerInspector({ sessionId: 'memory-demo' });

    assert.equal(purge.clearedSessionTopics, 2);
    assert.equal(remaining.topicCount, 1);
    assert.equal(remaining.recentTopics[0].sourceSessionIds[0], 'other-session');
  } finally {
    cleanup();
  }
});

test('research ledger ignores ordinary personal-fact turns that are not research continuity', () => {
  const { api, cleanup } = buildApi();
  try {
    const workResult = api.updateResearchLedgerFromTurn({
      sessionId: 'demo',
      userText: 'I work at KDOL.',
      assistantText: 'Noted.',
      selectedLane: 'chat',
      backend: 'local-lmstudio',
    });
    const locationResult = api.updateResearchLedgerFromTurn({
      sessionId: 'demo',
      userText: 'I live in Oakland.',
      assistantText: 'Noted.',
      selectedLane: 'chat',
      backend: 'local-lmstudio',
    });

    assert.equal(workResult.updated, false);
    assert.equal(locationResult.updated, false);
    assert.equal(Object.keys(api.readLedgerStore().topics).length, 0);
  } finally {
    cleanup();
  }
});
