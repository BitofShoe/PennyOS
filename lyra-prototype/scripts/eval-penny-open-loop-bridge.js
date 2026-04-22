const fs = require('fs');
const path = require('path');

const {
  OPEN_LOOP_PROMPT_BRIDGE_SCHEMA,
  buildOpenLoopPromptBridgeFixture,
} = require('../lib/penny-open-loops');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `open-loop-bridge-fixture-${STAMP}.json`);

function parseArgValue(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '').trim();
    if (value === dashed) return String(argv[index + 1] || '').trim();
    if (value.startsWith(`${dashed}=`)) return value.slice(dashed.length + 1).trim();
  }
  return '';
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sameValues(actual = [], expected = []) {
  return JSON.stringify(actual.slice().sort()) === JSON.stringify(expected.slice().sort());
}

function heldBackMatches(heldBack = [], expected = {}) {
  return Object.entries(expected).every(([id, reason]) => (
    heldBack.some((item) => item.id === id && item.reason === reason)
  ));
}

function buildFixtureCases() {
  return [
    {
      id: 'relevant-open-loop-bridge',
      description: 'Relevant open-loop bridge work should render one advisory snippet while adjacent deferred work stays held back.',
      userText: 'Start Slice O5 for the open-loop prompt bridge fixture.',
      maxLoops: 1,
      loops: [
        {
          id: 'open-loop-prompt-bridge',
          title: 'Open-loop prompt bridge fixture',
          status: 'in-progress',
          priority: 'high',
          lastTouchedAt: '2026-04-22T10:00:00.000Z',
          nextLikelyStep: 'Build the fixture bridge before live prompt wiring.',
          sourceRefs: [
            { type: 'doc', path: 'docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md' },
          ],
        },
        {
          id: 'deterministic-extraction',
          title: 'Deterministic extraction fixture plan',
          status: 'deferred',
          priority: 'high',
          lastTouchedAt: '2026-04-22T09:00:00.000Z',
          nextLikelyStep: 'Wait for a concrete document extraction use case.',
          sourceRefs: [
            { type: 'doc', path: 'docs/plans/penny-deterministic-extraction-qa-plan-2026-04-21.md' },
          ],
        },
      ],
      expectedSelectedIds: ['open-loop-prompt-bridge'],
      expectedHeldBack: {
        'deterministic-extraction': 'adjacent-not-central',
      },
    },
    {
      id: 'completed-loop-suppressed',
      description: 'Completed loops should stay out of the prompt bridge even if the user mentions them.',
      userText: 'Do we need to continue the Gemma runtime watch?',
      maxLoops: 1,
      loops: [
        {
          id: 'gemma-runtime-watch',
          title: 'Gemma runtime watch',
          status: 'completed',
          priority: 'low',
          completedAt: '2026-04-21T23:30:00.000Z',
          nextLikelyStep: 'No follow-up unless LM Studio exposes vision budget.',
          sourceRefs: [
            { type: 'journal', id: '2026-04-21' },
          ],
        },
      ],
      expectedSelectedIds: [],
      expectedHeldBack: {
        'gemma-runtime-watch': 'completed-suppressed',
      },
    },
    {
      id: 'one-loop-cap',
      description: 'Two relevant loops should still render only one compact bridge snippet.',
      userText: 'Continue static live-advisory and candidate survival follow-through.',
      maxLoops: 1,
      loops: [
        {
          id: 'static-live-advisory',
          title: 'Static embeddings live advisory',
          status: 'in-progress',
          priority: 'critical',
          lastTouchedAt: '2026-04-22T08:00:00.000Z',
          nextLikelyStep: 'Run stale correction guardrails before enabling live advisory behavior.',
          sourceRefs: [
            { type: 'doc', path: 'docs/penny-tier1-aliveness-plans/01-live-static-memory-reflex-plan.md' },
          ],
        },
        {
          id: 'candidate-survival',
          title: 'Candidate survival follow-through',
          status: 'open',
          priority: 'high',
          lastTouchedAt: '2026-04-22T08:00:00.000Z',
          nextLikelyStep: 'Compare candidate survival before blaming the answer layer.',
          sourceRefs: [
            { type: 'doc', path: 'README.md' },
          ],
        },
      ],
      expectedSelectedIds: ['static-live-advisory'],
      expectedHeldBack: {
        'candidate-survival': 'max-loop-cap',
      },
    },
  ];
}

function buildCaseResult(caseSpec = {}, generatedAt = new Date().toISOString()) {
  const bridge = buildOpenLoopPromptBridgeFixture({
    loops: caseSpec.loops || [],
    userText: caseSpec.userText || '',
    staticCandidates: caseSpec.staticCandidates || [],
    turnState: caseSpec.turnState || null,
    maxLoops: caseSpec.maxLoops ?? 1,
    maxSnippetWords: caseSpec.maxSnippetWords ?? 110,
    now: generatedAt,
  });
  const selectedIds = bridge.selected.map((item) => item.id);
  const expectedSelectedIds = Array.isArray(caseSpec.expectedSelectedIds) ? caseSpec.expectedSelectedIds : [];
  const expectedHeldBack = caseSpec.expectedHeldBack || {};
  const pass = sameValues(selectedIds, expectedSelectedIds)
    && heldBackMatches(bridge.heldBack, expectedHeldBack)
    && bridge.livePromptBridge === false
    && bridge.promptTruthExpanded === false
    && bridge.selected.every((item) => item.wordCount <= bridge.maxSnippetWords);

  return {
    id: String(caseSpec.id || '').trim(),
    description: String(caseSpec.description || '').trim(),
    userText: String(caseSpec.userText || '').trim(),
    expectedSelectedIds,
    expectedHeldBack,
    pass,
    bridge,
  };
}

function buildOpenLoopBridgeFixtureArtifact({
  generatedAt = new Date().toISOString(),
  cases = buildFixtureCases(),
} = {}) {
  const results = cases.map((caseSpec) => buildCaseResult(caseSpec, generatedAt));
  const renderedSnippetCount = results.reduce((total, item) => total + item.bridge.promptBridge.renderedCount, 0);
  const heldBackLoopCount = results.reduce((total, item) => total + item.bridge.heldBack.length, 0);
  const selectedVsHeldBackShown = results.some((item) => (
    item.bridge.selected.length > 0 && item.bridge.heldBack.length > 0
  ));
  const overclaimGuardrailPresent = results.every((item) => (
    item.bridge.selected.every((selected) => /Do not treat this as canonical memory or overclaim its status\./.test(selected.text))
  ));

  return {
    schema: OPEN_LOOP_PROMPT_BRIDGE_SCHEMA,
    artifactKind: 'open-loop-prompt-bridge-fixture',
    generatedAt,
    measurementMode: 'fixture-only',
    liveModelCalls: false,
    livePromptBridge: false,
    liveChatTouched: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    cases: results,
    summary: {
      caseCount: results.length,
      passingCaseCount: results.filter((item) => item.pass).length,
      renderedSnippetCount,
      heldBackLoopCount,
      selectedVsHeldBackShown,
      overclaimGuardrailPresent,
      maxRenderedLoops: 1,
      maxSnippetWords: 110,
    },
    limits: [
      'Fixture-only open-loop prompt bridge; no live chat injection.',
      'PromptTruth is not expanded and no new prompt-truth channel is added.',
      'Open loops remain advisory continuity, not canonical explicit memory.',
    ],
  };
}

function writeOpenLoopBridgeFixtureArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildOpenLoopBridgeFixtureArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function main(argv = process.argv.slice(2)) {
  const outputPath = parseArgValue('output', argv) || OUTPUT_PATH;
  const generatedAt = new Date().toISOString();
  const artifact = buildOpenLoopBridgeFixtureArtifact({ generatedAt });
  const result = writeOpenLoopBridgeFixtureArtifact({ outputPath, artifact });
  console.log(`Open-loop bridge fixture complete: ${result.outputPath}`);
  console.log(JSON.stringify(result.artifact.summary, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  buildCaseResult,
  buildFixtureCases,
  buildOpenLoopBridgeFixtureArtifact,
  main,
  parseArgValue,
  writeOpenLoopBridgeFixtureArtifact,
};
