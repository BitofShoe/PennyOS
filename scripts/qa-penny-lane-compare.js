const fs = require('node:fs');
const path = require('node:path');

const { createDirectIntentApi } = require('../lib/penny-direct-intents');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const PENNY_LANE_COMPARE_SCHEMA = 'penny-lane-compare.v1';

const COMPARE_PROFILES = Object.freeze([
  {
    id: 'split-q6-e4b',
    env: {
      PENNY_QA_CHAT_MODEL: 'unsloth/gemma-4-31b-it@q6_k',
      PENNY_QA_TOOL_MODEL: 'google/gemma-4-e4b',
      PENNY_QA_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
    },
  },
  {
    id: 'single-qwen',
    env: {
      PENNY_QA_CHAT_MODEL: 'qwen/qwen3.6-35b-a3b',
      PENNY_QA_TOOL_MODEL: 'qwen/qwen3.6-35b-a3b',
      PENNY_QA_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
    },
  },
]);

const EXTERNAL_HARNESS_ROWS = Object.freeze([
  { row: 1, surface: 'Penny-style voice', owner: 'qa:voice:tiebreak' },
  { row: 2, surface: 'Memory semantic recall', owner: 'qa:memory:semantic' },
  { row: 3, surface: 'Memory drift / correction', owner: 'qa:memory:mixed' },
  { row: 4, surface: 'Image upload', owner: 'qa:browser:smoke image-only' },
]);

const RUNNER_SCENARIOS = Object.freeze([
  {
    row: 5,
    surface: 'File attachment',
    prompt: 'tell me what this file says',
    expectedLane: 'tool',
    expectedRoute: 'read_attached_file',
    keyAssertions: [
      'deterministic read',
      'no workspace tools',
      'no fake edits',
    ],
  },
  {
    row: 6,
    surface: 'Light agentic read',
    prompt: 'Open package.json and tell me the current npm test script. Then say whether you changed anything or only verified the repo state.',
    expectedLane: 'tool',
    expectedRoute: 'read_project_file_around_match',
    keyAssertions: [
      'deterministic repo read',
      'honest verified-only wording',
      'no phantom edits',
    ],
  },
  {
    row: 7,
    surface: 'Complex agentic write',
    prompt: "Inside Penny's Playground, create one new markdown file, choose the filename yourself, and write one short paragraph in your own Penny voice.",
    expectedLane: 'tool',
    expectedRoute: 'tool-loop',
    keyAssertions: [
      'file must really land in live-isolated mode',
      'artifact records path',
      'write evidence and fallback truth are recorded',
    ],
  },
  {
    row: 8,
    surface: 'Web search',
    prompt: 'hey penny, can you tell me what some of the top stories on digitalfoundry.com are, today?',
    expectedLane: 'tool',
    expectedRoute: 'search_web',
    keyAssertions: [
      'artifact records run date',
      'top results are source verified in live-isolated mode',
    ],
  },
  {
    row: 9,
    surface: 'Optional web follow-up',
    prompt: 'Open the Digital Foundry news page you found and tell me the first two story titles you can verify.',
    expectedLane: 'tool',
    expectedRoute: 'context-dependent-web-read',
    keyAssertions: [
      'converts prior search hit into bounded read',
      'does not stop at the search pile',
    ],
  },
]);

function buildDirectIntentApi() {
  return createDirectIntentApi({
    stripCodeFences(text = '') {
      return String(text || '')
        .replace(/^```[a-z0-9_-]*\r?\n?/i, '')
        .replace(/\r?\n?```$/i, '')
        .trim();
    },
    collapseWhitespace(text = '') {
      return String(text || '').replace(/\s+/g, ' ').trim();
    },
    extractFirstUrl(text = '') {
      const match = String(text || '').match(/https?:\/\/\S+/i);
      return match ? match[0].replace(/[),.;!?]+$/g, '') : '';
    },
    normalizeWebUrl(url = '') {
      const cleaned = String(url || '').trim().replace(/[),.;!?]+$/g, '');
      return /^https?:\/\//i.test(cleaned) ? cleaned : '';
    },
    truncateText(text = '', limit = 12000) {
      const value = String(text || '');
      if (value.length <= limit) return value;
      return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
    },
    stripReplyMoodTags(text = '') {
      return String(text || '').replace(/\s*\[MOOD:[^\]]+\]\s*$/i, '').trimEnd();
    },
    LOCAL_LLM_TRANSPORT: 'auto',
  });
}

function normalizeScenarioIntent(scenario = {}, directIntentApi = buildDirectIntentApi()) {
  if (scenario.row === 5) {
    const intent = directIntentApi.resolveAttachedFileIntent(scenario.prompt, {
      name: 'lane-compare-fixture.md',
      type: 'text/markdown',
    });
    return { ...scenario, directIntent: intent, toolLoopExpected: false };
  }
  if (scenario.row === 7) {
    return {
      ...scenario,
      directIntent: directIntentApi.resolveDirectToolIntent(scenario.prompt),
      toolLoopExpected: true,
    };
  }
  if (scenario.row === 9) {
    return {
      ...scenario,
      directIntent: null,
      toolLoopExpected: true,
      contextDependent: true,
    };
  }
  return {
    ...scenario,
    directIntent: directIntentApi.resolveDirectToolIntent(scenario.prompt),
    toolLoopExpected: false,
  };
}

function buildLaneCompareArtifact({
  generatedAt = new Date().toISOString(),
  mode = 'fixture',
  allowLiveIsolated = false,
} = {}) {
  const liveRequested = mode === 'live-isolated';
  const liveBlocked = liveRequested && allowLiveIsolated !== true;
  const directIntentApi = buildDirectIntentApi();
  return {
    schema: PENNY_LANE_COMPARE_SCHEMA,
    generatedAt,
    environment: liveRequested ? 'local-live-isolated' : 'fixture',
    measurementMode: liveRequested && !liveBlocked ? 'local-live-isolated' : 'fixture-only',
    profiles: COMPARE_PROFILES.map((profile) => profile.id),
    profileDetails: COMPARE_PROFILES,
    externalHarnessRows: EXTERNAL_HARNESS_ROWS.map((row) => ({
      ...row,
      implementedInFixtureRunner: false,
      externalHarnessRef: row.owner,
    })),
    scenarios: RUNNER_SCENARIOS.map((scenario) => normalizeScenarioIntent(scenario, directIntentApi)),
    cleanup: {
      disposableMemoryRemoved: true,
      playgroundFilesRemoved: true,
    },
    liveModelCalls: false,
    liveUserMemoryTouched: false,
    serverSpawned: false,
    lmStudioCalls: false,
    guardrails: {
      fixtureOnlyByDefault: true,
      liveIsolatedRequiresExplicitApproval: true,
      noParallelHeavyHarnesses: true,
      noModelLoadUnload: true,
    },
    verdict: liveBlocked ? 'blocked' : (liveRequested ? 'needs-manual-review' : 'fixture-only'),
    blockedReason: liveBlocked
      ? 'Pass --allow-live-isolated only after explicit operator approval and disposable server/memory setup.'
      : '',
  };
}

function parseLaneCompareArgs(args = []) {
  const parsed = {
    fixture: true,
    mode: 'fixture',
    allowLiveIsolated: false,
    outputPath: '',
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--fixture') {
      parsed.fixture = true;
      parsed.mode = 'fixture';
    } else if (arg === '--live-isolated') {
      parsed.fixture = false;
      parsed.mode = 'live-isolated';
    } else if (arg === '--allow-live-isolated') {
      parsed.allowLiveIsolated = true;
    } else if (arg === '--output') {
      parsed.outputPath = path.resolve(ROOT_DIR, args[index + 1] || '');
      index += 1;
    }
  }
  if (!parsed.outputPath) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    parsed.outputPath = path.join(OUTPUT_DIR, `lane-compare-${stamp}.json`);
  }
  return parsed;
}

function writeLaneCompareArtifact({ outputPath, artifact } = {}) {
  if (!outputPath) throw new Error('writeLaneCompareArtifact requires outputPath');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return { outputPath };
}

function main() {
  const options = parseLaneCompareArgs(process.argv.slice(2));
  const artifact = buildLaneCompareArtifact({
    mode: options.mode,
    allowLiveIsolated: options.allowLiveIsolated,
  });
  writeLaneCompareArtifact({ outputPath: options.outputPath, artifact });
  console.log(`Saved Penny lane compare artifact to ${options.outputPath}`);
  console.log(`Mode: ${artifact.measurementMode}; verdict: ${artifact.verdict}`);
  if (artifact.blockedReason) console.log(`Blocked: ${artifact.blockedReason}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  PENNY_LANE_COMPARE_SCHEMA,
  COMPARE_PROFILES,
  EXTERNAL_HARNESS_ROWS,
  RUNNER_SCENARIOS,
  buildLaneCompareArtifact,
  parseLaneCompareArgs,
  writeLaneCompareArtifact,
};
