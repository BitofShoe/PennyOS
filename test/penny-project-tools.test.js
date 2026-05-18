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

function buildApi({ pathAliases = {}, directWorkspaceWritesEnabled = false, textExtensions = null } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-project-tools-'));
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
    assert.throws(() => api.writeProjectFileTool({ path: 'src/big.js', content: 'x'.repeat(1024) }), /Keep tool writes under/i);
    fs.rmSync(outsideFile, { force: true });
  } finally {
    cleanup();
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
