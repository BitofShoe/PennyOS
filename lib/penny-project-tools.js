const crypto = require('crypto');

function createProjectToolsApi({
  projectRoot,
  pathAliases = {},
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
  directWorkspaceWritesEnabled = false,
  pendingWriteTtlMs = 30 * 60 * 1000,
  now = () => Date.now(),
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

  const normalizedProjectRoot = path.resolve(projectRoot);
  const pendingWorkspaceWrites = new Map();
  const normalizedPathAliases = Object.entries(pathAliases || {})
    .map(([name, root]) => {
      const alias = String(name || '').trim().replace(/\\/g, '/');
      const rootPath = String(root || '').trim();
      if (!alias || alias === '.' || alias === '..' || alias.includes('/')) return null;
      if (!rootPath) return null;
      return {
        alias,
        root: path.resolve(rootPath),
      };
    })
    .filter(Boolean);
  const pathAliasByName = new Map(normalizedPathAliases.map((item) => [item.alias, item]));

  function isPathInsideRoot(candidatePath, rootPath) {
    const resolved = path.resolve(candidatePath);
    const root = path.resolve(rootPath);
    return resolved === root || resolved.startsWith(`${root}${path.sep}`);
  }

  function toProjectRelative(filePath) {
    const resolved = path.resolve(filePath);
    for (const { alias, root } of normalizedPathAliases) {
      if (!isPathInsideRoot(resolved, root)) continue;
      const rel = path.relative(root, resolved).replace(/\\/g, '/');
      return rel ? `${alias}/${rel}` : alias;
    }
    const rel = path.relative(normalizedProjectRoot, resolved).replace(/\\/g, '/');
    return rel || '.';
  }

  function resolveProjectPath(inputPath = '.') {
    const raw = String(inputPath || '.').trim() || '.';
    const aliasPath = raw.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
    const aliasName = aliasPath.split('/')[0];
    const alias = pathAliasByName.get(aliasName);
    if (alias) {
      const tail = aliasPath === aliasName ? '.' : aliasPath.slice(aliasName.length + 1);
      const resolvedAliasPath = path.resolve(alias.root, tail || '.');
      if (!isPathInsideRoot(resolvedAliasPath, alias.root)) {
        throw new Error(`Path must stay inside the ${alias.alias} alias.`);
      }
      return resolvedAliasPath;
    }
    const resolved = path.resolve(normalizedProjectRoot, raw);
    if (!isPathInsideRoot(resolved, normalizedProjectRoot)) {
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

  function sha256Text(text = '') {
    return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
  }

  function readExistingTextForWrite(filePath) {
    if (!fs.existsSync(filePath)) return { existed: false, content: '' };
    return { existed: true, content: readUtf8ProjectFile(filePath) };
  }

  function countLines(text = '') {
    return text ? String(text).split('\n').length : 0;
  }

  function buildPendingPatchPreview(filePath, before = '', after = '') {
    const beforeLines = String(before || '').replace(/\r\n/g, '\n').split('\n');
    const afterLines = String(after || '').replace(/\r\n/g, '\n').split('\n');
    let prefix = 0;
    while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) {
      prefix += 1;
    }
    let suffix = 0;
    while (
      suffix + prefix < beforeLines.length
      && suffix + prefix < afterLines.length
      && beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
    ) {
      suffix += 1;
    }
    const beforeChanged = beforeLines.slice(prefix, beforeLines.length - suffix);
    const afterChanged = afterLines.slice(prefix, afterLines.length - suffix);
    const contextBefore = beforeLines.slice(Math.max(0, prefix - 3), prefix).map((line) => ` ${line}`);
    const contextAfter = afterLines.slice(afterLines.length - suffix, Math.min(afterLines.length, afterLines.length - suffix + 3)).map((line) => ` ${line}`);
    const hunk = [
      `--- a/${toProjectRelative(filePath)}`,
      `+++ b/${toProjectRelative(filePath)}`,
      `@@ line ${prefix + 1} @@`,
      ...contextBefore,
      ...beforeChanged.map((line) => `-${line}`),
      ...afterChanged.map((line) => `+${line}`),
      ...contextAfter,
    ].join('\n');
    return truncateText(hunk, 6000);
  }

  function pruneExpiredPendingWorkspaceWrites() {
    const timestamp = now();
    for (const [id, pending] of pendingWorkspaceWrites.entries()) {
      if (Number(pending.expiresAt || 0) <= timestamp) pendingWorkspaceWrites.delete(id);
    }
  }

  function publicPendingWorkspaceWrite(pending) {
    return {
      id: pending.id,
      path: pending.path,
      action: pending.action,
      operation: pending.operation,
      bytes: pending.bytes,
      lines: pending.lines,
      createdAt: pending.createdAt,
      expiresAt: pending.expiresAt,
      baseHash: pending.baseHash,
      nextHash: pending.nextHash,
      patch: pending.patch,
      summary: pending.summary,
      directWritesEnabled: false,
      ...(pending.metadata || {}),
    };
  }

  function stagePendingWorkspaceWrite({
    filePath,
    operation,
    before = '',
    after = '',
    action = 'updated',
    metadata = {},
  } = {}) {
    const bytes = Buffer.byteLength(after, 'utf8');
    if (bytes > MAX_TOOL_WRITE_BYTES) {
      throw new Error(`Refusing to write ${formatBytes(bytes)} to ${toProjectRelative(filePath)}. Keep tool writes under ${formatBytes(MAX_TOOL_WRITE_BYTES)}.`);
    }
    const createdAt = now();
    const id = crypto.randomBytes(16).toString('hex');
    const pending = {
      id,
      filePath,
      path: toProjectRelative(filePath),
      action,
      operation,
      before,
      after,
      baseHash: sha256Text(before),
      nextHash: sha256Text(after),
      bytes,
      lines: countLines(after),
      createdAt,
      expiresAt: createdAt + Math.max(1000, Number(pendingWriteTtlMs) || 0),
      patch: buildPendingPatchPreview(filePath, before, after),
      summary: `${operation} pending approval for ${toProjectRelative(filePath)}`,
      metadata,
    };
    pendingWorkspaceWrites.set(id, pending);
    return {
      ...publicPendingWorkspaceWrite(pending),
      pendingApproval: true,
      applied: false,
    };
  }

  function directWriteWorkspaceFile({ filePath, content, action = 'updated', metadata = {} } = {}) {
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_TOOL_WRITE_BYTES) {
      throw new Error(`Refusing to write ${formatBytes(bytes)} to ${toProjectRelative(filePath)}. Keep tool writes under ${formatBytes(MAX_TOOL_WRITE_BYTES)}.`);
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return {
      path: toProjectRelative(filePath),
      action,
      bytes,
      lines: countLines(content),
      applied: true,
      directWrite: true,
      ...metadata,
    };
  }

  function writeProjectFileTool(args = {}) {
    const filePath = resolveProjectPath(args.path || '');
    ensureWritableTextPath(filePath);
    const content = String(args.content || '').replace(/\r\n/g, '\n');
    const { existed, content: before } = readExistingTextForWrite(filePath);
    const action = existed ? 'updated' : 'created';
    if (directWorkspaceWritesEnabled === true) {
      return directWriteWorkspaceFile({ filePath, content, action });
    }
    return stagePendingWorkspaceWrite({
      filePath,
      operation: 'write_project_file',
      before,
      after: content,
      action,
    });
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
    const metadata = {
      replaced: replaceAll ? occurrences : 1,
      remainingMatches: replaceAll ? 0 : Math.max(0, occurrences - 1),
    };
    if (directWorkspaceWritesEnabled === true) {
      return directWriteWorkspaceFile({ filePath, content: next, action: 'updated', metadata });
    }
    return stagePendingWorkspaceWrite({
      filePath,
      operation: 'replace_in_project_file',
      before: content,
      after: next,
      action: 'updated',
      metadata,
    });
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
    const metadata = {
      inserted: text.split('\n').length,
      textPreview: truncateText(text.replace(/^\n+/, '').replace(/\n+$/, ''), 1200),
      position,
      anchor: anchor || null,
      anchorMatches,
      lineAware,
    };
    if (directWorkspaceWritesEnabled === true) {
      return directWriteWorkspaceFile({ filePath, content: next, action: 'updated', metadata });
    }
    return stagePendingWorkspaceWrite({
      filePath,
      operation: 'insert_in_project_file',
      before: content,
      after: next,
      action: 'updated',
      metadata,
    });
  }

  function listPendingWorkspaceWritesTool() {
    pruneExpiredPendingWorkspaceWrites();
    return {
      pending: [...pendingWorkspaceWrites.values()].map(publicPendingWorkspaceWrite),
      count: pendingWorkspaceWrites.size,
      directWritesEnabled: directWorkspaceWritesEnabled === true,
    };
  }

  function approvePendingWorkspaceWriteTool(args = {}) {
    pruneExpiredPendingWorkspaceWrites();
    const id = String(args.id || args.pendingWriteId || '').trim();
    if (!id) throw new Error('approve_pending_workspace_write needs an id.');
    const pending = pendingWorkspaceWrites.get(id);
    if (!pending) throw new Error(`Pending workspace write ${id} was not found or has expired.`);
    const current = readExistingTextForWrite(pending.filePath);
    const currentHash = sha256Text(current.content);
    if (currentHash !== pending.baseHash) {
      throw new Error(`${pending.path} changed after the pending write was staged. Review and restage the edit.`);
    }
    fs.mkdirSync(path.dirname(pending.filePath), { recursive: true });
    fs.writeFileSync(pending.filePath, pending.after, 'utf8');
    pendingWorkspaceWrites.delete(id);
    return {
      ...publicPendingWorkspaceWrite(pending),
      pendingApproval: false,
      applied: true,
      approved: true,
      currentExisted: current.existed,
    };
  }

  function denyPendingWorkspaceWriteTool(args = {}) {
    pruneExpiredPendingWorkspaceWrites();
    const id = String(args.id || args.pendingWriteId || '').trim();
    if (!id) throw new Error('deny_pending_workspace_write needs an id.');
    const pending = pendingWorkspaceWrites.get(id);
    if (!pending) throw new Error(`Pending workspace write ${id} was not found or has expired.`);
    pendingWorkspaceWrites.delete(id);
    return {
      ...publicPendingWorkspaceWrite(pending),
      pendingApproval: false,
      applied: false,
      denied: true,
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
    listPendingWorkspaceWritesTool,
    approvePendingWorkspaceWriteTool,
    denyPendingWorkspaceWriteTool,
    runNodeCheckTool,
  };
}

module.exports = {
  createProjectToolsApi,
};
