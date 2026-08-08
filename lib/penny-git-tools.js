function createGitToolsApi({
  projectRoot,
  execFileText,
  truncateText,
  clampNumber,
  TOOL_COMMAND_TIMEOUT_MS,
  resolveProjectPath,
  assertReadableProjectFile,
  toProjectRelative,
} = {}) {
  if (!projectRoot) throw new TypeError('createGitToolsApi requires projectRoot');
  if (typeof execFileText !== 'function') throw new TypeError('createGitToolsApi requires execFileText');
  if (typeof truncateText !== 'function') throw new TypeError('createGitToolsApi requires truncateText');
  if (typeof clampNumber !== 'function') throw new TypeError('createGitToolsApi requires clampNumber');
  if (typeof resolveProjectPath !== 'function') throw new TypeError('createGitToolsApi requires resolveProjectPath');
  if (typeof assertReadableProjectFile !== 'function') throw new TypeError('createGitToolsApi requires assertReadableProjectFile');
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
    if (filePath) assertReadableProjectFile(filePath);
    const contextLines = clampNumber(args.contextLines, 0, 12, 3);
    const summaryOnly = args.summaryOnly === true;
    try {
      let readablePaths = filePath ? [toProjectRelative(filePath)] : null;
      let omittedSensitivePathCount = 0;
      if (!readablePaths) {
        const listed = await execFileText('git', ['diff', '--name-only', '-z'], {
          cwd: projectRoot,
          timeout: Math.min(TOOL_COMMAND_TIMEOUT_MS, 20000),
        });
        readablePaths = [];
        for (const relativePath of String(listed.stdout || '').split('\0').filter(Boolean)) {
          try {
            const candidate = resolveProjectPath(relativePath);
            assertReadableProjectFile(candidate);
            readablePaths.push(toProjectRelative(candidate));
          } catch {
            omittedSensitivePathCount += 1;
          }
        }
      }
      if (!readablePaths.length) {
        return {
          ok: true,
          path: filePath ? toProjectRelative(filePath) : null,
          summaryOnly,
          contextLines: summaryOnly ? 0 : contextLines,
          diff: '(no readable diff)',
          omittedSensitivePathCount,
          stderr: '',
        };
      }
      const gitArgs = summaryOnly
        ? ['diff', '--stat', '--', ...readablePaths]
        : ['diff', `--unified=${contextLines}`, '--', ...readablePaths];
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
        omittedSensitivePathCount,
        stderr: truncateText(String(stderr || '').trim()),
      };
    } catch (error) {
      return {
        ok: false,
        path: filePath ? toProjectRelative(filePath) : null,
        summaryOnly,
        contextLines: summaryOnly ? 0 : contextLines,
        diff: '',
        omittedSensitivePathCount: 0,
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
