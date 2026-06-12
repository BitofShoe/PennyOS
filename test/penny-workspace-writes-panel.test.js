const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-workspace-writes-panel.mjs');

test('workspace writes panel renders pending edits with approve and deny controls', async () => {
  const { renderWorkspaceWritesPanel } = await helpersPromise;
  const panelEl = { className: '', innerHTML: '' };
  const viewModel = renderWorkspaceWritesPanel({
    panelEl,
    payload: {
      count: 1,
      directWritesEnabled: false,
      pending: [
        {
          id: 'write-1',
          path: 'src/app.js',
          action: 'updated',
          operation: 'replace_in_project_file',
          bytes: 42,
          lines: 2,
          expiresAt: Date.UTC(2026, 5, 11, 12, 30),
          summary: 'replace_in_project_file pending approval for src/app.js',
          patch: '--- a/src/app.js\n+++ b/src/app.js\n+<script>alert(1)</script>',
        },
      ],
    },
  });

  assert.equal(viewModel.count, 1);
  assert.equal(viewModel.pending[0].path, 'src/app.js');
  assert.equal(panelEl.className, 'list-block workspace-writes-surface');
  assert.match(panelEl.innerHTML, /Workspace edits/);
  assert.match(panelEl.innerHTML, /src\/app\.js/);
  assert.match(panelEl.innerHTML, /data-workspace-write-action="approve"/);
  assert.match(panelEl.innerHTML, /data-workspace-write-action="deny"/);
  assert.match(panelEl.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('workspace writes panel renders empty and error states honestly', async () => {
  const { renderWorkspaceWritesPanel } = await helpersPromise;
  const panelEl = { className: '', innerHTML: '' };

  renderWorkspaceWritesPanel({ panelEl, payload: { pending: [], count: 0 } });
  assert.match(panelEl.innerHTML, /No staged workspace edits/);

  renderWorkspaceWritesPanel({ panelEl, payload: { error: 'token_required' } });
  assert.match(panelEl.innerHTML, /could not load/i);
  assert.match(panelEl.innerHTML, /token_required/);
});
