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

function gitStatusToolRecord() {
  return {
    name: 'get_git_status',
    result: {
      ok: true,
      label: 'git status',
      data: {},
    },
  };
}

function insertInProjectFileToolRecord(targetPath = 'README.md') {
  return {
    name: 'insert_in_project_file',
    args: {
      path: targetPath,
      text: 'placeholder',
    },
    result: {
      ok: true,
      label: `insert ${targetPath}`,
      data: {
        path: targetPath,
      },
    },
  };
}

test('research ledger fails closed without replacing malformed JSON', () => {
  const { api, ledgerFile, cleanup } = buildApi();
  const corrupt = '{"topics":';
  try {
    fs.writeFileSync(ledgerFile, corrupt, 'utf8');
    assert.deepEqual(api.readLedgerStore().topics, {});
    assert.throws(() => api.writeLedgerStore({}), /remains untouched until it is repaired/i);
    assert.equal(fs.readFileSync(ledgerFile, 'utf8'), corrupt);
  } finally {
    cleanup();
  }
});

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

test('research ledger lexical reorders of the same anchored question merge into one scoped topic', () => {
  const { api, cleanup } = buildApi();
  try {
    const phrasings = [
      'Does package.json keep node 22 engines pin?',
      'Does package.json keep engines node 22 pin?',
      'Does package.json keep 22 node engines pin?',
      'Does package.json keep pin node 22 engines?',
    ];
    const results = phrasings.map((userText) => api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText,
      assistantText: 'package.json still pins Node 22 in engines.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord('"engines": { "node": "22.x" }')],
    }));

    const store = api.readLedgerStore();
    const topicIds = [...new Set(results.map((item) => item?.topic?.topicId).filter(Boolean))];

    assert.equal(results.every((item) => item.updated === true), true);
    assert.equal(Object.keys(store.topics).length, 1);
    assert.equal(topicIds.length, 1);
  } finally {
    cleanup();
  }
});

test('research ledger stores evidence-tight conclusions instead of raw broader assistant synthesis', () => {
  const { api, cleanup } = buildApi();
  try {
    const result = api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'Does package.json pin Node 22, and does that prove the repo is modern?',
      assistantText: 'package.json pins Node 22, so yes, the repo is modern.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [readPackageJsonToolRecord('"engines": { "node": "22.x" }')],
    });

    const promptContext = api.getPromptContext({
      sessionId: 'qa-ledger',
      userText: 'What did we verify in package.json?',
    });

    assert.equal(result.updated, true);
    assert.equal(result.topic.status, 'settled');
    assert.equal(result.topic.sourceClass, 'verified-evidence');
    assert.equal(result.topic.summaryClass, 'evidence-tight');
    assert.equal(result.topic.summaryEvidenceRefs.length, 1);
    assert.match(result.topic.conclusion, /verified in package\.json/i);
    assert.match(result.topic.conclusion, /22\.x/i);
    assert.doesNotMatch(result.topic.conclusion, /repo is modern/i);
    assert.equal(promptContext.topics[0].summary, result.topic.conclusion);
  } finally {
    cleanup();
  }
});

test('research ledger keeps verified evidence provisional when no evidence-tight summary can be formed', () => {
  const { api, cleanup } = buildApi();
  try {
    const result = api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'Does git status prove the repo is clean and ready to ship?',
      assistantText: 'git status is clean, so yes, the repo is ready to ship.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolRecords: [gitStatusToolRecord()],
    });

    const promptContext = api.getPromptContext({
      sessionId: 'qa-ledger',
      userText: 'What are we still checking about git status?',
    });

    assert.equal(result.updated, true);
    assert.equal(result.topic.status, 'provisional');
    assert.equal(result.topic.sourceClass, 'verified-evidence');
    assert.equal(result.topic.summaryClass, 'question-carryover');
    assert.equal(result.topic.conclusion, '');
    assert.deepEqual(result.topic.summaryEvidenceRefs, []);
    assert.equal(promptContext.topics[0].summary, result.topic.question);
  } finally {
    cleanup();
  }
});

test('research ledger skips generic authored write turns even when git status verifies the workspace changed', () => {
  const { api, cleanup } = buildApi();
  try {
    const result = api.updateResearchLedgerFromTurn({
      sessionId: 'playground-write',
      userText: "Open Penny's Playground/penny-qa-freewrite.md and add 2-4 sentences in your own Penny voice. I am not giving you a topic on purpose. You can write whatever you want there. Then tell me exactly what you changed.",
      assistantText: "I added three soft sentences about the blank page and told you exactly what I changed in Penny's Playground/penny-qa-freewrite.md.",
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolOutcome: {
        writeIntentRequired: true,
        writeIntentSatisfied: true,
        confirmedWriteCount: 1,
      },
      toolRecords: [
        insertInProjectFileToolRecord("Penny's Playground/penny-qa-freewrite.md"),
        gitStatusToolRecord(),
      ],
    });

    assert.equal(result.updated, false);
    assert.equal(result.reason, 'generic-write-turn');
    assert.equal(Object.keys(api.readLedgerStore().topics).length, 0);
  } finally {
    cleanup();
  }
});

test('research ledger still keeps research-shaped write turns when anchored evidence was actually verified', () => {
  const { api, cleanup } = buildApi();
  try {
    const result = api.updateResearchLedgerFromTurn({
      sessionId: 'qa-ledger',
      userText: 'Inspect package.json, verify the npm test script, then update README.md with a one-line note about what you verified.',
      assistantText: 'I checked package.json, verified the npm test script is node --test test/*.test.js, and added a short README note about it.',
      selectedLane: 'tool',
      backend: 'local-lmstudio-tools',
      toolOutcome: {
        writeIntentRequired: true,
        writeIntentSatisfied: true,
        confirmedWriteCount: 1,
      },
      toolRecords: [
        readPackageJsonToolRecord(),
        insertInProjectFileToolRecord('README.md'),
        gitStatusToolRecord(),
      ],
    });

    assert.equal(result.updated, true);
    assert.equal(result.topic.identity.anchorRef, 'package.json');
    assert.equal(result.topic.sourceClass, 'verified-evidence');
    assert.equal(result.topic.summaryClass, 'evidence-tight');
    assert.match(result.topic.conclusion, /verified in package\.json/i);
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
    assert.equal(contradiction.topic.sourceClass, 'contradiction');
    assert.equal(contradiction.topic.summaryClass, 'contradiction-provenance');

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
