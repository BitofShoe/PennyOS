const {
  buildLocalLlmAppRoadmap,
  allApps,
} = require('./penny-local-llm-app-catalog');

const PATTERN_STATUSES = new Set([
  'proposed',
  'reviewed',
  'promoted_to_docs',
  'implemented',
  'rejected',
  'deferred',
]);

function cleanText(value = '', fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function slug(value = '') {
  return cleanText(value, 'pattern')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'pattern';
}

function cleanArray(values = []) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const text = cleanText(value);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}

function buildPatternProposal({
  schema_version = 1,
  pattern_id = '',
  created_at = new Date().toISOString(),
  source_app = '',
  source_bucket = '',
  pattern_name = '',
  problem = '',
  pattern_to_steal = '',
  penny_native_candidate = '',
  why_useful = '',
  risks = [],
  requires_code_change = false,
  requires_memory_change = false,
  requires_runtime_change = false,
  requires_dependency = false,
  status = 'proposed',
  reviewer = null,
  review_reason = null,
} = {}) {
  const name = cleanText(pattern_name, pattern_to_steal || 'Sidecar pattern');
  return {
    schema_version,
    pattern_id: cleanText(pattern_id, `${slug(source_app)}-${slug(name)}`),
    created_at,
    source_app: cleanText(source_app, 'unknown'),
    source_bucket: cleanText(source_bucket, 'unknown'),
    pattern_name: name,
    problem: cleanText(problem, 'Potential Penny improvement observed in sidecar class.'),
    pattern_to_steal: cleanText(pattern_to_steal, name),
    penny_native_candidate: cleanText(penny_native_candidate, 'Review before translating into Penny-native design.'),
    why_useful: cleanText(why_useful, 'May improve Penny if adapted without expanding authority.'),
    risks: cleanArray(risks),
    requires_code_change: requires_code_change === true,
    requires_memory_change: requires_memory_change === true,
    requires_runtime_change: requires_runtime_change === true,
    requires_dependency: requires_dependency === true,
    status: PATTERN_STATUSES.has(status) ? status : 'proposed',
    reviewer,
    review_reason,
    reviewed: Boolean(reviewer || review_reason || status !== 'proposed'),
    inert_until_reviewed: status === 'proposed',
    memory_write: false,
    runtime_changed: false,
  };
}

function pennyCandidateForPattern(pattern = '', app = {}) {
  const text = cleanText(pattern).toLowerCase();
  if (text.includes('model picker')) return 'Consider clearer local lane/profile picker UX without changing default models.';
  if (text.includes('reviewable action')) return 'Consider a Penny-native review queue for proposed actions, not automatic execution.';
  if (text.includes('citation')) return 'Consider stronger citation-first digest presentation for reviewed research artifacts.';
  if (text.includes('document')) return 'Consider provenance UI that separates document claims from model inference.';
  if (text.includes('transcript')) return 'Consider transcript review controls before any voice-derived memory promotion.';
  if (text.includes('identity receipt') || text.includes('endpoint')) return 'Consider compact model identity receipts in diagnostics.';
  if (text.includes('side-by-side') || app.bucket_id === 'eval_cluster') return 'Consider reusable side-by-side scoring for local model comparisons.';
  if (text.includes('ask-before')) return 'Consider stronger destructive-write confirmation labels in operator tooling.';
  return 'Review as a Penny-native improvement candidate before any code/runtime change.';
}

function proposalsFromRoadmap(roadmap = buildLocalLlmAppRoadmap()) {
  const proposals = [];
  for (const app of allApps(roadmap)) {
    for (const pattern of app.patterns_to_steal || []) {
      proposals.push(buildPatternProposal({
        created_at: roadmap.generated_at || new Date().toISOString(),
        source_app: app.display_name,
        source_bucket: app.bucket_id,
        pattern_name: pattern,
        pattern_to_steal: pattern,
        penny_native_candidate: pennyCandidateForPattern(pattern, app),
        risks: [
          'platformization drift',
          'authority creep',
          'dependency approval confusion',
        ],
      }));
    }
  }
  return proposals;
}

function proposalsFromTrialReport(report = {}) {
  const patterns = cleanArray(report.patterns_to_steal || report.patterns || []);
  return patterns.map((pattern) => buildPatternProposal({
    source_app: cleanText(report.app_id, 'unknown'),
    source_bucket: cleanText(report.bucket_id, 'unknown'),
    pattern_name: pattern,
    pattern_to_steal: pattern,
    penny_native_candidate: pennyCandidateForPattern(pattern, report),
    risks: cleanArray(report.risks || ['trial artifact needs review']),
  }));
}

function reviewPatternProposal(proposal = {}, { status = 'reviewed', reviewer = 'operator', reason = '' } = {}) {
  const nextStatus = PATTERN_STATUSES.has(status) ? status : 'reviewed';
  return buildPatternProposal({
    ...proposal,
    status: nextStatus,
    reviewer,
    review_reason: cleanText(reason, `Marked ${nextStatus}.`),
  });
}

function renderPatternsMarkdown(proposals = []) {
  const lines = [
    '# Penny Sidecar Pattern Queue',
    '',
    'Pattern proposals are inert until reviewed. Promotion to docs is not runtime law, and memory/runtime changes require a separate explicit change.',
    '',
  ];
  for (const proposal of proposals) {
    lines.push(
      `## ${proposal.pattern_name}`,
      '',
      `- Source: ${proposal.source_app} (${proposal.source_bucket})`,
      `- Status: ${proposal.status}`,
      `- Pattern: ${proposal.pattern_to_steal}`,
      `- Penny-native candidate: ${proposal.penny_native_candidate}`,
      `- Requires runtime change: ${proposal.requires_runtime_change}`,
      `- Requires memory change: ${proposal.requires_memory_change}`,
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  PATTERN_STATUSES,
  buildPatternProposal,
  proposalsFromRoadmap,
  proposalsFromTrialReport,
  reviewPatternProposal,
  renderPatternsMarkdown,
};
