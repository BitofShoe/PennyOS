const {
  buildLocalLlmAppRoadmap,
  allApps,
} = require('./penny-local-llm-app-catalog');

function bucketCapabilities(app = {}) {
  const bucket = app.bucket_id || '';
  const coding = bucket === 'coding_operator';
  const research = bucket === 'local_research_search';
  const rag = bucket === 'document_rag_workspace';
  const audio = bucket === 'audio_voice';
  const home = bucket === 'home_camera_event';
  const workflow = bucket === 'workflow_automation';
  const modelOps = bucket === 'model_server_ops';
  const lab = bucket === 'local_lab_cockpit';
  const evalCluster = bucket === 'eval_cluster';
  const operatorWrite = coding && ['pi', 'opencode', 'aider'].includes(String(app.app_id || '').toLowerCase());
  return {
    reads_local_files: operatorWrite || rag || lab ? 'explicit_fixture_or_disposable_scope_only' : false,
    writes_local_files: operatorWrite ? 'explicit_disposable_workspace_only' : false,
    reads_memory: false,
    writes_memory: false,
    uses_shell: operatorWrite ? 'explicit_disposable_workspace_only' : false,
    uses_browser: false,
    uses_camera: home ? 'read_only_explicit_trial_only' : false,
    uses_microphone: audio ? 'explicit_recording_only' : false,
    uses_home_state: home ? 'read_only_explicit_trial_only' : false,
    controls_home: false,
    uses_email: false,
    uses_public_network: research ? 'explicit_sidecar_trial_only' : false,
    public_action: false,
    model_calls: coding || lab || workflow || research || rag || audio || modelOps || evalCluster ? 'explicit_trial_only' : false,
    local_endpoint_required: coding || lab || modelOps || evalCluster,
    review_required: true,
    cleanup_required: true,
  };
}

function buildSidecarDescriptor(app = {}) {
  return {
    schema_version: 1,
    descriptor_id: `${app.app_id}-sidecar-descriptor`,
    app_id: app.display_name,
    app_key: app.app_id,
    bucket_id: app.bucket_id,
    penny_core_status: app.penny_core_status,
    descriptor_only: true,
    live_adapter_enabled: false,
    default_permission_posture: app.default_permission_posture,
    sidecar_boundary: app.sidecar_boundary,
    memory_policy: app.memory_policy,
    capability: bucketCapabilities(app),
    reads_local_files: bucketCapabilities(app).reads_local_files,
    writes_local_files: bucketCapabilities(app).writes_local_files,
    reads_memory: false,
    writes_memory: false,
    uses_shell: bucketCapabilities(app).uses_shell,
    uses_browser: false,
    uses_camera: bucketCapabilities(app).uses_camera,
    uses_microphone: bucketCapabilities(app).uses_microphone,
    uses_home_state: bucketCapabilities(app).uses_home_state,
    controls_home: false,
    uses_email: false,
    uses_public_network: bucketCapabilities(app).uses_public_network,
    public_action: false,
    model_calls: bucketCapabilities(app).model_calls,
    local_endpoint_required: bucketCapabilities(app).local_endpoint_required,
    review_required: true,
    cleanup_required: true,
    notes: 'Planning and visibility only; not a live adapter and not dependency approval.',
  };
}

function buildSidecarDescriptorRegistry(roadmap = buildLocalLlmAppRoadmap()) {
  return {
    schema_version: 1,
    generated_at: roadmap.generated_at || new Date().toISOString(),
    descriptor_only: true,
    live_adapter_enabled: false,
    registry_purpose: 'Sidecar planning and risk visibility only.',
    descriptors: allApps(roadmap).map(buildSidecarDescriptor),
  };
}

function renderDescriptorMarkdown(registry = buildSidecarDescriptorRegistry()) {
  const lines = [
    '# Penny Sidecar Descriptor Registry',
    '',
    'Descriptors are planning surfaces only. They do not enable live adapters, dependency installs, memory reads, memory writes, or public actions.',
    '',
  ];
  for (const descriptor of registry.descriptors || []) {
    lines.push(`- ${descriptor.app_id}: ${descriptor.bucket_id}; descriptor_only=${descriptor.descriptor_only}; live_adapter_enabled=${descriptor.live_adapter_enabled}; writes_memory=${descriptor.writes_memory}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

module.exports = {
  buildSidecarDescriptor,
  buildSidecarDescriptorRegistry,
  renderDescriptorMarkdown,
};
