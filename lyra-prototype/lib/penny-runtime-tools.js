function createRuntimeToolsApi({
  projectRoot,
  fs,
  path,
  clampNumber,
  truncateText,
  TOOL_LOG_TAIL_LINES,
  readUtf8ProjectFile,
  resolveProjectPath,
  toProjectRelative,
  getLmStudioConnectionStatus,
  sessionState,
  PORT,
  LOCAL_LLM_TRANSPORT,
  OPENCLAW_ENABLED,
  WEB_SEARCH_ENABLED,
} = {}) {
  if (!projectRoot) throw new TypeError('createRuntimeToolsApi requires projectRoot');
  if (!fs || typeof fs.existsSync !== 'function') throw new TypeError('createRuntimeToolsApi requires fs');
  if (!path || typeof path.join !== 'function') throw new TypeError('createRuntimeToolsApi requires path');
  if (typeof clampNumber !== 'function') throw new TypeError('createRuntimeToolsApi requires clampNumber');
  if (typeof truncateText !== 'function') throw new TypeError('createRuntimeToolsApi requires truncateText');
  if (typeof readUtf8ProjectFile !== 'function') throw new TypeError('createRuntimeToolsApi requires readUtf8ProjectFile');
  if (typeof resolveProjectPath !== 'function') throw new TypeError('createRuntimeToolsApi requires resolveProjectPath');
  if (typeof toProjectRelative !== 'function') throw new TypeError('createRuntimeToolsApi requires toProjectRelative');
  if (typeof getLmStudioConnectionStatus !== 'function') throw new TypeError('createRuntimeToolsApi requires getLmStudioConnectionStatus');
  if (!sessionState || typeof sessionState !== 'object') throw new TypeError('createRuntimeToolsApi requires sessionState');

  function resolveLogTarget(target = 'latest') {
    const raw = String(target || 'latest').trim().toLowerCase();
    const known = {
      latest: null,
      stdout: path.join(projectRoot, 'lyra-server.out.log'),
      stderr: path.join(projectRoot, 'lyra-server.err.log'),
      server: path.join(projectRoot, 'lyra-server.out.log'),
    };
    if (known[raw]) return known[raw];
    if (raw !== 'latest' && raw !== 'server') {
      const direct = resolveProjectPath(target);
      if (fs.existsSync(direct)) return direct;
    }
    const candidates = [
      path.join(projectRoot, 'lyra-server.out.log'),
      path.join(projectRoot, 'lyra-server.err.log'),
      ...(() => {
        const logsDir = path.join(projectRoot, 'logs');
        if (!fs.existsSync(logsDir)) return [];
        return fs.readdirSync(logsDir)
          .map((name) => path.join(logsDir, name))
          .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile());
      })(),
    ].filter((filePath) => fs.existsSync(filePath));
    if (!candidates.length) throw new Error('No Penny log files were found.');
    return candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  }

  function readRecentLogsTool(args = {}) {
    const logPath = resolveLogTarget(args.target || 'latest');
    const lines = clampNumber(args.lines, 10, TOOL_LOG_TAIL_LINES, Math.min(40, TOOL_LOG_TAIL_LINES));
    const raw = readUtf8ProjectFile(logPath).replace(/\r\n/g, '\n').split('\n');
    const excerpt = raw.slice(-lines).join('\n');
    return {
      path: toProjectRelative(logPath),
      lines,
      totalLines: raw.length,
      excerpt: truncateText(excerpt),
    };
  }

  async function getRuntimeStatusTool() {
    const lmStudio = await getLmStudioConnectionStatus({ force: true });
    return {
      serverPort: Number(PORT),
      localTransport: LOCAL_LLM_TRANSPORT,
      shadowEnabled: OPENCLAW_ENABLED,
      lastMood: sessionState.lastMood,
      turns: sessionState.turns,
      resolvedModel: lmStudio.resolvedModel || '',
      installedModels: lmStudio.installedModels || [],
      reachable: !!lmStudio.reachable,
      webSearchEnabled: WEB_SEARCH_ENABLED,
      lmStudio,
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    resolveLogTarget,
    readRecentLogsTool,
    getRuntimeStatusTool,
  };
}

module.exports = {
  createRuntimeToolsApi,
};
