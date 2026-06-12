import { escapeHtml } from './penny-expression-runtime.mjs';

function formatBytes(value = 0) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatMoment(value = 0) {
  const date = new Date(Number(value || 0));
  if (!Number.isFinite(date.getTime())) return 'unknown';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildWorkspaceWritesViewModel(payload = {}) {
  const pending = Array.isArray(payload?.pending) ? payload.pending : [];
  return {
    pending: pending.map((item) => ({
      id: String(item?.id || ''),
      path: String(item?.path || ''),
      action: String(item?.action || 'updated'),
      operation: String(item?.operation || 'workspace_write'),
      bytes: Math.max(0, Number(item?.bytes || 0)),
      lines: Math.max(0, Number(item?.lines || 0)),
      expiresAt: Number(item?.expiresAt || 0),
      patch: String(item?.patch || ''),
      summary: String(item?.summary || ''),
    })).filter((item) => item.id && item.path),
    count: Math.max(0, Number(payload?.count ?? pending.length)),
    directWritesEnabled: payload?.directWritesEnabled === true,
    error: String(payload?.error || ''),
  };
}

export function buildWorkspaceWritesBadgeState(payload = {}) {
  const count = Math.max(0, Math.floor(Number(payload?.count || 0)));
  if (!count) {
    return {
      count: 0,
      visible: false,
      label: '',
      title: '',
    };
  }
  const label = count > 99 ? '99+' : String(count);
  return {
    count,
    visible: true,
    label,
    title: `${count} workspace edit${count === 1 ? '' : 's'} awaiting approval`,
  };
}

function renderWorkspaceWriteItem(item, escapeHtmlFn = escapeHtml) {
  return `
    <div class="list-item memory-item workspace-write-item">
      <div class="memory-copy">
        <strong>${escapeHtmlFn(item.path)}</strong>
        <small>${escapeHtmlFn(item.action)} via ${escapeHtmlFn(item.operation)} &middot; ${escapeHtmlFn(formatBytes(item.bytes))} &middot; ${escapeHtmlFn(String(item.lines))} line${item.lines === 1 ? '' : 's'} &middot; expires ${escapeHtmlFn(formatMoment(item.expiresAt))}</small>
        ${item.summary ? `<small>${escapeHtmlFn(item.summary)}</small>` : ''}
        ${item.patch ? `<pre class="workspace-write-patch">${escapeHtmlFn(item.patch)}</pre>` : ''}
      </div>
      <div class="memory-toolbar-actions">
        <button class="secondary-btn tiny" type="button" data-workspace-write-action="approve" data-workspace-write-id="${escapeHtmlFn(item.id)}">Approve</button>
        <button class="secondary-btn tiny danger" type="button" data-workspace-write-action="deny" data-workspace-write-id="${escapeHtmlFn(item.id)}">Deny</button>
      </div>
    </div>
  `;
}

export function renderWorkspaceWritesPanel({ panelEl = null, payload = {}, escapeHtmlFn = escapeHtml } = {}) {
  const viewModel = buildWorkspaceWritesViewModel(payload);
  if (!panelEl) return viewModel;
  panelEl.className = 'list-block workspace-writes-surface';
  const note = viewModel.directWritesEnabled
    ? 'Direct workspace writes are enabled for this runtime.'
    : 'Penny stages file edits here first. Nothing touches disk until you approve it.';
  const body = viewModel.error
    ? `<div class="list-item"><div class="memory-copy">Workspace edits could not load.<small>${escapeHtmlFn(viewModel.error)}</small></div></div>`
    : (viewModel.pending.length
        ? viewModel.pending.map((item) => renderWorkspaceWriteItem(item, escapeHtmlFn)).join('')
        : '<div class="list-item"><div class="memory-copy">No staged workspace edits.</div></div>');
  panelEl.innerHTML = `
    <div class="memory-surface-section">
      <div class="section-label">Workspace edits</div>
      <div class="memory-toolbar-note">${escapeHtmlFn(note)}</div>
      ${body}
    </div>
  `;
  return viewModel;
}
