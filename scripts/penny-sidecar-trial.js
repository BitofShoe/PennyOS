const {
  buildLocalLlmAppRoadmap,
  findLocalLlmApp,
  allApps,
} = require('../lib/penny-local-llm-app-catalog');
const {
  buildSidecarTrialContract,
  buildAllSidecarTrialContracts,
  recommendedFirstTrial,
  renderContractMarkdown,
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
  return `penny:sidecars - sidecar trial contracts and scoring

Usage:
  npm run penny:sidecars -- --recommend-next
  npm run penny:sidecars -- --trial Pi --json
  npm run penny:sidecars -- --template OpenWebUI --markdown-out output/openwebui-sidecar-trial.md
  npm run penny:sidecars -- --score test/fixtures/penny-local-llm-sidecars/sidecar-trial-report.example.json

Defaults are read-only and stdout-only. Files are written only with --out or --markdown-out.
`;
}

function normalizeTemplateName(value = '') {
  const text = String(value || '').trim();
  if (/^openwebui$/i.test(text)) return 'Open WebUI';
  return text;
}

function selectPayload(args) {
  const roadmap = buildLocalLlmAppRoadmap({ piDetected: hasFlag(args, 'pi-present') });
  if (hasFlag(args, 'recommend-next')) return recommendedFirstTrial({ roadmap });
  const scorePath = argValue(args, 'score');
  if (scorePath) return scoreSidecarTrialReport(readJsonFile(scorePath));
  const trialName = argValue(args, 'trial') || normalizeTemplateName(argValue(args, 'template'));
  if (trialName) return buildSidecarTrialContract(trialName, { roadmap });
  const bucketId = argValue(args, 'bucket');
  if (bucketId) {
    return {
      schema_version: 1,
      bucket_id: bucketId,
      trials: allApps(roadmap)
        .filter((item) => item.bucket_id === bucketId)
        .map((item) => buildSidecarTrialContract(item, { roadmap })),
    };
  }
  return { schema_version: 1, trials: buildAllSidecarTrialContracts({ roadmap }) };
}

function markdownForPayload(payload) {
  if (payload.trial_id) return renderContractMarkdown(payload);
  if (payload.recommended_trial_id) {
    return `# Recommended Sidecar Trial\n\n- App: ${payload.app_id}\n- Reason: ${payload.reason}\n- Command: \`${payload.command}\`\n`;
  }
  if (payload.recommendation) {
    return `# Sidecar Trial Score\n\n- App: ${payload.app_id}\n- Status: ${payload.status}\n- Total score: ${payload.total_score}\n- Recommendation: ${payload.recommendation}\n`;
  }
  return `# Penny Sidecar Trials\n\n${(payload.trials || []).map((trial) => `- ${trial.app_id}: ${trial.trial_id}`).join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = selectPayload(args);
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
  helpText,
  selectPayload,
  main,
};
