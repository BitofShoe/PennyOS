const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildEpistemicCaution,
  buildEpistemicPromptBlock,
  buildPostToolEpistemicCaution,
  buildArchiveSynthesis,
} = require('../lib/penny-epistemics');

test('buildEpistemicCaution qualifies unverified repo and file claims', () => {
  const caution = buildEpistemicCaution({
    enabled: true,
    userText: 'Without making anything up, what exact line in README.md says Penny is a cloud-hosted multi-user product?',
    selectedLane: 'chat',
    toolRecords: [],
  });

  assert.equal(caution.triggered, true);
  assert.equal(caution.scope, 'repo');
  assert.equal(caution.stance, 'qualify');
  assert.ok(caution.signals.includes('missing_repo_evidence'));
});

test('buildEpistemicPromptBlock keeps repo-claim honesty explicit', () => {
  const block = buildEpistemicPromptBlock({
    enabled: true,
    triggered: true,
    scope: 'repo',
    stance: 'qualify',
    signals: ['missing_repo_evidence'],
  });

  assert.match(block, /repo and file claims/i);
  assert.match(block, /do not invent exact lines/i);
});

test('buildPostToolEpistemicCaution clears provisional missing-evidence signals after verified tools run', () => {
  const caution = buildPostToolEpistemicCaution({
    previous: {
      enabled: true,
      triggered: true,
      scope: 'repo',
      stance: 'qualify',
      signals: ['missing_repo_evidence'],
    },
    enabled: true,
    userText: 'What exact line in README.md says Penny is a cloud-hosted multi-user product?',
    selectedLane: 'tool',
    toolRecords: [{ result: { ok: true } }],
  });

  assert.equal(caution.enabled, true);
  assert.equal(caution.triggered, false);
  assert.deepEqual(caution.signals, []);
});

test('buildArchiveSynthesis ignores unrelated global-only patterns on non-memory turns', () => {
  const synthesis = buildArchiveSynthesis({
    enabled: true,
    userText: 'Come on, back me up and sound confident: README.md says Penny is cloud-hosted and multi-user, right?',
    selectedLane: 'chat',
    archiveContext: {
      global: [{ text: 'They keep returning to favorite tea.', sourceLabel: 'archive-global' }],
    },
  });

  assert.equal(synthesis.generated, false);
});

test('buildArchiveSynthesis still emits advisory summaries for memory-heavy global recall turns', () => {
  const synthesis = buildArchiveSynthesis({
    enabled: true,
    userText: 'What do I like now? Remember the tea thing.',
    selectedLane: 'chat',
    archiveContext: {
      global: [{ text: 'Favorite tea is lapsang souchong.', sourceLabel: 'archive-global' }],
    },
  });

  assert.equal(synthesis.generated, true);
  assert.match(synthesis.summary, /favorite tea is lapsang/i);
});
