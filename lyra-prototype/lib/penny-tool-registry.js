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

  async function executePennyTool(name, args = {}) {
    if (name === 'get_runtime_status') {
      const data = await getRuntimeStatusTool();
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'list_project_files') {
      const data = listProjectFilesTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'read_project_file') {
      const data = readProjectFileTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'read_project_file_around_match') {
      const data = readProjectFileAroundMatchTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'search_project_text') {
      const data = searchProjectTextTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'write_project_file') {
      const data = writeProjectFileTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'replace_in_project_file') {
      const data = replaceInProjectFileTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'insert_in_project_file') {
      const data = insertInProjectFileTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'run_node_check') {
      const data = await runNodeCheckTool(args);
      return { ok: data.ok !== false, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'get_git_status') {
      const data = await getGitStatusTool();
      return { ok: data.ok !== false, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'read_git_diff') {
      const data = await readGitDiffTool(args);
      return { ok: data.ok !== false, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'search_web') {
      const data = await searchWebTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'read_web_page') {
      const data = await readWebPageTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    if (name === 'read_recent_logs') {
      const data = readRecentLogsTool(args);
      return { ok: true, label: toolLabelFromResult(name, args, data), data };
    }
    return { ok: false, label: name, data: { error: `Unknown tool: ${name}` } };
  }

  return {
    toolLabelFromResult,
    executePennyTool,
  };
}

module.exports = {
  createToolRegistry,
};
