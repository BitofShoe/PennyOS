const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const panelHelpersPromise = import('../public/js/penny-sidecar-panel.mjs');

test('search sidecar panel view model renders review-only source receipts', async () => {
  const { buildSidecarWorkflowViewModel } = await panelHelpersPromise;

  const viewModel = buildSidecarWorkflowViewModel({
    schema: 'penny-sidecar-workflow.v1',
    ok: true,
    status: 'fixture_ready',
    kind: 'search',
    activation: {
      mode: 'fixture',
      primaryApp: 'SearXNG',
    },
    digest: {
      query: 'local sidecar search',
      summary: 'Fixture digest summary.',
      unknowns: ['Live result relevance still needs review.'],
    },
    sourceReceipts: [{
      index: 0,
      title: 'Fixture source',
      target: 'https://example.test/fixture',
      sourceType: 'web',
      confidence: 'unknown',
    }],
    authority: {
      memoryWrite: false,
      promptTruthChanged: false,
      toolEvidenceReceiptChanged: false,
      defaultContextChanged: false,
    },
    review: {
      requiresReview: true,
      autoIngested: false,
    },
  });

  assert.equal(viewModel.kind, 'search');
  assert.equal(viewModel.statusText, 'fixture ready');
  assert.equal(viewModel.title, 'SearXNG search digest');
  assert.match(viewModel.summary, /Fixture digest/);
  assert.deepEqual(viewModel.sources, ['1. Fixture source - https://example.test/fixture']);
  assert.match(viewModel.authorityLine, /review only/i);
  assert.match(viewModel.authorityLine, /memory off/i);
  assert.match(viewModel.unknowns[0], /needs review/i);
});

test('settings HTML exposes search sidecar controls without memory promotion controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.match(html, /id="sidecarSearchQuery"/);
  assert.match(html, /id="sidecarSearchRun"/);
  assert.match(html, /id="sidecarSearchResult"/);
  assert.doesNotMatch(html, /id="sidecarSearchSaveMemory"/);
});

test('docs sidecar panel view model renders document citations separately from inference', async () => {
  const { buildSidecarWorkflowViewModel } = await panelHelpersPromise;

  const viewModel = buildSidecarWorkflowViewModel({
    schema: 'penny-sidecar-workflow.v1',
    ok: true,
    status: 'fixture_ready',
    kind: 'docs',
    activation: {
      mode: 'fixture',
      primaryApp: 'tiny local RAG sandbox',
    },
    ragAnswer: {
      question: 'What does the doc say?',
      answer: 'The fixture document says sidecar output is review-only.',
      document_citations: [{
        doc_id: 'penny-sidecar-memory-boundary',
        title: 'penny-sidecar-memory-boundary.md',
        chunk_id: 'chunk-1',
        quote_or_snippet: 'Sidecar outputs are review artifacts.',
      }],
      document_says: ['Sidecar outputs are review artifacts.'],
      model_infers: ['Do not promote them into memory without review.'],
    },
    authority: {
      memoryWrite: false,
      promptTruthChanged: false,
      toolEvidenceReceiptChanged: false,
      defaultContextChanged: false,
    },
    review: {
      requiresReview: true,
      autoIngested: false,
    },
  });

  assert.equal(viewModel.kind, 'docs');
  assert.equal(viewModel.title, 'tiny local RAG sandbox document answer');
  assert.match(viewModel.summary, /fixture document says/i);
  assert.deepEqual(viewModel.sources, ['1. penny-sidecar-memory-boundary.md - penny-sidecar-memory-boundary#chunk-1']);
  assert.deepEqual(viewModel.documentSays, ['Sidecar outputs are review artifacts.']);
  assert.deepEqual(viewModel.modelInfers, ['Do not promote them into memory without review.']);
  assert.match(viewModel.authorityLine, /memory off/i);
});

test('settings HTML exposes docs sidecar controls without memory promotion controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.match(html, /id="sidecarDocsQuestion"/);
  assert.match(html, /id="sidecarDocsRun"/);
  assert.match(html, /id="sidecarDocsResult"/);
  assert.doesNotMatch(html, /id="sidecarDocsSaveMemory"/);
});

test('audio sidecar panel view model renders capture and TTS review state', async () => {
  const { buildSidecarWorkflowViewModel } = await panelHelpersPromise;

  const viewModel = buildSidecarWorkflowViewModel({
    schema: 'penny-sidecar-workflow.v1',
    ok: true,
    status: 'fixture_ready',
    kind: 'audio',
    activation: {
      mode: 'fixture',
      primaryApp: 'Speaches fixture harness',
    },
    transcriptReview: {
      transcript: 'Penny sidecar audio fixture.',
      confidence: 'fixture',
      tts_output_generated: false,
      quality_notes: ['No microphone was used.'],
    },
    capture: {
      microphoneAccess: false,
      recordingStarted: false,
      ambientCapture: false,
      privateAudioUsed: false,
    },
    authority: {
      memoryWrite: false,
      promptTruthChanged: false,
      toolEvidenceReceiptChanged: false,
      defaultContextChanged: false,
      runtimeVoiceChanged: false,
    },
    review: {
      requiresReview: true,
      autoIngested: false,
    },
  });

  assert.equal(viewModel.kind, 'audio');
  assert.equal(viewModel.title, 'Speaches fixture harness audio review');
  assert.match(viewModel.summary, /Penny sidecar audio fixture/);
  assert.deepEqual(viewModel.audioFacts, [
    'microphone off',
    'recording off',
    'ambient capture off',
    'private audio off',
    'TTS output not generated',
  ]);
  assert.match(viewModel.authorityLine, /memory off/i);
  assert.match(viewModel.authorityLine, /runtime voice unchanged/i);
});

test('settings HTML exposes audio sidecar controls without memory promotion or ambient capture controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.match(html, /id="sidecarAudioText"/);
  assert.match(html, /id="sidecarAudioRun"/);
  assert.match(html, /id="sidecarAudioResult"/);
  assert.doesNotMatch(html, /id="sidecarAudioSaveMemory"/);
  assert.doesNotMatch(html, /id="sidecarAudioAmbientCapture"/);
});

test('productized workflow docs describe docs sidecar activation without memory promotion', () => {
  const markdown = fs.readFileSync(
    path.join(__dirname, '..', 'docs', 'sidecars', 'penny-sidecar-productized-workflows.md'),
    'utf8',
  );

  assert.match(markdown, /## Docs\/RAG: Qdrant and Fixture Docs/);
  assert.match(markdown, /`POST \/api\/penny\/sidecars\/docs`/);
  assert.match(markdown, /operator_permission_required/);
  assert.match(markdown, /Document answers can be read and reviewed, but there is no save-to-memory control/i);
});

test('productized workflow docs describe Speaches TTS activation without runtime voice swap', () => {
  const markdown = fs.readFileSync(
    path.join(__dirname, '..', 'docs', 'sidecars', 'penny-sidecar-productized-workflows.md'),
    'utf8',
  );

  assert.match(markdown, /## TTS\/Audio: Speaches/);
  assert.match(markdown, /`POST \/api\/penny\/sidecars\/audio`/);
  assert.match(markdown, /speaches_tts_trial_permission_required/);
  assert.match(markdown, /runtimeVoiceChanged` remains `false`/);
});
