const {
  buildLocalLlmAppRoadmap,
  allApps,
  findLocalLlmApp,
  shortlistApps,
  patternCards,
  renderRoadmapMarkdown,
} = require('../lib/penny-local-llm-app-catalog');
const {
  buildSidecarTrialContract,
  renderContractMarkdown,
} = require('../lib/penny-sidecar-contracts');
const {
  parseArgs,
  hasFlag,
  argValue,
  writeFileIfRequested,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');

function helpText() {
  return `penny:apps - Penny local LLM sidecar roadmap

Usage:
  npm run penny:apps -- --list
  npm run penny:apps -- --shortlist
  npm run penny:apps -- --bucket coding_operator --json
  npm run penny:apps -- --app Pi --contract
  npm run penny:apps -- --needs-license-review --json
  npm run penny:apps -- --patterns --markdown-out output/penny-local-llm-app-patterns.md

Defaults are read-only and stdout-only. Files are written only with --out or --markdown-out.
`;
}

function selectPayload(args) {
  const roadmap = buildLocalLlmAppRoadmap({ piDetected: hasFlag(args, 'pi-present') });
  if (hasFlag(args, 'shortlist')) {
    return { schema_version: 1, generated_at: roadmap.generated_at, project: roadmap.project, apps: shortlistApps(roadmap) };
  }
  if (hasFlag(args, 'patterns')) {
    return { schema_version: 1, generated_at: roadmap.generated_at, project: roadmap.project, patterns: patternCards(roadmap) };
  }
  if (hasFlag(args, 'needs-license-review')) {
    return {
      schema_version: 1,
      generated_at: roadmap.generated_at,
      project: roadmap.project,
      install_or_core_approval_implied: false,
      apps: allApps(roadmap).filter((item) => item.license_check_required || item.dependency_approval_required).map((item) => ({
        app_id: item.app_id,
        display_name: item.display_name,
        bucket_id: item.bucket_id,
        priority: item.priority,
        linked_project_license: item.linked_project_license,
        linked_project_license_checked: item.linked_project_license_checked,
        dependency_approval_required: item.dependency_approval_required,
        approved_for_install: item.approved_for_install,
        approved_for_core: item.approved_for_core,
        access_model: item.access_model,
      })),
    };
  }
  const appName = argValue(args, 'app');
  if (appName) {
    const app = findLocalLlmApp(roadmap, appName);
    if (!app) throw new Error(`Unknown app: ${appName}`);
    if (hasFlag(args, 'contract')) return buildSidecarTrialContract(app, { roadmap });
    return { schema_version: 1, generated_at: roadmap.generated_at, app };
  }
  const bucketId = argValue(args, 'bucket');
  if (bucketId) {
    const bucket = roadmap.buckets.find((item) => item.bucket_id === bucketId);
    if (!bucket) throw new Error(`Unknown bucket: ${bucketId}`);
    return { schema_version: 1, generated_at: roadmap.generated_at, bucket };
  }
  return roadmap;
}

function markdownForPayload(payload) {
  if (payload.trial_id) return renderContractMarkdown(payload);
  if (payload.patterns) {
    return [
      '# Penny Local LLM App Patterns',
      '',
      ...payload.patterns.map((item) => `- ${item.display_name}: ${item.pattern_to_steal}`),
      '',
    ].join('\n');
  }
  if (payload.buckets) return renderRoadmapMarkdown(payload);
  return `# Penny Local LLM Apps\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`;
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
