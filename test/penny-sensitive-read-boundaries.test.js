const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createRuntimeToolsApi } = require('../lib/penny-runtime-tools');
const { createGitToolsApi } = require('../lib/penny-git-tools');

const projectRoot = path.join(path.sep, 'penny-project');

function toProjectRelative(filePath = '') {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function resolveProjectPath(relativePath = '') {
  return path.resolve(projectRoot, String(relativePath || ''));
}

function assertReadableProjectFile(filePath = '') {
  const relativePath = toProjectRelative(filePath);
  if (relativePath === '.env' || /(?:^|\/)private\.(?:key|pem)$/i.test(relativePath)) {
    throw new Error(`${relativePath} is a secret-bearing file and is not readable through Penny project tools.`);
  }
}

function buildRuntimeTools({ readableFiles = {} } = {}) {
  const files = new Map(Object.entries(readableFiles).map(([relativePath, value]) => [resolveProjectPath(relativePath), value]));
  return createRuntimeToolsApi({
    projectRoot,
    fs: {
      existsSync(filePath) {
        return files.has(filePath);
      },
      statSync() {
        return { isFile: () => true, mtimeMs: 1 };
      },
      readdirSync() {
        return [];
      },
    },
    path,
    clampNumber: (value, min, max, fallback) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback)),
    truncateText: (value) => String(value),
    TOOL_LOG_TAIL_LINES: 120,
    readUtf8ProjectFile(filePath) {
      return files.get(filePath);
    },
    assertReadableProjectFile,
    resolveProjectPath,
    toProjectRelative,
    getLmStudioConnectionStatus: async () => ({}),
    sessionState: {},
    PORT: 4317,
    LOCAL_LLM_TRANSPORT: 'chat',
    OPENCLAW_ENABLED: false,
    WEB_SEARCH_ENABLED: false,
  });
}

test('read_recent_logs rejects secret-bearing direct targets before bytes are read', () => {
  const runtimeTools = buildRuntimeTools({
    readableFiles: {
      '.env': 'PENNY_LMSTUDIO_API_KEY=canary-secret',
    },
  });

  assert.throws(
    () => runtimeTools.readRecentLogsTool({ target: '.env' }),
    /secret-bearing file/i,
  );
});

test('read_recent_logs allows only readable log files under logs/ for direct targets', () => {
  const runtimeTools = buildRuntimeTools({
    readableFiles: {
      'logs/penny-server.log': 'first line\nsecond line',
      'README.md': 'not a log',
    },
  });

  const log = runtimeTools.readRecentLogsTool({ target: 'logs/penny-server.log', lines: 10 });
  assert.equal(log.path, 'logs/penny-server.log');
  assert.match(log.excerpt, /second line/);
  assert.throws(
    () => runtimeTools.readRecentLogsTool({ target: 'README.md' }),
    /only accepts Penny log files/i,
  );
});

test('read_git_diff removes sensitive paths from an unscoped diff and rejects an explicit secret path', async () => {
  const commands = [];
  const gitTools = createGitToolsApi({
    projectRoot,
    truncateText: (value) => String(value),
    clampNumber: (value, min, max, fallback) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback)),
    TOOL_COMMAND_TIMEOUT_MS: 20_000,
    resolveProjectPath,
    assertReadableProjectFile,
    toProjectRelative,
    async execFileText(_command, args) {
      commands.push(args);
      if (args.includes('--name-only')) {
        return { stdout: '.env\0README.md\0logs/penny-server.log\0', stderr: '' };
      }
      return { stdout: 'diff --git a/README.md b/README.md\n+safe change', stderr: '' };
    },
  });

  const result = await gitTools.readGitDiffTool({ contextLines: 3 });
  assert.equal(result.ok, true);
  assert.equal(result.omittedSensitivePathCount, 1);
  assert.match(result.diff, /safe change/);
  assert.deepEqual(commands[1], ['diff', '--unified=3', '--', 'README.md', 'logs/penny-server.log']);
  await assert.rejects(
    () => gitTools.readGitDiffTool({ path: '.env' }),
    /secret-bearing file/i,
  );
});
