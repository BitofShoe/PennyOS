const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createToolRegistry,
  buildToolCapabilityDescriptor,
  validateToolCapabilityDescriptor,
} = require('../lib/penny-tool-registry');

function buildRegistry(overrides = {}) {
  return createToolRegistry({
    getRuntimeStatusTool: overrides.getRuntimeStatusTool || (async () => ({ ok: true })),
    listProjectFilesTool: overrides.listProjectFilesTool || (() => ({ items: [] })),
    readProjectFileTool: overrides.readProjectFileTool || (() => ({ path: 'README.md', excerpt: '1:hello' })),
    readProjectFileAroundMatchTool: overrides.readProjectFileAroundMatchTool || (() => ({ path: 'README.md', query: 'hello', excerpt: '1:hello' })),
    searchProjectTextTool: overrides.searchProjectTextTool || (() => ({ hits: [] })),
    writeProjectFileTool: overrides.writeProjectFileTool || (() => ({ path: 'tmp.txt', action: 'updated' })),
    replaceInProjectFileTool: overrides.replaceInProjectFileTool || (() => ({ path: 'tmp.txt', replaced: 1 })),
    insertInProjectFileTool: overrides.insertInProjectFileTool || (() => ({ path: 'tmp.txt', inserted: 1 })),
    runNodeCheckTool: overrides.runNodeCheckTool || (async () => ({ ok: true, path: 'server.js' })),
    getGitStatusTool: overrides.getGitStatusTool || (async () => ({ ok: true, status: '(clean)' })),
    readGitDiffTool: overrides.readGitDiffTool || (async () => ({ ok: true, diff: '' })),
    searchWebTool: overrides.searchWebTool || (async () => ({ query: 'test', results: [] })),
    readWebPageTool: overrides.readWebPageTool || (async () => ({ url: 'https://example.com', text: 'hello' })),
    readRecentLogsTool: overrides.readRecentLogsTool || (() => ({ path: 'latest', excerpt: '' })),
  });
}

test('executePennyTool converts sync read errors into failed tool results', async () => {
  const registry = buildRegistry({
    readProjectFileAroundMatchTool() {
      throw new Error('Could not find "cloud-hosted multi-user" in README.md.');
    },
  });

  const result = await registry.executePennyTool('read_project_file_around_match', {
    path: 'README.md',
    query: 'cloud-hosted multi-user',
    beforeLines: 12,
    afterLines: 48,
  });

  assert.equal(result.ok, false);
  assert.match(result.data.error, /could not find/i);
  assert.equal(result.data.path, 'README.md');
  assert.equal(result.data.query, 'cloud-hosted multi-user');
  assert.match(result.label, /README\.md/i);
});

test('createToolRegistry exposes bounded native capability descriptors without affecting routing', async () => {
  const registry = buildRegistry({
    searchWebTool: async (args) => ({ query: args.query, results: [] }),
  });

  const descriptors = registry.listToolCapabilityDescriptors();
  assert.equal(descriptors.length, 14);
  assert.deepEqual(
    descriptors.map((descriptor) => descriptor.surface),
    Array(14).fill('native'),
  );

  const toolNames = descriptors.map((descriptor) => descriptor.id);
  assert.deepEqual(toolNames, [
    'get_runtime_status',
    'list_project_files',
    'read_project_file',
    'read_project_file_around_match',
    'search_project_text',
    'write_project_file',
    'replace_in_project_file',
    'insert_in_project_file',
    'run_node_check',
    'get_git_status',
    'read_git_diff',
    'search_web',
    'read_web_page',
    'read_recent_logs',
  ]);

  const descriptor = registry.getToolCapabilityDescriptor('search_web');
  assert.deepEqual(descriptor, {
    id: 'search_web',
    label: 'search web',
    surface: 'native',
    operationKind: 'search',
    sideEffectClass: 'external-read',
    executionSupport: 'local',
  });

  descriptor.surface = 'mcp';
  assert.equal(registry.getToolCapabilityDescriptor('search_web').surface, 'native');

  const result = await registry.executePennyTool('search_web', { query: 'penny', limit: 3 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { query: 'penny', results: [] });
});

test('ToolCapabilityDescriptor validation accepts supported surfaces and rejects unknown ones', () => {
  assert.deepEqual(validateToolCapabilityDescriptor({
    id: 'demo_tool',
    label: 'demo tool',
    surface: 'mcp',
    operationKind: 'query',
    sideEffectClass: 'none',
    executionSupport: 'remote',
  }), {
    id: 'demo_tool',
    label: 'demo tool',
    surface: 'mcp',
    operationKind: 'query',
    sideEffectClass: 'none',
    executionSupport: 'remote',
  });

  assert.throws(() => buildToolCapabilityDescriptor('does_not_exist'), /unknown tool capability descriptor/i);
  assert.throws(() => validateToolCapabilityDescriptor({
    id: 'broken',
    label: 'broken tool',
    surface: 'websocket',
    operationKind: 'query',
    sideEffectClass: 'none',
    executionSupport: 'local',
  }), /surface must be one of/i);
});
