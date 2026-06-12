const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createProjectToolsApi } = require('../lib/penny-project-tools');

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function truncateText(value = '', limit = 8000) {
  const text = String(value || '');
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function formatBytes(value = 0) {
  return `${Number(value || 0)}b`;
}

function buildApi({
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-project-tools-')),
  pathAliases = {},
  directWorkspaceWritesEnabled = false,
  textExtensions = null,
  pendingWriteTtlMs,
  now,
} = {}) {
  const api = createProjectToolsApi({
    projectRoot,
    pathAliases,
    fs,
    path,
    TEXT_FILE_EXTENSIONS: textExtensions || new Set(['.js', '.json', '.md', '.txt', '.mjs', '.cjs']),
    clampNumber,
    truncateText,
    formatBytes,
    MAX_TOOL_WRITE_BYTES: 128,
    TOOL_FILE_LIST_MAX_ITEMS: 64,
    TOOL_FILE_READ_MAX_LINES: 120,
    TOOL_SEARCH_MAX_HITS: 16,
    TOOL_COMMAND_TIMEOUT_MS: 1000,
    execFileText: async () => ({ stdout: '', stderr: '' }),
    directWorkspaceWritesEnabled,
    pendingWriteTtlMs,
    now,
  });
  return {
    api,
    projectRoot,
    cleanup() {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    },
  };
}

test('listProjectFilesTool ignores generated folders and respects maxDepth', () => {
  const { api, projectRoot, cleanup } = buildApi();
  try {
    fs.mkdirSync(path.join(projectRoot, '.git', 'objects'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'node_modules', 'left-pad'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'output', 'reports'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'src', 'nested', 'deeper'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src', 'nested', 'deeper', 'deep.js'), 'export const deep = true;\n');
    fs.writeFileSync(path.join(projectRoot, 'src', 'app.js'), 'export const app = true;\n');

    const listed = api.listProjectFilesTool({ path: '.', recursive: true, maxDepth: 1, limit: 32 });
    assert.equal(listed.items.some((item) => item.includes('.git')), false);
    assert.equal(listed.items.some((item) => item.includes('node_modules')), false);
    assert.equal(listed.items.some((item) => item.includes('output')), false);
    assert.equal(listed.items.some((item) => item.includes('src/app.js')), true);
    assert.equal(listed.items.some((item) => item.includes('src/nested/deeper/deep.js')), false);
  } finally {
    cleanup();
  }
});

test('searchProjectTextTool skips ignored folders and oversized files', () => {
  const { api, projectRoot, cleanup } = buildApi();
  try {
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'output'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src', 'app.js'), 'const sentinel = "research-ledger";\n');
    fs.writeFileSync(path.join(projectRoot, 'output', 'generated.js'), 'const sentinel = "research-ledger";\n');
    fs.writeFileSync(path.join(projectRoot, 'src', 'huge.txt'), 'research-ledger\n'.repeat(25000));

    const searched = api.searchProjectTextTool({ query: 'research-ledger', path: '.', limit: 16 });
    assert.deepEqual(searched.hits.map((item) => item.path), ['src/app.js']);
  } finally {
    cleanup();
  }
});

test('project tool guards reject root escapes and oversized writes', () => {
  const { api, projectRoot, cleanup } = buildApi();
  try {
    const outsideFile = path.join(path.dirname(projectRoot), 'outside.txt');
    fs.writeFileSync(outsideFile, 'nope\n');
    assert.throws(() => api.readProjectFileTool({ path: path.join('..', 'outside.txt') }), /inside the Penny project/i);
    assert.throws(() => api.readProjectFileTool({ path: '..\\outside.txt' }), /inside the Penny project/i);
    assert.throws(() => api.readProjectFileTool({ path: 'src\\..\\..\\outside.txt' }), /inside the Penny project/i);
    assert.throws(() => api.writeProjectFileTool({ path: 'src/big.js', content: 'x'.repeat(1024) }), /Keep tool writes under/i);
    fs.rmSync(outsideFile, { force: true });
  } finally {
    cleanup();
  }
});

test('project tools reject symlink escapes for reads, replacements, and writes', (t) => {
  const { api, projectRoot, cleanup } = buildApi();
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-project-tools-outside-'));
  try {
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(outsideRoot, 'secret.txt'), 'outside secret\n');
    const linkPath = path.join(projectRoot, 'src', 'linked-outside');
    try {
      fs.symlinkSync(outsideRoot, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'EINVAL'].includes(error?.code)) {
        t.skip(`symlinks unavailable: ${error.code}`);
        return;
      }
      throw error;
    }

    assert.throws(
      () => api.readProjectFileTool({ path: 'src/linked-outside/secret.txt' }),
      /inside the Penny project/i,
    );
    assert.throws(
      () => api.replaceInProjectFileTool({ path: 'src/linked-outside/secret.txt', find: 'outside', replace: 'inside' }),
      /inside the Penny project/i,
    );
    assert.throws(
      () => api.writeProjectFileTool({ path: 'src/linked-outside/new.js', content: 'console.log("nope");\n' }),
      /inside the Penny project/i,
    );
    assert.equal(fs.existsSync(path.join(outsideRoot, 'new.js')), false);
  } finally {
    cleanup();
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});

test('project path aliases resolve scoped external roots', () => {
  const vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-local-notes-'));
  const { api, cleanup } = buildApi({
    pathAliases: {
      'obsidian-vault': vaultRoot,
    },
    directWorkspaceWritesEnabled: true,
  });
  try {
    fs.mkdirSync(path.join(vaultRoot, 'Shared Notes'), { recursive: true });
    fs.writeFileSync(path.join(vaultRoot, 'Shared Notes', 'LOCAL NOTE.md'), '# Local Note\n\nActual vault copy.\n');

    const read = api.readProjectFileTool({ path: 'obsidian-vault/Shared Notes/LOCAL NOTE.md' });
    assert.equal(read.path, 'obsidian-vault/Shared Notes/LOCAL NOTE.md');
    assert.match(read.excerpt, /Actual vault copy/);

    const written = api.writeProjectFileTool({
      path: 'obsidian-vault/Shared Notes/REWRITE.md',
      content: 'rewritten\n',
    });
    assert.equal(written.path, 'obsidian-vault/Shared Notes/REWRITE.md');
    assert.equal(fs.readFileSync(path.join(vaultRoot, 'Shared Notes', 'REWRITE.md'), 'utf8'), 'rewritten\n');

    assert.throws(
      () => api.readProjectFileTool({ path: 'obsidian-vault/../outside.md' }),
      /inside the obsidian-vault alias/i,
    );
    assert.throws(
      () => api.readProjectFileTool({ path: 'obsidian-vault\\..\\outside.md' }),
      /inside the obsidian-vault alias/i,
    );
  } finally {
    cleanup();
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  }
});

test('workspace writes stage pending patches by default and approval applies them', () => {
  const { api, projectRoot, cleanup } = buildApi();
  try {
    const staged = api.writeProjectFileTool({
      path: 'src/staged.js',
      content: 'console.log("staged");\n',
    });
    assert.equal(staged.pendingApproval, true);
    assert.equal(staged.applied, false);
    assert.match(staged.patch, /staged/);
    assert.equal(fs.existsSync(path.join(projectRoot, 'src', 'staged.js')), false);

    const listed = api.listPendingWorkspaceWritesTool();
    assert.equal(listed.count, 1);
    assert.equal(listed.pending[0].id, staged.id);

    const approved = api.approvePendingWorkspaceWriteTool({ id: staged.id });
    assert.equal(approved.applied, true);
    assert.equal(fs.readFileSync(path.join(projectRoot, 'src', 'staged.js'), 'utf8'), 'console.log("staged");\n');
    assert.equal(api.listPendingWorkspaceWritesTool().count, 0);
  } finally {
    cleanup();
  }
});

test('pending workspace writes can be denied and conflict if the base file changes', () => {
  const { api, projectRoot, cleanup } = buildApi();
  try {
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src', 'app.js'), 'one\n');

    const denied = api.replaceInProjectFileTool({ path: 'src/app.js', find: 'one', replace: 'two' });
    const deniedResult = api.denyPendingWorkspaceWriteTool({ id: denied.id });
    assert.equal(deniedResult.denied, true);
    assert.equal(fs.readFileSync(path.join(projectRoot, 'src', 'app.js'), 'utf8'), 'one\n');

    const staged = api.replaceInProjectFileTool({ path: 'src/app.js', find: 'one', replace: 'three' });
    fs.writeFileSync(path.join(projectRoot, 'src', 'app.js'), 'changed elsewhere\n');
    assert.throws(
      () => api.approvePendingWorkspaceWriteTool({ id: staged.id }),
      /changed after the pending write was staged/i,
    );
  } finally {
    cleanup();
  }
});

test('single replace treats dollar sequences as literal replacement text', () => {
  const { api, projectRoot, cleanup } = buildApi();
  try {
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src', 'app.js'), 'const label = "TOKEN";\n');

    const staged = api.replaceInProjectFileTool({
      path: 'src/app.js',
      find: 'TOKEN',
      replace: '$$HOME $& $1',
    });
    assert.equal(staged.pendingApproval, true);
    assert.match(staged.patch, /\$\$HOME \$& \$1/);

    api.approvePendingWorkspaceWriteTool({ id: staged.id });
    assert.equal(
      fs.readFileSync(path.join(projectRoot, 'src', 'app.js'), 'utf8'),
      'const label = "$$HOME $& $1";\n',
    );
  } finally {
    cleanup();
  }
});

test('pending workspace writes persist across API re-creation and approval removes stored item', () => {
  const { api, projectRoot, cleanup } = buildApi();
  try {
    const staged = api.writeProjectFileTool({
      path: 'src/persisted.js',
      content: 'console.log("persisted");\n',
    });
    const storePath = path.join(projectRoot, 'data', 'penny-pending-workspace-writes.json');
    assert.equal(fs.existsSync(storePath), true);
    const stored = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    assert.equal(stored.schema, 'penny-pending-workspace-writes.v1');
    assert.equal(stored.pending[0].id, staged.id);
    assert.equal(stored.pending[0].path, 'src/persisted.js');
    assert.equal(Object.hasOwn(stored.pending[0], 'filePath'), false);

    const { api: reloadedApi } = buildApi({ projectRoot });
    const listed = reloadedApi.listPendingWorkspaceWritesTool();
    assert.equal(listed.count, 1);
    assert.equal(listed.pending[0].id, staged.id);
    assert.equal(listed.pending[0].path, 'src/persisted.js');

    const approved = reloadedApi.approvePendingWorkspaceWriteTool({ id: staged.id });
    assert.equal(approved.approved, true);
    assert.equal(fs.readFileSync(path.join(projectRoot, 'src', 'persisted.js'), 'utf8'), 'console.log("persisted");\n');
    const afterApprove = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    assert.deepEqual(afterApprove.pending, []);
  } finally {
    cleanup();
  }
});

test('expired pending workspace writes are pruned from the local store', () => {
  let currentTime = 1000;
  const { api, projectRoot, cleanup } = buildApi({
    pendingWriteTtlMs: 1000,
    now: () => currentTime,
  });
  try {
    api.writeProjectFileTool({
      path: 'src/expired.js',
      content: 'console.log("expired");\n',
    });
    const storePath = path.join(projectRoot, 'data', 'penny-pending-workspace-writes.json');
    currentTime = 3001;
    const { api: reloadedApi } = buildApi({
      projectRoot,
      pendingWriteTtlMs: 1000,
      now: () => currentTime,
    });
    const listed = reloadedApi.listPendingWorkspaceWritesTool();
    assert.equal(listed.count, 0);
    const stored = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    assert.deepEqual(stored.pending, []);
  } finally {
    cleanup();
  }
});

test('reloaded pending workspace writes can be denied and still detect changed-base conflicts', () => {
  const { api, projectRoot, cleanup } = buildApi();
  try {
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src', 'app.js'), 'one\n');

    const denied = api.replaceInProjectFileTool({ path: 'src/app.js', find: 'one', replace: 'two' });
    const { api: reloadedForDeny } = buildApi({ projectRoot });
    const deniedResult = reloadedForDeny.denyPendingWorkspaceWriteTool({ id: denied.id });
    assert.equal(deniedResult.denied, true);
    assert.equal(fs.readFileSync(path.join(projectRoot, 'src', 'app.js'), 'utf8'), 'one\n');
    const storePath = path.join(projectRoot, 'data', 'penny-pending-workspace-writes.json');
    const afterDeny = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    assert.deepEqual(afterDeny.pending, []);

    const conflict = reloadedForDeny.replaceInProjectFileTool({ path: 'src/app.js', find: 'one', replace: 'three' });
    const { api: reloadedForConflict } = buildApi({ projectRoot });
    fs.writeFileSync(path.join(projectRoot, 'src', 'app.js'), 'changed elsewhere\n');
    assert.throws(
      () => reloadedForConflict.approvePendingWorkspaceWriteTool({ id: conflict.id }),
      /changed after the pending write was staged/i,
    );
    const stored = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    assert.equal(stored.pending.length, 1);
    assert.equal(stored.pending[0].id, conflict.id);
  } finally {
    cleanup();
  }
});

test('project read tools refuse secret-bearing files but allow env example', () => {
  const { api, projectRoot, cleanup } = buildApi({
    textExtensions: new Set(['', '.env', '.example', '.txt', '.md', '.js', '.json']),
  });
  try {
    fs.writeFileSync(path.join(projectRoot, '.env'), 'PENNY_API_TOKEN=secret\n');
    fs.writeFileSync(path.join(projectRoot, '.env.example'), 'PENNY_API_TOKEN=\n');
    fs.writeFileSync(path.join(projectRoot, 'notes.txt'), 'PENNY_API_TOKEN=not-a-secret-example\n');
    assert.throws(() => api.readProjectFileTool({ path: '.env' }), /secret-bearing|not readable/i);
    assert.throws(() => api.readProjectFileAroundMatchTool({ path: '.env', query: 'PENNY_API_TOKEN' }), /secret-bearing|not readable/i);
    const example = api.readProjectFileTool({ path: '.env.example' });
    assert.match(example.excerpt, /PENNY_API_TOKEN=/);
    const searched = api.searchProjectTextTool({ query: 'PENNY_API_TOKEN', path: '.', limit: 10 });
    assert.equal(searched.hits.some((hit) => hit.path === '.env'), false);
    assert.equal(searched.hits.some((hit) => hit.path === '.env.example'), true);
  } finally {
    cleanup();
  }
});

test('project write tools refuse secret-bearing files before staging patch previews', async () => {
  const { api, projectRoot, cleanup } = buildApi({
    textExtensions: new Set(['', '.env', '.example', '.txt', '.md', '.js', '.json']),
  });
  try {
    fs.writeFileSync(path.join(projectRoot, '.env'), 'PENNY_API_TOKEN=supersecret\nOTHER=1\n');
    fs.writeFileSync(path.join(projectRoot, '.env.example'), 'PENNY_API_TOKEN=\n');

    assert.throws(
      () => api.writeProjectFileTool({ path: '.env', content: 'PENNY_API_TOKEN=newsecret\nOTHER=2\n' }),
      /secret-bearing|cannot be edited/i,
    );
    assert.throws(
      () => api.replaceInProjectFileTool({ path: '.env', find: 'supersecret', replace: 'newsecret' }),
      /secret-bearing|cannot be edited/i,
    );
    assert.throws(
      () => api.insertInProjectFileTool({ path: '.env', position: 'end', text: 'PENNY_WEB_SEARCH_ENABLED=1\n' }),
      /secret-bearing|cannot be edited/i,
    );
    await assert.rejects(
      () => api.runNodeCheckTool({ path: '.env' }),
      /secret-bearing|cannot be edited/i,
    );

    const pending = api.listPendingWorkspaceWritesTool();
    assert.equal(pending.count, 0);
    assert.equal(JSON.stringify(pending).includes('supersecret'), false);

    const example = api.writeProjectFileTool({ path: '.env.example', content: 'PENNY_API_TOKEN=\nPENNY_WEB_SEARCH_ENABLED=0\n' });
    assert.equal(example.pendingApproval, true);
    assert.match(example.patch, /PENNY_WEB_SEARCH_ENABLED=0/);
  } finally {
    cleanup();
  }
});
