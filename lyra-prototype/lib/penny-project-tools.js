function createProjectToolsApi({
  projectRoot,
  fs,
  path,
  TEXT_FILE_EXTENSIONS,
  clampNumber,
  truncateText,
  formatBytes,
  MAX_TOOL_WRITE_BYTES,
  TOOL_FILE_LIST_MAX_ITEMS,
  TOOL_FILE_READ_MAX_LINES,
  TOOL_SEARCH_MAX_HITS,
  TOOL_COMMAND_TIMEOUT_MS,
  execFileText,
} = {}) {
  const DEFAULT_IGNORED_NAMES = new Set([
    '.git',
    'node_modules',
    'output',
    'tmp',
    'logs',
    '.qa-pw',
    '.playwright-cli',
    '.cache',
    '.next',
    'dist',
    'coverage',
  ]);
  const DEFAULT_LIST_MAX_DEPTH = 4;
  const DEFAULT_SEARCH_MAX_DEPTH = 5;

  if (!projectRoot) throw new TypeError('createProjectToolsApi requires projectRoot');
  if (!fs || typeof fs.readFileSync !== 'function') throw new TypeError('createProjectToolsApi requires fs');
  if (!path || typeof path.resolve !== 'function') throw new TypeError('createProjectToolsApi requires path');
  if (!(TEXT_FILE_EXTENSIONS instanceof Set)) throw new TypeError('createProjectToolsApi requires TEXT_FILE_EXTENSIONS');
  if (typeof clampNumber !== 'function') throw new TypeError('createProjectToolsApi requires clampNumber');
  if (typeof truncateText !== 'function') throw new TypeError('createProjectToolsApi requires truncateText');
  if (typeof formatBytes !== 'function') throw new TypeError('createProjectToolsApi requires formatBytes');
  if (typeof execFileText !== 'function') throw new TypeError('createProjectToolsApi requires execFileText');

  function toProjectRelative(filePath) {
    const rel = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    return rel || '.';
  }

  function resolveProjectPath(inputPath = '.') {
    const raw = String(inputPath || '.').trim() || '.';
    const resolved = path.resolve(projectRoot, raw);
    const normalizedRoot = path.resolve(projectRoot);
    if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new Error('Path must stay inside the Penny project.');
    }
    return resolved;
  }

  function isProbablyTextFile(filePath) {
    return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
  }

  function shouldIgnoreProjectEntry(fullPath, name = '', startPath = projectRoot) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return false;
    if (path.resolve(fullPath) === path.resolve(startPath)) return false;
    return DEFAULT_IGNORED_NAMES.has(cleanName);
  }

  function readUtf8ProjectFile(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Could not read ${toProjectRelative(filePath)}: ${error.message}`);
    }
  }

  function listProjectFilesTool(args = {}) {
    const startPath = resolveProjectPath(args.path || '.');
    const recursive = args.recursive === true;
    const maxDepth = recursive
      ? clampNumber(args.maxDepth, 0, 8, DEFAULT_LIST_MAX_DEPTH)
      : 0;
    const limit = clampNumber(args.limit, 1, TOOL_FILE_LIST_MAX_ITEMS, Math.min(24, TOOL_FILE_LIST_MAX_ITEMS));
    const needle = String(args.pattern || '').trim().toLowerCase();
    const items = [];
    const queue = [{ dir: startPath, depth: 0 }];
    while (queue.length && items.length < limit) {
      const { dir, depth } = queue.shift();
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (shouldIgnoreProjectEntry(fullPath, entry.name, startPath)) continue;
        const rel = toProjectRelative(fullPath);
        const label = entry.isDirectory() ? `${rel}/` : rel;
        if (!needle || label.toLowerCase().includes(needle)) items.push(label);
        if (entry.isDirectory() && recursive && depth < maxDepth && items.length < limit) {
          queue.push({ dir: fullPath, depth: depth + 1 });
        }
        if (items.length >= limit) break;
      }
    }
    return {
      root: toProjectRelative(startPath),
      recursive,
      maxDepth,
      pattern: needle || null,
      limit,
      ignoredDefaults: [...DEFAULT_IGNORED_NAMES],
      items,
      truncated: items.length >= limit,
    };
  }

  function readProjectFileTool(args = {}) {
    const filePath = resolveProjectPath(args.path || '');
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) throw new Error(`${toProjectRelative(filePath)} is a folder, not a file.`);
    if (!isProbablyTextFile(filePath)) throw new Error(`${toProjectRelative(filePath)} does not look like a text file.`);
    const startLine = clampNumber(args.startLine, 1, 50000, 1);
    const endLine = clampNumber(args.endLine, startLine, startLine + TOOL_FILE_READ_MAX_LINES - 1, startLine + 119);
    const raw = readUtf8ProjectFile(filePath);
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const excerpt = lines
      .slice(startLine - 1, endLine)
      .map((line, idx) => `${startLine + idx}:${line}`)
      .join('\n');
    return {
      path: toProjectRelative(filePath),
      startLine,
      endLine: Math.min(endLine, lines.length),
      totalLines: lines.length,
      excerpt: truncateText(excerpt),
    };
  }

  function readProjectFileAroundMatchTool(args = {}) {
    const filePath = resolveProjectPath(args.path || '');
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) throw new Error(`${toProjectRelative(filePath)} is a folder, not a file.`);
    if (!isProbablyTextFile(filePath)) throw new Error(`${toProjectRelative(filePath)} does not look like a text file.`);
    const query = String(args.query || '').trim();
    if (!query) throw new Error('read_project_file_around_match needs a query.');
    const beforeLines = clampNumber(args.beforeLines, 0, 120, 12);
    const afterLines = clampNumber(args.afterLines, 1, TOOL_FILE_READ_MAX_LINES, 48);
    const raw = readUtf8ProjectFile(filePath);
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const matchIndex = lines.findIndex((line) => line.toLowerCase().includes(query.toLowerCase()));
    if (matchIndex === -1) {
      throw new Error(`Could not find "${query}" in ${toProjectRelative(filePath)}.`);
    }
    const startLine = Math.max(1, matchIndex + 1 - beforeLines);
    const endLine = Math.min(lines.length, matchIndex + 1 + afterLines);
    const excerpt = lines
      .slice(startLine - 1, endLine)
      .map((line, idx) => `${startLine + idx}:${line}`)
      .join('\n');
    return {
      path: toProjectRelative(filePath),
      query,
      matchLine: matchIndex + 1,
      startLine,
      endLine,
      totalLines: lines.length,
      excerpt: truncateText(excerpt),
    };
  }

  function searchProjectTextTool(args = {}) {
    const query = String(args.query || '').trim();
    if (!query) throw new Error('search_project_text needs a query.');
    const startPath = resolveProjectPath(args.path || '.');
    const maxDepth = clampNumber(args.maxDepth, 0, 8, DEFAULT_SEARCH_MAX_DEPTH);
    const limit = clampNumber(args.limit, 1, TOOL_SEARCH_MAX_HITS, Math.min(12, TOOL_SEARCH_MAX_HITS));
    const queue = [{ target: startPath, depth: 0 }];
    const hits = [];
    while (queue.length && hits.length < limit) {
      const { target: current, depth } = queue.shift();
      const stat = fs.statSync(current);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(current, { withFileTypes: true })
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        for (const entry of entries) {
          const nextPath = path.join(current, entry.name);
          if (shouldIgnoreProjectEntry(nextPath, entry.name, startPath)) continue;
          if (entry.isDirectory()) {
            if (depth >= maxDepth) continue;
            queue.push({ target: nextPath, depth: depth + 1 });
          } else {
            queue.push({ target: nextPath, depth });
          }
        }
        continue;
      }
      if (!isProbablyTextFile(current) || stat.size > 300 * 1024) continue;
      const lines = readUtf8ProjectFile(current).replace(/\r\n/g, '\n').split('\n');
      for (let i = 0; i < lines.length && hits.length < limit; i += 1) {
        if (!lines[i].toLowerCase().includes(query.toLowerCase())) continue;
        hits.push({
          path: toProjectRelative(current),
          line: i + 1,
          text: truncateText(lines[i].trim(), 240),
        });
      }
    }
    return {
      query,
      root: toProjectRelative(startPath),
      maxDepth,
      limit,
      ignoredDefaults: [...DEFAULT_IGNORED_NAMES],
      hits,
      truncated: hits.length >= limit,
    };
  }

  function ensureWritableTextPath(filePath) {
    if (!isProbablyTextFile(filePath)) {
      throw new Error(`${toProjectRelative(filePath)} is not an allowed text/code file.`);
    }
  }

  function writeProjectFileTool(args = {}) {
    const filePath = resolveProjectPath(args.path || '');
    ensureWritableTextPath(filePath);
    const content = String(args.content || '').replace(/\r\n/g, '\n');
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_TOOL_WRITE_BYTES) {
      throw new Error(`Refusing to write ${formatBytes(bytes)} to ${toProjectRelative(filePath)}. Keep tool writes under ${formatBytes(MAX_TOOL_WRITE_BYTES)}.`);
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const existed = fs.existsSync(filePath);
    fs.writeFileSync(filePath, content, 'utf8');
    return {
      path: toProjectRelative(filePath),
      action: existed ? 'updated' : 'created',
      bytes,
      lines: content ? content.split('\n').length : 0,
    };
  }

  function replaceInProjectFileTool(args = {}) {
    const filePath = resolveProjectPath(args.path || '');
    ensureWritableTextPath(filePath);
    const find = String(args.find || '');
    const replace = String(args.replace || '');
    const replaceAll = args.replaceAll === true;
    if (!find) throw new Error('replace_in_project_file needs a non-empty `find` string.');
    const content = readUtf8ProjectFile(filePath);
    const occurrences = content.split(find).length - 1;
    if (!occurrences) throw new Error(`Could not find the target text in ${toProjectRelative(filePath)}.`);
    const expectedMatches = args.expectedMatches == null ? null : clampNumber(args.expectedMatches, 1, 1000, 1);
    if (expectedMatches != null && expectedMatches !== occurrences) {
      throw new Error(`Expected ${expectedMatches} matches in ${toProjectRelative(filePath)}, but found ${occurrences}.`);
    }
    const next = replaceAll ? content.split(find).join(replace) : content.replace(find, replace);
    const bytes = Buffer.byteLength(next, 'utf8');
    if (bytes > MAX_TOOL_WRITE_BYTES) {
      throw new Error(`Refusing to write ${formatBytes(bytes)} to ${toProjectRelative(filePath)}. Keep tool writes under ${formatBytes(MAX_TOOL_WRITE_BYTES)}.`);
    }
    fs.writeFileSync(filePath, next, 'utf8');
    return {
      path: toProjectRelative(filePath),
      replaced: replaceAll ? occurrences : 1,
      remainingMatches: replaceAll ? 0 : Math.max(0, occurrences - 1),
    };
  }

  function insertInProjectFileTool(args = {}) {
    const filePath = resolveProjectPath(args.path || '');
    ensureWritableTextPath(filePath);
    let text = String(args.text || '').replace(/\r\n/g, '\n');
    const position = String(args.position || 'end').trim().toLowerCase();
    const anchor = args.anchor == null ? '' : String(args.anchor);
    const lineAware = args.lineAware === true;
    const expectedMatches = args.expectedMatches == null ? null : clampNumber(args.expectedMatches, 1, 1000, 1);
    if (!text) throw new Error('insert_in_project_file needs non-empty `text`.');
    const content = readUtf8ProjectFile(filePath);
    let next = content;
    let anchorMatches = 0;

    if (lineAware && (position === 'start' || position === 'end')) {
      const trimmed = text.replace(/^\n+/, '').replace(/\n+$/, '');
      if (position === 'start') {
        text = content ? `${trimmed}\n` : trimmed;
      } else {
        const prefix = content && !content.endsWith('\n') ? '\n' : '';
        text = `${prefix}${trimmed}`;
      }
    }

    if (position === 'start') {
      next = `${text}${content}`;
    } else if (position === 'end') {
      next = `${content}${text}`;
    } else if (position === 'before' || position === 'after') {
      if (!anchor) throw new Error(`insert_in_project_file needs \`anchor\` when position is ${position}.`);
      anchorMatches = content.split(anchor).length - 1;
      if (!anchorMatches) throw new Error(`Could not find the anchor text in ${toProjectRelative(filePath)}.`);
      if (expectedMatches != null && expectedMatches !== anchorMatches) {
        throw new Error(`Expected ${expectedMatches} anchor match${expectedMatches === 1 ? '' : 'es'} in ${toProjectRelative(filePath)}, but found ${anchorMatches}.`);
      }
      const idx = content.indexOf(anchor);
      const insertAt = position === 'before' ? idx : idx + anchor.length;
      next = `${content.slice(0, insertAt)}${text}${content.slice(insertAt)}`;
    } else {
      throw new Error('insert_in_project_file position must be start, end, before, or after.');
    }

    const bytes = Buffer.byteLength(next, 'utf8');
    if (bytes > MAX_TOOL_WRITE_BYTES) {
      throw new Error(`Refusing to write ${formatBytes(bytes)} to ${toProjectRelative(filePath)}. Keep tool writes under ${formatBytes(MAX_TOOL_WRITE_BYTES)}.`);
    }
    fs.writeFileSync(filePath, next, 'utf8');
    return {
      path: toProjectRelative(filePath),
      inserted: text.split('\n').length,
      textPreview: truncateText(text.replace(/^\n+/, '').replace(/\n+$/, ''), 1200),
      position,
      anchor: anchor || null,
      anchorMatches,
      lineAware,
    };
  }

  async function runNodeCheckTool(args = {}) {
    const filePath = resolveProjectPath(args.path || 'server.js');
    ensureWritableTextPath(filePath);
    try {
      const { stdout, stderr } = await execFileText('node', ['--check', filePath], {
        cwd: projectRoot,
        timeout: TOOL_COMMAND_TIMEOUT_MS,
      });
      return {
        path: toProjectRelative(filePath),
        ok: true,
        stdout: truncateText(String(stdout || '').trim()),
        stderr: truncateText(String(stderr || '').trim()),
      };
    } catch (error) {
      return {
        path: toProjectRelative(filePath),
        ok: false,
        stdout: truncateText(String(error?.stdout || '').trim()),
        stderr: truncateText(String(error?.stderr || error?.message || '').trim()),
      };
    }
  }

  return {
    toProjectRelative,
    resolveProjectPath,
    isProbablyTextFile,
    readUtf8ProjectFile,
    listProjectFilesTool,
    readProjectFileTool,
    readProjectFileAroundMatchTool,
    searchProjectTextTool,
    ensureWritableTextPath,
    writeProjectFileTool,
    replaceInProjectFileTool,
    insertInProjectFileTool,
    runNodeCheckTool,
  };
}

module.exports = {
  createProjectToolsApi,
};
