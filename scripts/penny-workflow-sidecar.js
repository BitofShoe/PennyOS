const {
  createWorkflowToyFlow,
  scoreSidecarTrialReport,
} = require('../lib/penny-sidecar-contracts');
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
  return `penny:workflow-sidecar - workflow sidecar dry-run templates

Usage:
  npm run penny:workflow-sidecar -- --template n8n
  npm run penny:workflow-sidecar -- --toy-flow --dry-run
  npm run penny:workflow-sidecar -- --score fixture.json

No email, public webhooks, posting, home/system actions, or cron autonomy are enabled.
`;
}

function buildPayload(args) {
  if (argValue(args, 'score')) return scoreSidecarTrialReport(readJsonFile(argValue(args, 'score')));
  const app = argValue(args, 'template', argValue(args, 'app', 'n8n'));
  return createWorkflowToyFlow({
    app_id: app,
    output_path: argValue(args, 'output-path'),
    dry_run: !hasFlag(args, 'execute'),
    model_endpoint: argValue(args, 'endpoint', 'http://127.0.0.1:1234/v1'),
  });
}

function markdownForPayload(payload) {
  return `# ${payload.app_id || payload.app_id} Workflow Sidecar\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = buildPayload(args);
  const markdown = markdownForPayload(payload);
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
