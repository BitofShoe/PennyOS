const fs = require('fs');
const path = require('path');

const {
  TURN_STATE_PROMPT_BRIDGE_SCHEMA,
  extractTurnStateSignals,
  renderTurnStatePromptSnippet,
} = require('../lib/penny-turn-state');

const TURN_STATE_FIXTURE_SCHEMA = 'penny-turn-state-fixture.v1';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `turn-state-fixture-${STAMP}.json`);

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

function includesAll(text = '', expected = []) {
  return expected.every((item) => text.includes(item));
}

function includesNone(text = '', forbidden = []) {
  return forbidden.every((item) => !text.includes(item));
}

function buildFixtureCases() {
  return [
    {
      id: 'technical-roadmap-current-law',
      description: 'A detailed implementation request should render one compact response-shaping card.',
      input: {
        userText: 'Long detailed answers are heaven. Start Slice T4 for the ephemeral turn-state card fixture prompt bridge, run tests, and commit.',
        context: {
          activeProjectThread: 'ephemeral turn-state card',
          activeConstraints: [
            'current law: Do not change runtime voice or memory authority.',
            'current law: PromptTruth unchanged.',
          ],
        },
      },
      expectedIncludes: [
        'Turn state, ephemeral (persist=false)',
        'extensive technical roadmap',
        'Active project thread: ephemeral turn-state card',
        'implementation-focused technical roadmap',
        'PromptTruth unchanged',
        'tool/action claims need receipts',
        'Do not change runtime voice',
      ],
    },
    {
      id: 'source-backed-review',
      description: 'A high-stakes source request should render source-aware caution without making new authority.',
      input: {
        userText: 'Please verify the latest tax guidance with sources before giving advice.',
      },
      expectedIncludes: [
        'source backed review',
        'Keep source-sensitive claims source-aware',
        'Do not change runtime voice',
      ],
    },
    {
      id: 'private-inference-excluded',
      description: 'Rejected hidden/private fields must not appear in the rendered prompt snippet.',
      input: {
        userText: 'Please make a quick patch and keep it small.',
        turnState: {
          activeProjectThread: 'private inference about the user',
          suggestedResponseShape: 'hidden reasoning should not render',
          chainOfThought: 'secret notes',
          energy: {
            label: 'focused',
            hiddenReasoning: 'private tone explanation',
          },
        },
      },
      expectedIncludes: [
        'Turn state, ephemeral (persist=false)',
        'concise technical roadmap',
      ],
      forbiddenIncludes: [
        'private inference',
        'hidden reasoning',
        'secret notes',
        'private tone explanation',
      ],
    },
  ];
}

function buildCaseResult(caseSpec = {}, generatedAt = new Date().toISOString()) {
  const turnState = extractTurnStateSignals(caseSpec.input || {});
  const snippet = renderTurnStatePromptSnippet(turnState, {
    maxWords: caseSpec.maxWords ?? 80,
  });
  const expectedIncludes = Array.isArray(caseSpec.expectedIncludes) ? caseSpec.expectedIncludes : [];
  const forbiddenIncludes = Array.isArray(caseSpec.forbiddenIncludes) ? caseSpec.forbiddenIncludes : [];
  const includesPass = includesAll(snippet.promptText, expectedIncludes);
  const excludesPass = includesNone(snippet.promptText, forbiddenIncludes);
  const compactPass = snippet.wordCount <= snippet.maxWords;
  const pass = includesPass
    && excludesPass
    && compactPass
    && snippet.persist === false
    && snippet.turnStateMeasurementMode === 'ephemeral'
    && snippet.livePromptBridge === false
    && snippet.promptTruthExpanded === false
    && snippet.memoryWrites === false
    && snippet.autonomousActions === false
    && snippet.sensitiveInferenceExcluded === true;

  return {
    id: String(caseSpec.id || '').trim(),
    description: String(caseSpec.description || '').trim(),
    generatedAt,
    pass,
    includesPass,
    excludesPass,
    compactPass,
    turnStateSummary: snippet.turnStateSummary,
    snippet,
  };
}

function buildTurnStateFixtureArtifact({
  generatedAt = new Date().toISOString(),
  cases = buildFixtureCases(),
} = {}) {
  const results = cases.map((caseSpec) => buildCaseResult(caseSpec, generatedAt));
  const renderedSnippetCount = results.filter((item) => item.snippet.promptText).length;
  const compactSnippetCount = results.filter((item) => item.compactPass).length;
  const allEphemeral = results.every((item) => (
    item.snippet.persist === false && item.snippet.turnStateMeasurementMode === 'ephemeral'
  ));
  const sensitiveInferenceExcluded = results.every((item) => item.snippet.sensitiveInferenceExcluded === true);

  return {
    schema: TURN_STATE_FIXTURE_SCHEMA,
    promptBridgeSchema: TURN_STATE_PROMPT_BRIDGE_SCHEMA,
    artifactKind: 'turn-state-prompt-fixture',
    generatedAt,
    measurementMode: 'fixture-only',
    liveModelCalls: false,
    livePromptBridge: false,
    liveChatTouched: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    memoryWrites: false,
    autonomousActions: false,
    cases: results,
    summary: {
      caseCount: results.length,
      passingCaseCount: results.filter((item) => item.pass).length,
      renderedSnippetCount,
      compactSnippetCount,
      allEphemeral,
      sensitiveInferenceExcluded,
      maxPromptWords: 80,
    },
    limits: [
      'Fixture-only turn-state prompt scaffold; no live chat injection.',
      'Turn state is response-shaping context, not truth authority or memory.',
      'PromptTruth and toolEvidenceReceipt are unchanged.',
      'Hidden reasoning and sensitive/private inference are not rendered.',
    ],
  };
}

function writeTurnStateFixtureArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildTurnStateFixtureArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function main(argv = process.argv.slice(2)) {
  const outputPath = parseArgValue('output', argv) || OUTPUT_PATH;
  const generatedAt = new Date().toISOString();
  const artifact = buildTurnStateFixtureArtifact({ generatedAt });
  const result = writeTurnStateFixtureArtifact({ outputPath, artifact });
  console.log(`Turn-state fixture complete: ${result.outputPath}`);
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
  TURN_STATE_FIXTURE_SCHEMA,
  buildCaseResult,
  buildFixtureCases,
  buildTurnStateFixtureArtifact,
  main,
  parseArgValue,
  writeTurnStateFixtureArtifact,
};
