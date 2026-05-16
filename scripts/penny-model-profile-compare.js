const {
  buildModelProfileCompareArtifact,
  DEFAULT_GEMMA_MODEL_ID,
  DEFAULT_LIVE_COMPARE_ENDPOINT,
  DEFAULT_QWEN_MODEL_ID,
  renderModelCompareMarkdown,
  runLiveModelProfileCompare,
} = require('../lib/penny-model-profile-compare');
const {
  parseArgs,
  hasFlag,
  argValue,
  writeFileIfRequested,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');

function helpText() {
  return `penny:model-compare - Qwen-vs-Gemma Penny profile compare

Usage:
  npm run penny:model-compare -- --profiles qwen-local,gemma-local --dry-run
  npm run penny:model-compare -- --profiles qwen-local,gemma-local --artifact-out output/qwen-vs-gemma-compare-template.md
  npm run penny:model-compare -- --live --endpoint http://127.0.0.1:18080/v1 --qwen-model unsloth/qwen3.6-35b-a3b@ud-q4_k_xl --gemma-model unsloth/gemma-4-31b-it --json

Dry-run mode makes no model calls. Live mode sends tiny non-private chat probes only.
Neither mode changes defaults, Penny memory, runtime voice, PromptTruth, toolEvidenceReceipt, or context limits.
`;
}

function builtinProfile(profileId, options = {}) {
  const endpoint = options.endpoint || process.env.PENNY_LOCAL_LLM_ENDPOINT || 'http://127.0.0.1:1234/v1';
  if (profileId === 'qwen-local') {
    return {
      profile_id: 'qwen-local',
      display_name: 'Qwen local coding/tool candidate',
      model_id: options.qwenModel || '<resolved-qwen-model-id>',
      backend_family: 'llama_cpp_or_lm_studio',
      endpoint,
      quant: 'requires_check',
      context_length: null,
      chat_template: 'requires_check',
      thinking: 'explicit_only',
      developer_role: 'requires_check',
      reasoning_effort: 'requires_check',
      tool_call_reliability: 'requires_live_check',
      memory_readiness: 'requires_live_check',
      route_lane_selected: 'tool_candidate',
      cleanup_actions: ['clean disposable Penny state', 'do not unload/reload user-owned models without opt-in'],
    };
  }
  return {
    profile_id: 'gemma-local',
    display_name: 'Gemma local companion candidate',
    model_id: options.gemmaModel || '<resolved-gemma-model-id>',
    backend_family: 'lm_studio_or_llama_cpp',
    endpoint,
    quant: 'requires_check',
    context_length: null,
    chat_template: 'requires_check',
    thinking: 'off',
    developer_role: 'requires_check',
    reasoning_effort: 'requires_check',
    tool_call_reliability: 'requires_live_check',
    memory_readiness: 'requires_live_check',
    route_lane_selected: 'chat_candidate',
    cleanup_actions: ['clean disposable Penny state', 'do not change Penny default model'],
  };
}

async function buildPayload(args) {
  const endpoint = argValue(args, 'endpoint') || process.env.PENNY_LOCAL_LLM_ENDPOINT || DEFAULT_LIVE_COMPARE_ENDPOINT;
  const qwenModel = argValue(args, 'qwen-model') || DEFAULT_QWEN_MODEL_ID;
  const gemmaModel = argValue(args, 'gemma-model') || DEFAULT_GEMMA_MODEL_ID;
  if (hasFlag(args, 'live')) {
    return runLiveModelProfileCompare({
      endpoint,
      qwenModel,
      gemmaModel,
      timeoutMs: Number(argValue(args, 'timeout-ms', '120000')),
    });
  }
  const profilesArg = argValue(args, 'profiles', 'qwen-local,gemma-local');
  const profileIds = profilesArg.split(',').map((item) => item.trim()).filter(Boolean);
  const artifact = buildModelProfileCompareArtifact({
    profiles: profileIds.map((profileId) => builtinProfile(profileId, { endpoint, qwenModel, gemmaModel })),
    mode: 'dry-run',
    liveModelCalls: false,
  });
  return artifact;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = await buildPayload(args);
  const markdown = renderModelCompareMarkdown(payload);
  writeFileIfRequested(argValue(args, 'out'), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileIfRequested(argValue(args, 'artifact-out') || argValue(args, 'markdown-out'), markdown);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(markdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  builtinProfile,
  buildPayload,
  main,
};
