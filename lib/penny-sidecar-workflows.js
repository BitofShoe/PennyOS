const {
  researchTrial,
  ragTrial,
  audioTrial,
} = require('./penny-sidecar-trials');

const WORKFLOW_SCHEMA = 'penny-sidecar-workflow.v1';

const SIDECAR_AUTHORITY_GUARDRAILS = Object.freeze({
  memoryWrite: false,
  promptTruthChanged: false,
  toolEvidenceReceiptChanged: false,
  defaultContextChanged: false,
  runtimeVoiceChanged: false,
  defaultModelChanged: false,
  lmStudioModelStateChanged: false,
});

function cleanText(value = '', fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function normalizeMode(value = '') {
  return String(value || '').trim().toLowerCase() === 'live' ? 'live' : 'fixture';
}

function sourceReceiptsFromDigest(digest = {}) {
  return (Array.isArray(digest.sources) ? digest.sources : [])
    .map((source, index) => {
      const title = cleanText(source?.title, `Source ${index + 1}`);
      const target = cleanText(source?.url);
      if (!target) return null;
      return {
        index,
        title,
        target,
        sourceType: cleanText(source?.source_type, 'web'),
        confidence: cleanText(source?.confidence, 'unknown'),
      };
    })
    .filter(Boolean);
}

function sourceReceiptsFromRagAnswer(ragAnswer = {}) {
  return (Array.isArray(ragAnswer.document_citations) ? ragAnswer.document_citations : [])
    .map((citation, index) => {
      const title = cleanText(citation?.title, `Document ${index + 1}`);
      const docId = cleanText(citation?.doc_id, title);
      if (!docId) return null;
      return {
        index,
        title,
        target: docId,
        sourceType: 'document-chunk',
        chunkId: cleanText(citation?.chunk_id),
        confidence: cleanText(citation?.confidence, 'unknown'),
      };
    })
    .filter(Boolean);
}

function blockedWorkflowReceipt({
  kind,
  route,
  requestedMode,
  reason,
  message,
} = {}) {
  return {
    schema: WORKFLOW_SCHEMA,
    ok: false,
    status: 'blocked',
    kind,
    activation: {
      route,
      mode: normalizeMode(requestedMode),
      liveProbeRequiresPermission: true,
    },
    live: {
      ran: false,
      permissionRequired: true,
    },
    review: {
      requiresReview: true,
      autoIngested: false,
    },
    authority: { ...SIDECAR_AUTHORITY_GUARDRAILS },
    sourceReceipts: [],
    failure: {
      reason,
      message,
    },
  };
}

function runSearchSidecarWorkflow({
  query = '',
  mode = 'fixture',
  allowLiveProbe = false,
  searxngBaseUrl = '',
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const route = '/api/penny/sidecars/search';
  const cleanQuery = cleanText(query, 'penny-local-sidecar');
  if (normalizedMode === 'live' && allowLiveProbe !== true) {
    return blockedWorkflowReceipt({
      kind: 'search',
      route,
      requestedMode: normalizedMode,
      reason: 'operator_permission_required',
      message: 'Live SearXNG probing is optional and requires explicit operator permission.',
    });
  }

  const liveProbe = normalizedMode === 'live';
  const trial = researchTrial({
    liveProbe,
    searxngBaseUrl,
  });
  const digest = {
    ...(trial.digest || {}),
    query: cleanQuery,
  };
  const sourceReceipts = sourceReceiptsFromDigest(digest);
  return {
    schema: WORKFLOW_SCHEMA,
    ok: true,
    status: trial.status === 'LIVE_VERIFIED' ? 'live_verified' : 'fixture_ready',
    kind: 'search',
    title: 'Local research/search sidecar',
    generatedAt: trial.generated_at,
    activation: {
      route,
      mode: normalizedMode,
      primaryApp: trial.primary_app || 'SearXNG',
      liveProbeRequiresPermission: true,
      fixtureBacked: true,
    },
    live: {
      ran: liveProbe,
      permissionRequired: normalizedMode === 'live',
      found: trial.live_probe?.found === true,
    },
    sidecar: {
      sectionId: trial.section_id,
      sectionTitle: trial.section_title,
      primaryApp: trial.primary_app,
      candidateApps: Array.isArray(trial.candidate_apps) ? trial.candidate_apps : [],
      artifactSchema: trial.artifact_schema,
      trialStatus: trial.status,
    },
    digest,
    sourceReceipts,
    review: {
      requiresReview: true,
      autoIngested: false,
      saveToMemoryAvailable: false,
      note: 'Search sidecar output is a review artifact, not Penny memory.',
    },
    authority: { ...SIDECAR_AUTHORITY_GUARDRAILS },
    failure: null,
    recommendedNextLiveCommand: trial.recommended_next_live_command || '',
  };
}

function runDocsSidecarWorkflow({
  question = '',
  mode = 'fixture',
  allowLiveProbe = false,
  qdrantBaseUrl = '',
  qdrantWriteTrial = false,
  allowQdrantWriteTrial = false,
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const route = '/api/penny/sidecars/docs';
  const cleanQuestion = cleanText(question, 'What do the fixture docs say about sidecar memory boundaries?');
  if (normalizedMode === 'live' && allowLiveProbe !== true) {
    return blockedWorkflowReceipt({
      kind: 'docs',
      route,
      requestedMode: normalizedMode,
      reason: 'operator_permission_required',
      message: 'Live Qdrant/document sidecar probing is optional and requires explicit operator permission.',
    });
  }
  if (qdrantWriteTrial === true && allowQdrantWriteTrial !== true) {
    return blockedWorkflowReceipt({
      kind: 'docs',
      route,
      requestedMode: normalizedMode,
      reason: 'qdrant_write_trial_permission_required',
      message: 'The Qdrant write trial creates and deletes a temporary fixture collection, so it needs explicit permission.',
    });
  }

  const liveProbe = normalizedMode === 'live';
  const trial = ragTrial({
    liveProbe,
    qdrantWriteTrial: qdrantWriteTrial === true && allowQdrantWriteTrial === true,
    qdrantBaseUrl,
  });
  const ragAnswer = {
    ...(trial.rag_answer || {}),
    question: cleanQuestion,
  };
  const sourceReceipts = sourceReceiptsFromRagAnswer(ragAnswer);
  return {
    schema: WORKFLOW_SCHEMA,
    ok: true,
    status: trial.status === 'LIVE_VERIFIED' ? 'live_verified' : 'fixture_ready',
    kind: 'docs',
    title: 'Local document/RAG sidecar',
    generatedAt: trial.generated_at,
    activation: {
      route,
      mode: normalizedMode,
      primaryApp: trial.primary_app || 'tiny local RAG sandbox',
      liveProbeRequiresPermission: true,
      qdrantWriteTrialRequiresPermission: true,
      fixtureBacked: true,
    },
    live: {
      ran: liveProbe,
      permissionRequired: normalizedMode === 'live',
      found: trial.live_probe?.qdrant?.found === true || trial.live_probe?.paperless?.found === true,
      qdrantWriteTrialRan: trial.live_probe?.qdrant_live_write_trial?.ran === true,
    },
    sidecar: {
      sectionId: trial.section_id,
      sectionTitle: trial.section_title,
      primaryApp: trial.primary_app,
      candidateApps: Array.isArray(trial.candidate_apps) ? trial.candidate_apps : [],
      artifactSchema: trial.artifact_schema,
      trialStatus: trial.status,
    },
    ragAnswer,
    sourceReceipts,
    review: {
      requiresReview: true,
      autoIngested: false,
      saveToMemoryAvailable: false,
      note: 'Document sidecar output is a review artifact, not Penny memory.',
    },
    authority: { ...SIDECAR_AUTHORITY_GUARDRAILS },
    privateDocsUsed: trial.private_docs_used === true,
    pennyMemoryImported: trial.penny_memory_imported === true,
    failure: null,
    recommendedNextLiveCommand: trial.recommended_next_live_command || '',
  };
}

function runAudioSidecarWorkflow({
  text = '',
  mode = 'fixture',
  allowLiveProbe = false,
  speachesBaseUrl = '',
  speachesTtsTrial = false,
  allowSpeachesTtsTrial = false,
  trialRunner = audioTrial,
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const route = '/api/penny/sidecars/audio';
  const cleanTranscript = cleanText(text, 'Penny sidecar audio fixture. No microphone was used.');
  if (normalizedMode === 'live' && allowLiveProbe !== true) {
    return blockedWorkflowReceipt({
      kind: 'audio',
      route,
      requestedMode: normalizedMode,
      reason: 'operator_permission_required',
      message: 'Live Speaches/audio sidecar probing is optional and requires explicit operator permission.',
    });
  }
  if (speachesTtsTrial === true && allowSpeachesTtsTrial !== true) {
    return blockedWorkflowReceipt({
      kind: 'audio',
      route,
      requestedMode: normalizedMode,
      reason: 'speaches_tts_trial_permission_required',
      message: 'The Speaches TTS trial can request a model and generate audio, so it needs separate permission.',
    });
  }

  const liveProbe = normalizedMode === 'live';
  const trial = trialRunner({
    liveProbe,
    speachesTtsTrial: speachesTtsTrial === true && allowSpeachesTtsTrial === true,
    speachesBaseUrl,
    ttsInput: cleanTranscript,
  });
  const transcriptReview = {
    ...(trial.transcript_review || {}),
    transcript: cleanTranscript,
  };
  return {
    schema: WORKFLOW_SCHEMA,
    ok: true,
    status: trial.status === 'LIVE_VERIFIED' ? 'live_verified' : 'fixture_ready',
    kind: 'audio',
    title: 'Local TTS/audio sidecar',
    generatedAt: trial.generated_at,
    activation: {
      route,
      mode: normalizedMode,
      primaryApp: trial.primary_app || 'Speaches fixture harness',
      liveProbeRequiresPermission: true,
      speachesTtsTrialRequiresPermission: true,
      fixtureBacked: true,
    },
    live: {
      ran: liveProbe,
      permissionRequired: normalizedMode === 'live',
      found: trial.live_probe?.speaches?.found === true
        || trial.live_probe?.openedai_speech?.found === true
        || trial.live_probe?.faster_whisper?.found === true
        || trial.live_probe?.parler?.found === true,
      speachesTtsTrialRan: trial.live_probe?.speaches_tts_live_trial?.ran === true,
    },
    sidecar: {
      sectionId: trial.section_id,
      sectionTitle: trial.section_title,
      primaryApp: trial.primary_app,
      candidateApps: Array.isArray(trial.candidate_apps) ? trial.candidate_apps : [],
      artifactSchema: trial.artifact_schema,
      trialStatus: trial.status,
    },
    transcriptReview,
    capture: {
      microphoneAccess: trial.microphone_access === true,
      recordingStarted: trial.recording_started === true,
      ambientCapture: trial.ambient_capture === true,
      privateAudioUsed: trial.private_audio_used === true,
    },
    microphoneAccess: trial.microphone_access === true,
    recordingStarted: trial.recording_started === true,
    ambientCapture: trial.ambient_capture === true,
    privateAudioUsed: trial.private_audio_used === true,
    pennyMemoryImported: trial.penny_memory_imported === true,
    review: {
      requiresReview: true,
      autoIngested: false,
      saveToMemoryAvailable: false,
      note: 'Audio sidecar output is a review artifact, not Penny memory or runtime voice.',
    },
    authority: { ...SIDECAR_AUTHORITY_GUARDRAILS },
    failure: null,
    recommendedNextLiveCommand: trial.recommended_next_live_command || '',
  };
}

function runSidecarWorkflow(kind, payload = {}) {
  const normalizedKind = String(kind || '').trim().toLowerCase();
  if (normalizedKind === 'search' || normalizedKind === 'research') {
    return runSearchSidecarWorkflow(payload);
  }
  if (normalizedKind === 'docs' || normalizedKind === 'rag') {
    return runDocsSidecarWorkflow(payload);
  }
  if (normalizedKind === 'audio' || normalizedKind === 'tts') {
    return runAudioSidecarWorkflow(payload);
  }
  return blockedWorkflowReceipt({
    kind: normalizedKind || 'unknown',
    route: '/api/penny/sidecars',
    requestedMode: payload.mode,
    reason: 'unsupported_sidecar_workflow',
    message: `Unsupported sidecar workflow: ${kind || 'unknown'}.`,
  });
}

function createSidecarWorkflowApi() {
  return {
    runSidecarWorkflow,
    runSearchSidecarWorkflow,
    runDocsSidecarWorkflow,
    runAudioSidecarWorkflow,
  };
}

module.exports = {
  WORKFLOW_SCHEMA,
  SIDECAR_AUTHORITY_GUARDRAILS,
  createSidecarWorkflowApi,
  runAudioSidecarWorkflow,
  runDocsSidecarWorkflow,
  runSidecarWorkflow,
  runSearchSidecarWorkflow,
  sourceReceiptsFromDigest,
  sourceReceiptsFromRagAnswer,
};
