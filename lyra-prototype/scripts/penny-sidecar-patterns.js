const {
  buildLocalLlmAppRoadmap,
} = require('../lib/penny-local-llm-app-catalog');
const {
  proposalsFromRoadmap,
  proposalsFromTrialReport,
  reviewPatternProposal,
  renderPatternsMarkdown,
} = require('../lib/penny-sidecar-patterns');
const {
  parseArgs,
  hasFlag,
  argValue,
  readJsonFile,
  writeFileIfRequested,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');

function helpText() {
  return `penny:patterns - inert sidecar pattern proposal queue

Usage:
  npm run penny:patterns -- --list
  npm run penny:patterns -- --from-trial path/to/trial-report.json
  npm run penny:patterns -- --review path/to/proposal.json --status promoted_to_docs --reason "operator reviewed"

Pattern proposals do not change memory, runtime, prompts, dependencies, or default models.
`;
}

function buildPayload(args) {
  if (argValue(args, 'from-trial')) {
    return { schema_version: 1, proposals: proposalsFromTrialReport(readJsonFile(argValue(args, 'from-trial'))) };
  }
  if (argValue(args, 'review')) {
    const proposal = readJsonFile(argValue(args, 'review'));
    return {
      schema_version: 1,
      proposal: reviewPatternProposal(proposal, {
        status: argValue(args, 'status', 'reviewed'),
        reviewer: argValue(args, 'reviewer', 'operator'),
        reason: argValue(args, 'reason', 'Reviewed by operator.'),
      }),
    };
  }
  return { schema_version: 1, proposals: proposalsFromRoadmap(buildLocalLlmAppRoadmap({ piDetected: hasFlag(args, 'pi-present') })) };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = buildPayload(args);
  const markdown = renderPatternsMarkdown(payload.proposals || [payload.proposal].filter(Boolean));
  writeFileIfRequested(argValue(args, 'out'), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileIfRequested(argValue(args, 'markdown-out'), markdown);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(markdown);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildPayload,
  main,
};
