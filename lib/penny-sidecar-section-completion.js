const REQUIRED_SECTIONS = Object.freeze([2, 3, 4, 5, 6, 7]);
const COMPLETE_STATUSES = Object.freeze(['LIVE_VERIFIED', 'HARNESS_VERIFIED']);
const FAILING_STATUSES = Object.freeze(['DOC_ONLY', 'REPRESENTED_ONLY', 'NOT_DONE']);
const PROOF_FIELDS = Object.freeze([
  'no_memory_write',
  'no_runtime_change',
  'no_default_model_change',
  'no_prompttruth_merge',
  'no_public_or_home_action',
]);
const REQUIRED_TEXT_FIELDS = Object.freeze([
  'chosen_primary_app',
  'candidate_apps',
  'availability_probe_command',
  'availability_result',
  'runnable_trial_command',
  'artifact_path',
  'artifact_schema',
  'test_command',
  'tests_added_or_updated',
  'live_app_found',
  'harness_ran',
  'recommended_next_live_command',
  'no_memory_write_proof',
  'no_runtime_change_proof',
  'no_default_model_change_proof',
  'no_prompttruth_merge_proof',
  'no_public_or_home_action_proof',
  'exact_files_changed',
  'exact_evidence',
]);

function isBlank(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeSection(section = {}) {
  const sectionId = Number(section.section_id);
  return {
    ...section,
    section_id: sectionId,
    section_title: section.section_title || section.title || '',
    chosen_primary_app: section.chosen_primary_app || section.primary_app || '',
    exact_files_changed: section.exact_files_changed || section.files_changed || [],
    exact_evidence: section.exact_evidence || section.evidence || [],
    proof: section.proof || {
      no_memory_write: section.no_memory_write === true,
      no_runtime_change: section.no_runtime_change === true,
      no_default_model_change: section.no_default_model_change === true,
      no_prompttruth_merge: section.no_prompttruth_merge === true,
      no_public_or_home_action: section.no_public_or_home_action === true,
    },
  };
}

function countStatus(summary, section) {
  if (section.status === 'LIVE_VERIFIED') summary.live_verified += 1;
  if (section.status === 'HARNESS_VERIFIED') summary.harness_verified += 1;
  if (section.status === 'INSTALL_BLOCKED' && section.harness_status === 'HARNESS_VERIFIED') {
    summary.install_blocked_with_harness += 1;
  }
  if (section.status === 'DOC_ONLY') summary.doc_only += 1;
  if (section.status === 'REPRESENTED_ONLY') summary.represented_only += 1;
  if (section.status === 'NOT_DONE') summary.not_done += 1;
}

function sectionIsComplete(section, failures) {
  let complete = COMPLETE_STATUSES.includes(section.status);
  if (section.status === 'INSTALL_BLOCKED') {
    complete = section.harness_status === 'HARNESS_VERIFIED';
    if (!complete) {
      failures.push(`section ${section.section_id} INSTALL_BLOCKED requires harness_status=HARNESS_VERIFIED`);
    }
  }
  if (FAILING_STATUSES.includes(section.status)) {
    complete = false;
    failures.push(`section ${section.section_id} has failing status ${section.status}`);
  }
  if (!complete && !FAILING_STATUSES.includes(section.status) && section.status !== 'INSTALL_BLOCKED') {
    failures.push(`section ${section.section_id} status must be LIVE_VERIFIED or HARNESS_VERIFIED`);
  }
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (isBlank(section[field])) {
      complete = false;
      failures.push(`section ${section.section_id} missing ${field}`);
    }
  }
  if (isBlank(section.section_title)) {
    complete = false;
    failures.push(`section ${section.section_id} missing section_title`);
  }
  for (const field of PROOF_FIELDS) {
    if (section.proof?.[field] !== true) {
      complete = false;
      failures.push(`section ${section.section_id} missing proof.${field}`);
    }
  }
  return complete;
}

function evaluateSectionCompletionMatrix(matrix = {}) {
  const requiredSections = Array.isArray(matrix.required_sections) && matrix.required_sections.length
    ? matrix.required_sections.map(Number)
    : [...REQUIRED_SECTIONS];
  const sections = (Array.isArray(matrix.sections) ? matrix.sections : []).map(normalizeSection);
  const byId = new Map(sections.map((section) => [section.section_id, section]));
  const failures = [];
  const summary = {
    live_verified: 0,
    harness_verified: 0,
    install_blocked_with_harness: 0,
    doc_only: 0,
    represented_only: 0,
    not_done: 0,
    failing: 0,
  };
  const evaluatedSections = [];

  for (const sectionId of requiredSections) {
    const section = byId.get(sectionId);
    if (!section) {
      failures.push(`section ${sectionId} missing from matrix`);
      summary.failing += 1;
      continue;
    }
    countStatus(summary, section);
    const sectionFailures = [];
    const complete = sectionIsComplete(section, sectionFailures);
    if (!complete) summary.failing += 1;
    failures.push(...sectionFailures);
    evaluatedSections.push({
      section_id: section.section_id,
      title: section.section_title,
      chosen_primary_app: section.chosen_primary_app,
      candidate_apps: section.candidate_apps,
      availability_probe_command: section.availability_probe_command,
      availability_result: section.availability_result,
      status: section.status,
      harness_status: section.harness_status || 'not_present',
      runnable_trial_command: section.runnable_trial_command,
      artifact_path: section.artifact_path,
      test_command: section.test_command,
      live_app_found: section.live_app_found,
      harness_ran: section.harness_ran,
      recommended_next_live_command: section.recommended_next_live_command,
      proof: section.proof,
      files_changed: section.exact_files_changed,
      evidence: section.exact_evidence,
      complete,
    });
  }

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    project: matrix.project || 'Penny Local LLM Sidecar Section Completion Gate',
    required_sections: requiredSections,
    all_required_sections_complete: summary.failing === 0 && failures.length === 0,
    summary,
    sections: evaluatedSections,
    failures,
  };
}

module.exports = {
  REQUIRED_SECTIONS,
  COMPLETE_STATUSES,
  evaluateSectionCompletionMatrix,
};
