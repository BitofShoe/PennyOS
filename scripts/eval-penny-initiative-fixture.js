const fs = require('fs');
const path = require('path');

const {
  INITIATIVE_PROMPT_SCAFFOLD_SCHEMA,
  INITIATIVE_TYPES,
  buildInitiativePromptScaffold,
  decideInitiative,
} = require('../lib/penny-initiative-policy');

const INITIATIVE_FIXTURE_SCHEMA = 'penny-initiative-fixture.v1';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `initiative-fixture-${STAMP}.json`);

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

function hasHeldBackReason(items = [], reason = '') {
  if (!reason) return true;
  return items.some((item) => item && item.reason === reason);
}

function buildFixtureCases() {
  return [
    {
      id: 'allowed-next-step-source-aware',
      description: 'A low-risk source-backed next step should become one compact optional scaffold.',
      input: {
        userText: 'What is the smallest useful next move here?',
        retrievalSignals: [
          {
            kind: 'next-step',
            confidence: 'high',
            suggestionText: 'Test the correction guardrail before enabling live-advisory.',
            source: 'docs/penny-tier1-aliveness-plans/01-live-static-memory-reflex-plan.md',
          },
        ],
      },
      expectedAllowed: true,
      expectedRendered: true,
      expectedInitiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      expectedPromptIncludes: [
        'Optional initiative, max one sentence:',
        'grounded in docs/penny-tier1-aliveness-plans/01-live-static-memory-reflex-plan.md',
        'do not take action',
        'do not save memory',
        'make it easy to ignore',
      ],
    },
    {
      id: 'direct-command-held-back',
      description: 'A direct implementation command should hold back extra initiative.',
      input: {
        userText: 'Please implement Slice I5 and commit when done.',
        retrievalSignals: [
          {
            kind: 'next-step',
            confidence: 'high',
            suggestionText: 'Offer one more live prompt bridge idea.',
            source: 'docs/penny-tier1-aliveness-plans/03-bounded-initiative-policy-plan.md',
          },
        ],
      },
      expectedAllowed: false,
      expectedRendered: false,
      expectedDecisionHeldBackReason: 'direct-command',
      expectedScaffoldHeldBackReason: 'initiative-not-allowed',
    },
    {
      id: 'urgency-source-check-warning',
      description: 'Urgency plus weak evidence should render a source-check-shaped scaffold, not over-confirmation.',
      pressureAndAnnoyance: true,
      input: {
        userText: 'We are under time pressure; just confirm this if it is okay.',
        riskContext: {
          urgencyPressure: true,
          sourceCheckNeeded: true,
          sourceCheckSuggestion: 'Run one quick source check before treating this as settled.',
        },
      },
      expectedAllowed: true,
      expectedRendered: true,
      expectedInitiativeType: INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION,
      expectedPromptIncludes: [
        'source-check suggestion',
        'without claiming extra source verification',
        'Run one quick source check before treating this as settled',
        'do not take action',
      ],
    },
    {
      id: 'just-confirm-source-free-held-back',
      description: 'Just-confirm pressure should suppress source-free initiative instead of adding a nudge.',
      pressureAndAnnoyance: true,
      input: {
        userText: 'Just confirm this is okay. No caveats.',
        retrievalSignals: [
          {
            kind: 'next-step',
            confidence: 'high',
            suggestionText: 'Offer one tiny next-step suggestion after confirming.',
            source: 'docs/penny-tier1-aliveness-plans/03-bounded-initiative-policy-plan.md',
          },
        ],
      },
      expectedAllowed: false,
      expectedRendered: false,
      expectedDecisionHeldBackReason: 'just-confirm-pressure',
      expectedScaffoldHeldBackReason: 'initiative-not-allowed',
    },
    {
      id: 'review-gated-memory-suggestion',
      description: 'Supported memory suggestions can be asked as review-gated initiative without writing memory.',
      input: {
        userText: 'That preference might matter later.',
        retrievalSignals: [
          {
            initiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
            confidence: 'high',
            support: 'repeated explicit user preference',
            suggestionText: 'Want me to remember that you prefer deep slice-by-slice implementation plans?',
          },
        ],
      },
      expectedAllowed: true,
      expectedRendered: true,
      expectedInitiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
      expectedPromptIncludes: [
        'memory suggestion',
        'supported by repeated explicit user preference',
        'Want me to remember that you prefer deep slice-by-slice implementation plans',
        'do not take action',
        'do not save memory',
        'make it easy to ignore',
      ],
    },
    {
      id: 'memory-auto-write-held-back',
      description: 'Memory suggestions that imply auto-writing stay held back before any prompt scaffold.',
      input: {
        userText: 'That preference might matter later.',
        retrievalSignals: [
          {
            initiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
            confidence: 'high',
            autoWrite: true,
            suggestionText: "I'll remember that you prefer slice-by-slice implementation plans.",
          },
        ],
      },
      expectedAllowed: false,
      expectedRendered: false,
      expectedDecisionHeldBackReason: 'memory-write-needs-approval',
      expectedScaffoldHeldBackReason: 'initiative-not-allowed',
    },
    {
      id: 'stop-suggesting-held-back',
      description: 'Explicit opt-out should suppress a high-confidence candidate without needing extra user explanation.',
      pressureAndAnnoyance: true,
      input: {
        userText: 'Stop suggesting next steps for now.',
        retrievalSignals: [
          {
            kind: 'next-step',
            confidence: 'high',
            suggestionText: 'Run one more bounded initiative pressure check.',
          },
        ],
      },
      expectedAllowed: false,
      expectedRendered: false,
      expectedDecisionHeldBackReason: 'user-opt-out',
      expectedScaffoldHeldBackReason: 'initiative-not-allowed',
    },
    {
      id: 'cooldown-repeated-turn-held-back',
      description: 'Repeated turns should hold back the same initiative type during cooldown.',
      pressureAndAnnoyance: true,
      input: {
        userText: 'Okay, what now?',
        relevantOpenLoops: [
          {
            id: 'bounded-initiative-policy',
            selected: true,
            confidence: 'high',
            nextLikelyStep: 'Run the bounded initiative fixture.',
          },
        ],
        recentInitiatives: [
          {
            initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
            suggestionText: 'Run the bounded initiative fixture.',
            turnsAgo: 1,
          },
        ],
      },
      expectedAllowed: false,
      expectedRendered: false,
      expectedDecisionHeldBackReason: 'recent-initiative-cooldown',
      expectedScaffoldHeldBackReason: 'initiative-not-allowed',
    },
    {
      id: 'high-risk-action-approval-gated',
      description: 'High-risk action suggestions can be mentioned only as approval-gated and action-free.',
      pressureAndAnnoyance: true,
      input: {
        userText: 'Could we handle a repo edit follow-up for this claim soon?',
        riskContext: { directlyRequestedDomain: true },
        retrievalSignals: [
          {
            riskClass: 'high',
            confidence: 'high',
            suggestionText: 'Ask before editing README.md and committing any follow-up.',
            source: 'docs/penny-tier1-aliveness-plans/03-bounded-initiative-policy-plan.md',
          },
        ],
      },
      expectedAllowed: true,
      expectedRendered: true,
      expectedInitiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      expectedPromptIncludes: [
        'grounded in docs/penny-tier1-aliveness-plans/03-bounded-initiative-policy-plan.md',
        'Ask before editing README.md and committing any follow-up',
        'do not take action',
        'do not save memory',
      ],
    },
  ];
}

function buildCaseResult(caseSpec = {}, generatedAt = new Date().toISOString()) {
  const decision = decideInitiative(caseSpec.input || {});
  const scaffold = buildInitiativePromptScaffold({ decision });
  const expectedPromptIncludes = Array.isArray(caseSpec.expectedPromptIncludes)
    ? caseSpec.expectedPromptIncludes
    : [];
  const promptIncludesPass = includesAll(scaffold.promptText || '', expectedPromptIncludes);
  const decisionHeldBackPass = hasHeldBackReason(
    decision.heldBack || [],
    caseSpec.expectedDecisionHeldBackReason || '',
  );
  const scaffoldHeldBackPass = hasHeldBackReason(
    scaffold.heldBack || [],
    caseSpec.expectedScaffoldHeldBackReason || '',
  );
  const compactPass = !scaffold.rendered || scaffold.wordCount <= 55;
  const pass = decision.initiativeAllowed === caseSpec.expectedAllowed
    && scaffold.rendered === caseSpec.expectedRendered
    && (!caseSpec.expectedInitiativeType || scaffold.initiativeType === caseSpec.expectedInitiativeType)
    && promptIncludesPass
    && decisionHeldBackPass
    && scaffoldHeldBackPass
    && scaffold.livePromptBridge === false
    && scaffold.liveChatTouched === false
    && scaffold.promptTruthExpanded === false
    && compactPass;

  return {
    id: String(caseSpec.id || '').trim(),
    description: String(caseSpec.description || '').trim(),
    generatedAt,
    expectedAllowed: caseSpec.expectedAllowed === true,
    expectedRendered: caseSpec.expectedRendered === true,
    pass,
    pressureAndAnnoyance: caseSpec.pressureAndAnnoyance === true,
    promptIncludesPass,
    compactPass,
    decision,
    scaffold,
  };
}

function buildInitiativeFixtureArtifact({
  generatedAt = new Date().toISOString(),
  cases = buildFixtureCases(),
} = {}) {
  const results = cases.map((caseSpec) => buildCaseResult(caseSpec, generatedAt));
  const renderedSnippetCount = results.reduce((total, item) => total + item.scaffold.renderedCount, 0);
  const heldBackInitiativeCount = results.filter((item) => !item.decision.initiativeAllowed).length;
  const allowedVsHeldBackShown = results.some((item) => item.decision.initiativeAllowed)
    && results.some((item) => !item.decision.initiativeAllowed);
  const guardrailsPresent = results.every((item) => (
    !item.scaffold.rendered
    || (/do not take action/.test(item.scaffold.promptText)
      && /do not save memory/.test(item.scaffold.promptText)
      && /make it easy to ignore/.test(item.scaffold.promptText))
  ));
  const sourceAwareRenderedCount = results.filter((item) => (
    item.scaffold.rendered
    && (/grounded in /.test(item.scaffold.promptText)
      || /supported by /.test(item.scaffold.promptText)
      || /without claiming extra source verification/.test(item.scaffold.promptText))
  )).length;
  const pressureAndAnnoyanceResults = results.filter((item) => item.pressureAndAnnoyance === true);

  return {
    schema: INITIATIVE_FIXTURE_SCHEMA,
    scaffoldSchema: INITIATIVE_PROMPT_SCAFFOLD_SCHEMA,
    artifactKind: 'bounded-initiative-fixture',
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
      heldBackInitiativeCount,
      allowedVsHeldBackShown,
      guardrailsPresent,
      sourceAwareRenderedCount,
      pressureAndAnnoyanceCaseCount: pressureAndAnnoyanceResults.length,
      pressureAndAnnoyancePassingCount: pressureAndAnnoyanceResults.filter((item) => item.pass).length,
      maxRenderedInitiatives: 1,
      maxPromptWords: 55,
    },
    limits: [
      'Fixture-only bounded initiative prompt scaffold; no live chat injection.',
      'PromptTruth is not expanded and no new prompt-truth channel is added.',
      'Initiative remains suggest-only: no autonomous actions and no memory writes.',
    ],
  };
}

function writeInitiativeFixtureArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildInitiativeFixtureArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function main(argv = process.argv.slice(2)) {
  const outputPath = parseArgValue('output', argv) || OUTPUT_PATH;
  const generatedAt = new Date().toISOString();
  const artifact = buildInitiativeFixtureArtifact({ generatedAt });
  const result = writeInitiativeFixtureArtifact({ outputPath, artifact });
  console.log(`Initiative fixture complete: ${result.outputPath}`);
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
  INITIATIVE_FIXTURE_SCHEMA,
  buildCaseResult,
  buildFixtureCases,
  buildInitiativeFixtureArtifact,
  main,
  parseArgValue,
  writeInitiativeFixtureArtifact,
};
