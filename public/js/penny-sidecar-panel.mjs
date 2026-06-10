function cleanText(value = '', fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function labelFromStatus(status = '') {
  return cleanText(status, 'unknown').replace(/_/g, ' ');
}

function sourceLine(source = {}, index = 0) {
  const number = Number.isFinite(Number(source.index)) ? Number(source.index) + 1 : index + 1;
  const title = cleanText(source.title, `Source ${number}`);
  const target = source.sourceType === 'document-chunk' && source.chunkId
    ? `${cleanText(source.target)}#${cleanText(source.chunkId)}`
    : cleanText(source.target);
  return target ? `${number}. ${title} - ${target}` : `${number}. ${title}`;
}

function authorityLine(authority = {}, review = {}) {
  const facts = [
    review.requiresReview === true ? 'review only' : 'review state unknown',
    authority.memoryWrite === false ? 'memory off' : 'memory changed',
    authority.promptTruthChanged === false ? 'PromptTruth unchanged' : 'PromptTruth changed',
    authority.toolEvidenceReceiptChanged === false ? 'tool evidence unchanged' : 'tool evidence changed',
    authority.defaultContextChanged === false ? 'default context unchanged' : 'default context changed',
  ];
  if (Object.prototype.hasOwnProperty.call(authority, 'runtimeVoiceChanged')) {
    facts.push(authority.runtimeVoiceChanged === false ? 'runtime voice unchanged' : 'runtime voice changed');
  }
  return facts.join(' / ');
}

function audioFactsFromWorkflow(workflow = {}, transcriptReview = {}) {
  const capture = workflow.capture && typeof workflow.capture === 'object' ? workflow.capture : {};
  return [
    capture.microphoneAccess === true || workflow.microphoneAccess === true ? 'microphone changed' : 'microphone off',
    capture.recordingStarted === true || workflow.recordingStarted === true ? 'recording started' : 'recording off',
    capture.ambientCapture === true || workflow.ambientCapture === true ? 'ambient capture changed' : 'ambient capture off',
    capture.privateAudioUsed === true || workflow.privateAudioUsed === true ? 'private audio used' : 'private audio off',
    transcriptReview.tts_output_generated === true ? 'TTS output generated' : 'TTS output not generated',
  ];
}

export function buildSidecarWorkflowViewModel(workflow = {}) {
  const kind = cleanText(workflow.kind, 'sidecar');
  const primaryApp = cleanText(workflow.activation?.primaryApp || workflow.sidecar?.primaryApp, kind);
  const digest = workflow.digest && typeof workflow.digest === 'object' ? workflow.digest : {};
  const ragAnswer = workflow.ragAnswer && typeof workflow.ragAnswer === 'object' ? workflow.ragAnswer : {};
  const transcriptReview = workflow.transcriptReview && typeof workflow.transcriptReview === 'object' ? workflow.transcriptReview : {};
  const failure = workflow.failure && typeof workflow.failure === 'object' ? workflow.failure : null;
  const statusText = labelFromStatus(workflow.status || (workflow.ok === false ? 'blocked' : 'ready'));
  const sourceReceipts = Array.isArray(workflow.sourceReceipts)
    ? workflow.sourceReceipts
    : (Array.isArray(ragAnswer.document_citations)
      ? ragAnswer.document_citations.map((citation, index) => ({
        index,
        title: citation.title,
        target: citation.doc_id,
        sourceType: 'document-chunk',
        chunkId: citation.chunk_id,
        confidence: citation.confidence,
      }))
      : []);
  return {
    ok: workflow.ok !== false,
    kind,
    title: kind === 'search'
      ? `${primaryApp} search digest`
      : kind === 'docs'
        ? `${primaryApp} document answer`
        : kind === 'audio'
          ? `${primaryApp} audio review`
          : `${primaryApp} sidecar receipt`,
    statusText,
    mode: cleanText(workflow.activation?.mode, 'fixture'),
    summary: failure
      ? cleanText(failure.message, 'The sidecar workflow did not run.')
      : kind === 'docs'
        ? cleanText(ragAnswer.answer, 'No document answer returned.')
        : kind === 'audio'
          ? cleanText(transcriptReview.transcript, 'No transcript or TTS preview returned.')
          : cleanText(digest.summary, 'No sidecar summary returned.'),
    sources: sourceReceipts.map(sourceLine),
    unknowns: Array.isArray(digest.unknowns) ? digest.unknowns.map((item) => cleanText(item)).filter(Boolean) : [],
    documentSays: Array.isArray(ragAnswer.document_says) ? ragAnswer.document_says.map((item) => cleanText(item)).filter(Boolean) : [],
    modelInfers: Array.isArray(ragAnswer.model_infers) ? ragAnswer.model_infers.map((item) => cleanText(item)).filter(Boolean) : [],
    audioFacts: kind === 'audio' ? audioFactsFromWorkflow(workflow, transcriptReview) : [],
    authorityLine: authorityLine(workflow.authority || {}, workflow.review || {}),
  };
}

export function renderSidecarWorkflowResult({ container, workflow, escapeHtmlFn = null } = {}) {
  if (!container) return null;
  const escape = typeof escapeHtmlFn === 'function'
    ? escapeHtmlFn
    : (text) => String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  const viewModel = buildSidecarWorkflowViewModel(workflow);
  const sourceHtml = viewModel.sources.length
    ? `<ul>${viewModel.sources.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`
    : '<p class="sidecar-empty">No source receipts returned.</p>';
  const unknownHtml = viewModel.unknowns.length
    ? `<div class="sidecar-unknowns">${viewModel.unknowns.map((item) => `<span>${escape(item)}</span>`).join('')}</div>`
    : '';
  const documentHtml = viewModel.documentSays.length || viewModel.modelInfers.length
    ? `<div class="sidecar-document-split">
        ${viewModel.documentSays.length ? `<div><strong>Document says</strong>${viewModel.documentSays.map((item) => `<span>${escape(item)}</span>`).join('')}</div>` : ''}
        ${viewModel.modelInfers.length ? `<div><strong>Penny infers</strong>${viewModel.modelInfers.map((item) => `<span>${escape(item)}</span>`).join('')}</div>` : ''}
      </div>`
    : '';
  const audioHtml = viewModel.audioFacts.length
    ? `<div class="sidecar-audio-facts">${viewModel.audioFacts.map((item) => `<span>${escape(item)}</span>`).join('')}</div>`
    : '';
  container.hidden = false;
  container.dataset.status = viewModel.ok ? 'ready' : 'blocked';
  container.innerHTML = `
    <div class="sidecar-result-head">
      <strong>${escape(viewModel.title)}</strong>
      <span>${escape(viewModel.statusText)}</span>
    </div>
    <p>${escape(viewModel.summary)}</p>
    ${documentHtml}
    ${audioHtml}
    ${sourceHtml}
    ${unknownHtml}
    <small>${escape(viewModel.authorityLine)}</small>
  `;
  return viewModel;
}
