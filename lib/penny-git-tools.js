function createGitToolsApi({
  projectRoot,
  execFileText,
  truncateText,
  clampNumber,
  TOOL_COMMAND_TIMEOUT_MS,
  resolveProjectPath,
  toProjectRelative,
} = {}) {
  if (!projectRoot) throw new TypeError('createGitToolsApi requires projectRoot');
  if (typeof execFileText !== 'function') throw new TypeError('createGitToolsApi requires execFileText');
  if (typeof truncateText !== 'function') throw new TypeError('createGitToolsApi requires truncateText');
  if (typeof clampNumber !== 'function') throw new TypeError('createGitToolsApi requires clampNumber');
  if (typeof resolveProjectPath !== 'function') throw new TypeError('createGitToolsApi requires resolveProjectPath');
  if (typeof toProjectRelative !== 'function') throw new TypeError('createGitToolsApi requires toProjectRelative');

  async function getGitStatusTool() {
    try {
      const { stdout, stderr } = await execFileText('git', ['status', '--short'], {
        cwd: projectRoot,
        timeout: Math.min(TOOL_COMMAND_TIMEOUT_MS, 15000),
      });
      return {
        ok: true,
        status: truncateText(String(stdout || '').trim() || '(clean)'),
        stderr: truncateText(String(stderr || '').trim()),
      };
    } catch (error) {
      return {
        ok: false,
        status: '',
        stderr: truncateText(String(error?.stderr || error?.message || '').trim()),
      };
    }
  }

  async function readGitDiffTool(args = {}) {
    const hasPath = !!String(args.path || '').trim();
    const filePath = hasPath ? resolveProjectPath(args.path || '') : null;
    const contextLines = clampNumber(args.contextLines, 0, 12, 3);
    const summaryOnly = args.summaryOnly === true;
    const gitArgs = summaryOnly
      ? ['diff', '--stat']
      : ['diff', `--unified=${contextLines}`];
    if (filePath) {
      gitArgs.push('--', toProjectRelative(filePath));
    }
    try {
      const { stdout, stderr } = await execFileText('git', gitArgs, {
        cwd: projectRoot,
        timeout: Math.min(TOOL_COMMAND_TIMEOUT_MS, 20000),
      });
      const diff = String(stdout || '').trim() || '(no diff)';
      return {
        ok: true,
        path: filePath ? toProjectRelative(filePath) : null,
        summaryOnly,
        contextLines: summaryOnly ? 0 : contextLines,
        diff: truncateText(diff),
        stderr: truncateText(String(stderr || '').trim()),
      };
    } catch (error) {
      return {
        ok: false,
        path: filePath ? toProjectRelative(filePath) : null,
        summaryOnly,
        contextLines: summaryOnly ? 0 : contextLines,
        diff: '',
        stderr: truncateText(String(error?.stderr || error?.message || '').trim()),
      };
    }
  }

  return {
    getGitStatusTool,
    readGitDiffTool,
  };
}

module.exports = {
  createGitToolsApi,
};
