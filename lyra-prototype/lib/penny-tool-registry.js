const TOOL_CAPABILITY_SURFACES = new Set(['native', 'mcp', 'openapi']);

const TOOL_CAPABILITY_TEMPLATES = {
  get_runtime_status: { label: 'get runtime status', operationKind: 'read', sideEffectClass: 'none' },
  list_project_files: { label: 'list project files', operationKind: 'read', sideEffectClass: 'none' },
  read_project_file: { label: 'read project file', operationKind: 'read', sideEffectClass: 'none' },
  read_project_file_around_match: { label: 'read project file around match', operationKind: 'read', sideEffectClass: 'none' },
  search_project_text: { label: 'search project text', operationKind: 'search', sideEffectClass: 'none' },
  write_project_file: { label: 'write project file', operationKind: 'write', sideEffectClass: 'workspace-write' },
  replace_in_project_file: { label: 'replace in project file', operationKind: 'write', sideEffectClass: 'workspace-write' },
  insert_in_project_file: { label: 'insert in project file', operationKind: 'write', sideEffectClass: 'workspace-write' },
  run_node_check: { label: 'run node check', operationKind: 'inspect', sideEffectClass: 'workspace-read' },
  get_git_status: { label: 'get git status', operationKind: 'inspect', sideEffectClass: 'workspace-read' },
  read_git_diff: { label: 'read git diff', operationKind: 'inspect', sideEffectClass: 'workspace-read' },
  search_web: { label: 'search web', operationKind: 'search', sideEffectClass: 'external-read' },
  read_web_page: { label: 'read web page', operationKind: 'read', sideEffectClass: 'external-read' },
  read_recent_logs: { label: 'read recent logs', operationKind: 'read', sideEffectClass: 'workspace-read' },
};

function validateToolCapabilityDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new TypeError('ToolCapabilityDescriptor must be an object');
  }
  const id = String(descriptor.id || '').trim();
  const label = String(descriptor.label || '').trim();
  const surface = String(descriptor.surface || '').trim();
  const operationKind = String(descriptor.operationKind || '').trim();
  const sideEffectClass = String(descriptor.sideEffectClass || '').trim();
  const executionSupport = String(descriptor.executionSupport || '').trim();

  if (!id) throw new TypeError('ToolCapabilityDescriptor requires a non-empty id');
  if (!label) throw new TypeError('ToolCapabilityDescriptor requires a non-empty label');
  if (!TOOL_CAPABILITY_SURFACES.has(surface)) {
    throw new TypeError(`ToolCapabilityDescriptor surface must be one of: ${Array.from(TOOL_CAPABILITY_SURFACES).join(', ')}`);
  }
  if (!operationKind) throw new TypeError(`ToolCapabilityDescriptor ${id} requires a non-empty operationKind`);
  if (!sideEffectClass) throw new TypeError(`ToolCapabilityDescriptor ${id} requires a non-empty sideEffectClass`);
  if (!executionSupport) throw new TypeError(`ToolCapabilityDescriptor ${id} requires a non-empty executionSupport`);

  return {
    id,
    label,
    surface,
    operationKind,
    sideEffectClass,
    executionSupport,
  };
}

function normalizeToolCapabilityDescriptor(descriptor) {
  return Object.freeze({ ...validateToolCapabilityDescriptor(descriptor) });
}

function buildToolCapabilityDescriptor(toolName, surface = 'native') {
  const template = TOOL_CAPABILITY_TEMPLATES[toolName];
  if (!template) {
    throw new TypeError(`Unknown tool capability descriptor: ${toolName}`);
  }
  return normalizeToolCapabilityDescriptor({
    id: toolName,
    label: template.label,
    surface,
    operationKind: template.operationKind,
    sideEffectClass: template.sideEffectClass,
    executionSupport: 'local',
  });
}

function createToolRegistry({
  getRuntimeStatusTool,
  listProjectFilesTool,
  readProjectFileTool,
  readProjectFileAroundMatchTool,
  searchProjectTextTool,
  writeProjectFileTool,
  replaceInProjectFileTool,
  insertInProjectFileTool,
  runNodeCheckTool,
  getGitStatusTool,
  readGitDiffTool,
  searchWebTool,
  readWebPageTool,
  readRecentLogsTool,
} = {}) {
  if (typeof getRuntimeStatusTool !== 'function'
    || typeof listProjectFilesTool !== 'function'
    || typeof readProjectFileTool !== 'function'
    || typeof readProjectFileAroundMatchTool !== 'function'
    || typeof searchProjectTextTool !== 'function'
    || typeof writeProjectFileTool !== 'function'
    || typeof replaceInProjectFileTool !== 'function'
    || typeof insertInProjectFileTool !== 'function'
    || typeof runNodeCheckTool !== 'function'
    || typeof getGitStatusTool !== 'function'
    || typeof readGitDiffTool !== 'function'
    || typeof searchWebTool !== 'function'
    || typeof readWebPageTool !== 'function'
    || typeof readRecentLogsTool !== 'function') {
    throw new TypeError('createToolRegistry requires all tool implementations');
  }

  const toolCapabilityDescriptors = [
    buildToolCapabilityDescriptor('get_runtime_status'),
    buildToolCapabilityDescriptor('list_project_files'),
    buildToolCapabilityDescriptor('read_project_file'),
    buildToolCapabilityDescriptor('read_project_file_around_match'),
    buildToolCapabilityDescriptor('search_project_text'),
    buildToolCapabilityDescriptor('write_project_file'),
    buildToolCapabilityDescriptor('replace_in_project_file'),
    buildToolCapabilityDescriptor('insert_in_project_file'),
    buildToolCapabilityDescriptor('run_node_check'),
    buildToolCapabilityDescriptor('get_git_status'),
    buildToolCapabilityDescriptor('read_git_diff'),
    buildToolCapabilityDescriptor('search_web'),
    buildToolCapabilityDescriptor('read_web_page'),
    buildToolCapabilityDescriptor('read_recent_logs'),
  ];

  const toolCapabilityDescriptorById = new Map(toolCapabilityDescriptors.map((descriptor) => [descriptor.id, descriptor]));

  function cloneToolCapabilityDescriptor(descriptor) {
    return descriptor ? { ...descriptor } : null;
  }

  function listToolCapabilityDescriptors() {
    return toolCapabilityDescriptors.map((descriptor) => cloneToolCapabilityDescriptor(descriptor));
  }

  function getToolCapabilityDescriptor(name) {
    const descriptor = toolCapabilityDescriptorById.get(String(name || '').trim());
    return cloneToolCapabilityDescriptor(descriptor);
  }

  function toolLabelFromResult(name, args = {}, result = {}) {
    if (name === 'read_project_file') return `read ${result.path || args.path || 'file'}`;
    if (name === 'read_project_file_around_match') return `read ${result.path || args.path || 'file'} around ${result.query || args.query || 'match'}`;
    if (name === 'list_project_files') return `listed ${result.root || args.path || '.'}`;
    if (name === 'search_project_text') return `searched "${args.query || result.query || ''}"`;
    if (name === 'write_project_file') return `${result.action || 'wrote'} ${result.path || args.path || 'file'}`;
    if (name === 'replace_in_project_file') return `edited ${result.path || args.path || 'file'}`;
    if (name === 'insert_in_project_file') return `inserted text into ${result.path || args.path || 'file'}`;
    if (name === 'run_node_check') return `checked syntax for ${result.path || args.path || 'file'}`;
    if (name === 'get_git_status') return 'checked git status';
    if (name === 'read_git_diff') return `checked diff${result.path ? ` for ${result.path}` : ''}`;
    if (name === 'search_web') return `searched the web for "${args.query || result.query || ''}"`;
    if (name === 'read_web_page') return `read ${result.url || args.url || 'web page'}`;
    if (name === 'read_recent_logs') return `checked ${result.path || args.target || 'logs'}`;
    if (name === 'get_runtime_status') return 'checked runtime status';
    return name;
  }

  function buildToolErrorData(name, args = {}, error) {
    const message = String(error?.message || error || 'Unknown tool error').trim();
    const base = { error: message };
    if (name === 'list_project_files') {
      return {
        ...base,
        root: args.path || '.',
        recursive: args.recursive === true,
        pattern: args.pattern || '',
        maxDepth: args.maxDepth,
      };
    }
    if (name === 'read_project_file') {
      return {
        ...base,
        path: args.path || '',
        startLine: args.startLine,
        endLine: args.endLine,
      };
    }
    if (name === 'read_project_file_around_match') {
      return {
        ...base,
        path: args.path || '',
        query: args.query || '',
        beforeLines: args.beforeLines,
        afterLines: args.afterLines,
      };
    }
    if (name === 'search_project_text') {
      return {
        ...base,
        query: args.query || '',
        path: args.path || '.',
        limit: args.limit,
        maxDepth: args.maxDepth,
      };
    }
    if (name === 'write_project_file' || name === 'replace_in_project_file' || name === 'insert_in_project_file') {
      return {
        ...base,
        path: args.path || '',
      };
    }
    if (name === 'run_node_check') {
      return {
        ...base,
        path: args.path || '',
        ok: false,
      };
    }
    if (name === 'read_git_diff') {
      return {
        ...base,
        path: args.path || '',
      };
    }
    if (name === 'search_web') {
      return {
        ...base,
        query: args.query || '',
        limit: args.limit,
      };
    }
    if (name === 'read_web_page') {
      return {
        ...base,
        url: args.url || '',
      };
    }
    if (name === 'read_recent_logs') {
      return {
        ...base,
        path: args.target || 'latest',
        lines: args.lines,
      };
    }
    return base;
  }

  async function runTool(name, args, runner, options = {}) {
    const { okFromData = null } = options || {};
    try {
      const data = await runner();
      const ok = okFromData == null ? true : okFromData(data);
      return { ok, label: toolLabelFromResult(name, args, data), data };
    } catch (error) {
      const data = buildToolErrorData(name, args, error);
      return { ok: false, label: toolLabelFromResult(name, args, data), data };
    }
  }

  async function executePennyTool(name, args = {}) {
    if (name === 'get_runtime_status') {
      return runTool(name, args, () => getRuntimeStatusTool());
    }
    if (name === 'list_project_files') {
      return runTool(name, args, () => listProjectFilesTool(args));
    }
    if (name === 'read_project_file') {
      return runTool(name, args, () => readProjectFileTool(args));
    }
    if (name === 'read_project_file_around_match') {
      return runTool(name, args, () => readProjectFileAroundMatchTool(args));
    }
    if (name === 'search_project_text') {
      return runTool(name, args, () => searchProjectTextTool(args));
    }
    if (name === 'write_project_file') {
      return runTool(name, args, () => writeProjectFileTool(args));
    }
    if (name === 'replace_in_project_file') {
      return runTool(name, args, () => replaceInProjectFileTool(args));
    }
    if (name === 'insert_in_project_file') {
      return runTool(name, args, () => insertInProjectFileTool(args));
    }
    if (name === 'run_node_check') {
      return runTool(name, args, () => runNodeCheckTool(args), {
        okFromData(data) {
          return data?.ok !== false;
        },
      });
    }
    if (name === 'get_git_status') {
      return runTool(name, args, () => getGitStatusTool(), {
        okFromData(data) {
          return data?.ok !== false;
        },
      });
    }
    if (name === 'read_git_diff') {
      return runTool(name, args, () => readGitDiffTool(args), {
        okFromData(data) {
          return data?.ok !== false;
        },
      });
    }
    if (name === 'search_web') {
      return runTool(name, args, () => searchWebTool(args));
    }
    if (name === 'read_web_page') {
      return runTool(name, args, () => readWebPageTool(args));
    }
    if (name === 'read_recent_logs') {
      return runTool(name, args, () => readRecentLogsTool(args));
    }
    return { ok: false, label: name, data: { error: `Unknown tool: ${name}` } };
  }

  return {
    toolLabelFromResult,
    executePennyTool,
    listToolCapabilityDescriptors,
    getToolCapabilityDescriptor,
  };
}

module.exports = {
  createToolRegistry,
  validateToolCapabilityDescriptor,
  normalizeToolCapabilityDescriptor,
  buildToolCapabilityDescriptor,
};
